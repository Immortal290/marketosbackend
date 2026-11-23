import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { encryptOAuthToken, decryptOAuthToken } from './oauth-crypto';

export interface SaveOAuthConnectionInput {
  workspaceId: string;
  connectedByUserId: string;
  provider: string;
  providerAccountId: string;
  accountLabel?: string;
  accessToken: string;
  refreshToken?: string;
  grantedScopes: string[];
  tokenExpiresAt?: Date | null;
}

function requireContext(value: string, name: string): void {
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
}

export async function saveOAuthConnection(input: SaveOAuthConnectionInput) {
  requireContext(input.workspaceId, 'Workspace ID');
  requireContext(input.connectedByUserId, 'User ID');
  requireContext(input.provider, 'Provider');
  requireContext(input.providerAccountId, 'Provider account ID');
  requireContext(input.accessToken, 'Access token');

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.connectedByUserId,
        workspaceId: input.workspaceId,
      },
    },
    select: { role: true },
  });

  if (membership?.role !== 'OWNER') {
    throw new Error('Workspace owner permission required');
  }

  const existing = await prisma.oAuthConnection.findUnique({
    where: {
      workspaceId_provider_providerAccountId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    select: {
      id: true,
      connectedByUserId: true,
      encryptedRefreshToken: true,
      grantedScopes: true,
      connectionStatus: true,
    },
  });

  const connectionId = existing?.id ?? randomUUID();

  const encryptedAccessToken = encryptOAuthToken(
    input.accessToken,
    input.workspaceId,
    input.provider,
    connectionId,
    'access'
  );

  // Preserve a refresh token only for the same owner and grant context.
  const canReuseRefreshToken =
    existing?.connectedByUserId === input.connectedByUserId &&
    existing?.connectionStatus === 'ACTIVE' &&
    !!existing.encryptedRefreshToken &&
    input.grantedScopes.every(scope =>
      existing.grantedScopes.includes(scope)
    );

  const encryptedRefreshToken = input.refreshToken
    ? encryptOAuthToken(
        input.refreshToken,
        input.workspaceId,
        input.provider,
        connectionId,
        'refresh'
      )
    : canReuseRefreshToken
      ? existing!.encryptedRefreshToken
      : null;

  // Google background access requires a usable refresh-token strategy.
  // Never mark a new Google connection ACTIVE without one.
  const isGoogleProvider = ['gmail', 'ga4', 'google_ads'].includes(
    input.provider
  );

  if (isGoogleProvider && !encryptedRefreshToken) {
    throw new Error(
      'Google OAuth refresh token unavailable; reconnect with offline consent'
    );
  }

  return prisma.oAuthConnection.upsert({
    where: {
      workspaceId_provider_providerAccountId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    create: {
      id: connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.connectedByUserId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      accountLabel: input.accountLabel,
      encryptedAccessToken,
      encryptedRefreshToken,
      grantedScopes: input.grantedScopes,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: 'ACTIVE',
      lastVerifiedAt: new Date(),
    },
    update: {
      connectedByUserId: input.connectedByUserId,
      accountLabel: input.accountLabel,
      encryptedAccessToken,
      encryptedRefreshToken,
      grantedScopes: input.grantedScopes,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: 'ACTIVE',
      lastVerifiedAt: new Date(),
    },
    select: {
      id: true,
      workspaceId: true,
      provider: true,
      providerAccountId: true,
      accountLabel: true,
      grantedScopes: true,
      tokenExpiresAt: true,
      connectionStatus: true,
      lastVerifiedAt: true,
    },
  });
}

export async function listOAuthConnections(workspaceId: string) {
  requireContext(workspaceId, 'Workspace ID');

  return prisma.oAuthConnection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      accountLabel: true,
      grantedScopes: true,
      tokenExpiresAt: true,
      connectionStatus: true,
      lastVerifiedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getOAuthTokens(
  workspaceId: string,
  provider: string,
  connectionId: string
) {
  requireContext(workspaceId, 'Workspace ID');
  requireContext(provider, 'Provider');
  requireContext(connectionId, 'Connection ID');

  const connection = await prisma.oAuthConnection.findFirst({
    where: {
      id: connectionId,
      workspaceId,
      provider,
      connectionStatus: 'ACTIVE',
    },
  });

  if (!connection) {
    return null;
  }

  // Never hand an expired or unverified token to an agent.
  // The refresh service must renew it first.
  if (
    (provider !== 'mailchimp' && !connection.tokenExpiresAt) ||
    (connection.tokenExpiresAt !== null &&
      connection.tokenExpiresAt.getTime() <= Date.now() + 30_000)
  ) {
    return null;
  }

  return {
    accessToken: decryptOAuthToken(
      connection.encryptedAccessToken,
      workspaceId,
      provider,
      connection.id,
      'access'
    ),
    refreshToken: connection.encryptedRefreshToken
      ? decryptOAuthToken(
          connection.encryptedRefreshToken,
          workspaceId,
          provider,
          connection.id,
          'refresh'
        )
      : null,
    grantedScopes: connection.grantedScopes,
    tokenExpiresAt: connection.tokenExpiresAt,
  };
}

export interface UpdateRefreshedOAuthAccessTokenInput {
  workspaceId: string;
  provider: string;
  connectionId: string;
  expectedEncryptedAccessToken: string;
  newAccessToken: string;
  expiresIn: number;
}

export async function updateRefreshedOAuthAccessToken(
  input: UpdateRefreshedOAuthAccessTokenInput
): Promise<boolean> {
  requireContext(input.workspaceId, 'Workspace ID');
  requireContext(input.provider, 'Provider');
  requireContext(input.connectionId, 'Connection ID');
  requireContext(
    input.expectedEncryptedAccessToken,
    'Expected encrypted access token'
  );
  requireContext(input.newAccessToken, 'New access token');

  if (
    !Number.isFinite(input.expiresIn) ||
    input.expiresIn <= 0
  ) {
    throw new Error('Invalid OAuth token expiration');
  }

  const encryptedAccessToken = encryptOAuthToken(
    input.newAccessToken,
    input.workspaceId,
    input.provider,
    input.connectionId,
    'access'
  );

  const tokenExpiresAt = new Date(
    Date.now() + input.expiresIn * 1000
  );

  if (!Number.isFinite(tokenExpiresAt.getTime())) {
    throw new Error('Invalid OAuth token expiration date');
  }

  // Compare-and-swap prevents a stale refresh from overwriting
  // credentials replaced by another refresh or reconnection.
  const result = await prisma.oAuthConnection.updateMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionStatus: 'ACTIVE',
      encryptedAccessToken: input.expectedEncryptedAccessToken,
    },
    data: {
      encryptedAccessToken,
      tokenExpiresAt,
      lastVerifiedAt: new Date(),
    },
  });

  return result.count === 1;
}

