import { prisma } from '../../lib/prisma';

import {
  listAccessibleOAuthAssets,
  OAuthAssetProvider,
} from './oauth-asset-discovery';

import {
  authorizeOAuthOperation,
  OAuthConnectorOperation,
} from './oauth-agent-authorization';

const ASSET_OPERATIONS: Record<
  OAuthAssetProvider,
  OAuthConnectorOperation
> = {
  ga4: 'ga4.read',
  google_ads: 'google_ads.manage',
  meta_ads: 'meta_ads.read',
  linkedin: 'linkedin.ads_reporting',
};

function isAssetProvider(value: string): value is OAuthAssetProvider {
  return Object.prototype.hasOwnProperty.call(
    ASSET_OPERATIONS,
    value
  );
}

/**
 * Save asset IDs only after verifying access with the actual provider.
 *
 * This function never accepts access tokens or provider identity
 * from the browser. User identity must come from verified JWT auth.
 */
export async function saveVerifiedOAuthAssetSelection(input: {
  userId: string;
  workspaceId: string;
  connectionId: string;
  assetIds: string[];
}) {
  if (
    !input.userId?.trim() ||
    !input.workspaceId?.trim() ||
    !input.connectionId?.trim()
  ) {
    throw new Error('OAuth authorization context is required');
  }

  if (
    !Array.isArray(input.assetIds) ||
    input.assetIds.length > 50 ||
    !input.assetIds.every(
      (id) =>
        typeof id === 'string' &&
        id.length > 0 &&
        id.length <= 256 &&
        id.trim() === id
    )
  ) {
    throw new Error('Invalid OAuth asset selection');
  }

  if (new Set(input.assetIds).size !== input.assetIds.length) {
    throw new Error('Duplicate OAuth asset selection');
  }

  // First determine the actual provider from the database.
  const connection = await prisma.oAuthConnection.findFirst({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      connectionStatus: 'ACTIVE',
    },
    select: {
      provider: true,
    },
  });

  if (!connection) {
    throw new Error('OAuth connection not authorized');
  }

  if (!isAssetProvider(connection.provider)) {
    throw new Error('Provider does not support asset selection');
  }

  const provider = connection.provider;

  // This uses authorized backend execution, token refresh,
  // and the provider's actual accessible-asset API.
  const accessible = await listAccessibleOAuthAssets({
    userId: input.userId,
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    provider,
  });

  const permitted = new Set(accessible.map((asset) => asset.id));

  if (!input.assetIds.every((id) => permitted.has(id))) {
    throw new Error(
      'One or more selected assets are not accessible'
    );
  }

  // Recheck connection ownership, scopes and token validity
  // after the provider request has completed.
  const authorization = await authorizeOAuthOperation({
    userId: input.userId,
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    operation: ASSET_OPERATIONS[provider],
  });

  if (authorization.provider !== provider) {
    throw new Error('OAuth connection changed');
  }

  // Asset selection is currently restricted to workspace owners.
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    select: { role: true },
  });

  if (membership?.role !== 'OWNER') {
    throw new Error('Workspace owner permission required');
  }

  // Read the latest version after any token refresh.
  const current = await prisma.oAuthConnection.findFirst({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      provider,
      connectionStatus: 'ACTIVE',
    },
    select: {
      encryptedAccessToken: true,
      updatedAt: true,
    },
  });

  if (!current) {
    throw new Error('OAuth connection changed');
  }

  const result = await prisma.oAuthConnection.updateMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      provider,
      connectionStatus: 'ACTIVE',
      encryptedAccessToken: current.encryptedAccessToken,
      updatedAt: current.updatedAt,
    },
    data: {
      selectedAssets: {
        assetIds: input.assetIds,
        verifiedAt: new Date().toISOString(),
      },
    },
  });

  if (result.count !== 1) {
    throw new Error(
      'OAuth connection changed; retry asset selection'
    );
  }

  return {
    provider,
    selectedAssetIds: [...input.assetIds],
  };
}
