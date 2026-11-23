import { prisma } from '../../lib/prisma';

const OPERATION_PERMISSIONS = {
  'gmail.send': {
    provider: 'gmail',
    scope: 'https://www.googleapis.com/auth/gmail.send',
  },
  'ga4.read': {
    provider: 'ga4',
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
  },
  'google_ads.manage': {
    provider: 'google_ads',
    scope: 'https://www.googleapis.com/auth/adwords',
  },
  'mailchimp.read': { provider: 'mailchimp', scope: null },
  'hubspot.lists_read': { provider: 'hubspot', scope: 'crm.lists.read' },
  'hubspot.contacts_read': {
    provider: 'hubspot',
    scope: 'crm.objects.contacts.read',
  },
  'meta_ads.read': {
    provider: 'meta_ads',
    scope: 'ads_read',
  },
  'linkedin.ads_reporting': {
    provider: 'linkedin',
    scope: 'r_ads_reporting',
  },
} as const;

export type OAuthConnectorOperation =
  keyof typeof OPERATION_PERMISSIONS;

export interface AuthorizeOAuthOperationInput {
  userId: string;
  workspaceId: string;
  connectionId: string;
  operation: OAuthConnectorOperation;
}

/**
 * Internal authorization check for backend connector operations.
 *
 * userId must originate from verified authentication,
 * never directly from an agent prompt or request body.
 *
 * This function never returns OAuth credentials.
 */
async function authorizeOAuthOperationInternal(
  input: AuthorizeOAuthOperationInput,
  enforceExpiry: boolean
) {
  if (
    !input.userId?.trim() ||
    !input.workspaceId?.trim() ||
    !input.connectionId?.trim()
  ) {
    throw new Error('OAuth authorization context is required');
  }

  const permission = OPERATION_PERMISSIONS[input.operation];

  if (!permission) {
    throw new Error('Unsupported OAuth connector operation');
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw new Error('OAuth workspace access denied');
  }

  const connection = await prisma.oAuthConnection.findFirst({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      provider: permission.provider,
    },
    select: {
      id: true,
      provider: true,
      accountLabel: true,
      grantedScopes: true,
      tokenExpiresAt: true,
      connectionStatus: true,
    },
  });

  if (!connection) {
    throw new Error('OAuth connection not authorized');
  }

  if (connection.connectionStatus !== 'ACTIVE') {
    throw new Error('OAuth connection requires reconnection');
  }

  if (permission.scope !== null && !connection.grantedScopes.includes(permission.scope)) {
    throw new Error('Required OAuth permission not granted');
  }

  if (
    enforceExpiry &&
    (connection.tokenExpiresAt
      ? connection.tokenExpiresAt.getTime() <= Date.now() + 30_000
      : permission.provider !== 'mailchimp')
  ) {
    throw new Error('OAuth access token expired or requires refresh');
  }

  return {
    connectionId: connection.id,
    provider: connection.provider,
    accountLabel: connection.accountLabel,
    authorizedOperation: input.operation,
  };
}

/**
 * Authorization for an actual provider operation.
 * Requires a valid, unexpired access token.
 */
export async function authorizeOAuthOperation(
  input: AuthorizeOAuthOperationInput
) {
  return authorizeOAuthOperationInternal(input, true);
}

/**
 * Authorization before refreshing an expired access token.
 * Still enforces membership, ownership, scopes and ACTIVE status.
 * Returns metadata only, never OAuth credentials.
 */
export async function authorizeOAuthGrantForRefresh(
  input: AuthorizeOAuthOperationInput
) {
  return authorizeOAuthOperationInternal(input, false);
}