/**
 * Atomically rotate encrypted external-provider credentials.
 *
 * The compare-and-swap condition prevents an older refresh from
 * replacing credentials updated by another refresh or reconnection.
 * If the provider does not rotate its refresh token, preserve the old one.
 */
export async function updateRotatedOAuthTokens(input: {
  workspaceId: string;
  provider: 'hubspot' | 'linkedin';
  connectionId: string;
  expectedEncryptedAccessToken: string;
  newAccessToken: string;
  newRefreshToken?: string | null;
  expiresIn: number;
}): Promise<boolean> {
  requireContext(input.workspaceId, 'Workspace ID');
  requireContext(input.connectionId, 'Connection ID');
  requireContext(
    input.expectedEncryptedAccessToken,
    'Expected encrypted access token'
  );
  requireContext(input.newAccessToken, 'New access token');

  if (
    input.provider !== 'hubspot' &&
    input.provider !== 'linkedin'
  ) {
    throw new Error('Unsupported OAuth token rotation provider');
  }

  if (
    !Number.isSafeInteger(input.expiresIn) ||
    input.expiresIn <= 30 ||
    input.expiresIn > 366 * 24 * 3600
  ) {
    throw new Error('Invalid OAuth token lifetime');
  }

  if (
    input.newRefreshToken != null &&
    (!input.newRefreshToken.trim() ||
      input.newRefreshToken.length > 16384)
  ) {
    throw new Error('Invalid rotated OAuth refresh token');
  }

  const encryptedAccessToken = encryptOAuthToken(
    input.newAccessToken,
    input.workspaceId,
    input.provider,
    input.connectionId,
    'access'
  );

  const encryptedRefreshToken = input.newRefreshToken
    ? encryptOAuthToken(
        input.newRefreshToken,
        input.workspaceId,
        input.provider,
        input.connectionId,
        'refresh'
      )
    : null;

  const tokenExpiresAt = new Date(
    Date.now() + input.expiresIn * 1000
  );

  if (!Number.isFinite(tokenExpiresAt.getTime())) {
    throw new Error('Invalid OAuth token expiration');
  }

  const result = await prisma.oAuthConnection.updateMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionStatus: 'ACTIVE',
      encryptedAccessToken: input.expectedEncryptedAccessToken,
    },
    data: {
      encryptedAccessToken,
      ...(encryptedRefreshToken
        ? { encryptedRefreshToken }
        : {}),
      tokenExpiresAt,
      lastVerifiedAt: new Date(),
    },
  });

  return result.count === 1;
}

/**
 * Internal backend-only snapshot for refreshing an OAuth connection.
 * Never expose this result through an HTTP response.
 */
export async function getOAuthRefreshSnapshot(
  workspaceId: string,
  provider: string,
  connectionId: string
) {
  requireContext(workspaceId, 'Workspace ID');
  requireContext(provider, 'Provider');
  requireContext(connectionId, 'Connection ID');

  const connection = await prisma.oAuthConnection.findFirst({
    where: {
      id: connectionId,
      workspaceId,
      provider,
      connectionStatus: 'ACTIVE',
    },
    select: {
      id: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      tokenExpiresAt: true,
      grantedScopes: true,
    },
  });

  if (!connection) {
    return null;
  }

  return {
    encryptedAccessToken: connection.encryptedAccessToken,
    refreshToken: connection.encryptedRefreshToken
      ? decryptOAuthToken(
          connection.encryptedRefreshToken,
          workspaceId,
          provider,
          connection.id,
          'refresh'
        )
      : null,
    tokenExpiresAt: connection.tokenExpiresAt,
    grantedScopes: connection.grantedScopes,
  };
}

/**
 * Mark an OAuth connection as requiring reconnection.
 *
 * The encrypted access-token comparison prevents an older refresh
 * failure from invalidating a connection that has since been updated.
 *
 * This function never returns stored credentials.
 */
export async function markOAuthReconnectRequired(input: {
  workspaceId: string;
  provider: string;
  connectionId: string;
  expectedEncryptedAccessToken: string;
}): Promise<boolean> {
  requireContext(input.workspaceId, 'Workspace ID');
  requireContext(input.provider, 'Provider');
  requireContext(input.connectionId, 'Connection ID');
  requireContext(
    input.expectedEncryptedAccessToken,
    'Expected encrypted access token'
  );

  const result = await prisma.oAuthConnection.updateMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionStatus: 'ACTIVE',
      encryptedAccessToken: input.expectedEncryptedAccessToken,
    },
    data: {
      connectionStatus: 'RECONNECT_REQUIRED',
    },
  });

  return result.count === 1;
}

/**
 * Internal backend-only OAuth connection removal.
 *
 * The caller must verify workspace ownership and handle provider
 * revocation before invoking this function.
 *
 * Compare-and-delete prevents a stale disconnect from removing
 * credentials replaced by a concurrent refresh or reconnection.
 */
export async function removeOAuthConnectionIfUnchanged(input: {
  workspaceId: string;
  provider: string;
  connectionId: string;
  expectedEncryptedAccessToken: string;
}): Promise<boolean> {
  requireContext(input.workspaceId, 'Workspace ID');
  requireContext(input.provider, 'Provider');
  requireContext(input.connectionId, 'Connection ID');
  requireContext(
    input.expectedEncryptedAccessToken,
    'Expected encrypted access token'
  );

  const result = await prisma.oAuthConnection.deleteMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      encryptedAccessToken: input.expectedEncryptedAccessToken,
    },
  });

  return result.count === 1;
}
