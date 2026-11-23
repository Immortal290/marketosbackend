import { prisma } from '../../lib/prisma';

import {
  EXTERNAL_OAUTH_PROVIDERS,
  ExternalOAuthProvider,
} from './oauth-external-providers';

import { consumeOAuthState } from './oauth-state';

import { exchangeExternalOAuthCode } from
  './oauth-external-token-exchange';

import { verifyExternalOAuthAccount } from
  './oauth-external-account-verification';

import { saveOAuthConnection } from './oauth-storage';

export type ExternalCallbackResult =
  | 'success'
  | 'cancelled'
  | 'error';

/**
 * Completes an external provider's OAuth callback.
 *
 * The callback relies on single-use Redis state rather than
 * a browser-supplied user ID or workspace ID.
 *
 * The authorization code and tokens never enter frontend code.
 */
export async function completeExternalOAuthCallback(input: {
  provider: ExternalOAuthProvider;
  state: string;
  code?: string;
  error?: string;
}): Promise<ExternalCallbackResult> {
  const providerConfig = EXTERNAL_OAUTH_PROVIDERS[input.provider];

  if (!providerConfig) {
    throw new Error('Unsupported OAuth provider');
  }

  // Consume state before inspecting provider success/failure.
  // The expected provider prevents cross-provider state substitution.
  const context = await consumeOAuthState(
    input.state,
    input.provider
  );

  if (context.provider !== input.provider) {
    throw new Error('OAuth provider state mismatch');
  }

  if (input.error === 'access_denied') {
    return 'cancelled';
  }

  if (input.error !== undefined) {
    return 'error';
  }

  if (
    typeof input.code !== 'string' ||
    !input.code.trim()
  ) {
    return 'error';
  }

  // The original authenticated workspace owner must still
  // have permission after returning from the provider.
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: context.userId,
        workspaceId: context.workspaceId,
      },
    },
    select: { role: true },
  });

  if (membership?.role !== 'OWNER') {
    throw new Error('OAuth workspace permission revoked');
  }

  const tokens = await exchangeExternalOAuthCode({
    provider: input.provider,
    code: input.code,
  });

  const account = await verifyExternalOAuthAccount({
    provider: input.provider,
    accessToken: tokens.accessToken,
  });

  // Trust the provider-verified permission set, not merely
  // the scopes requested in the initial authorization URL.
  const missingScopes = providerConfig.scopes.filter(
    (scope) => !account.grantedScopes.includes(scope)
  );

  if (missingScopes.length > 0) {
    throw new Error('Required OAuth permissions not granted');
  }

  // Mailchimp OAuth tokens are not time-limited.
  // Other providers must supply a validated expiration.
  if (
    input.provider !== 'mailchimp' &&
    (
      tokens.expiresIn === null ||
      !Number.isFinite(tokens.expiresIn) ||
      tokens.expiresIn <= 30
    )
  ) {
    throw new Error('Invalid OAuth token expiration');
  }

  const tokenExpiresAt =
    input.provider === 'mailchimp'
      ? null
      : new Date(Date.now() + tokens.expiresIn! * 1000);

  // Storage rechecks workspace ownership and encrypts tokens.
  await saveOAuthConnection({
    workspaceId: context.workspaceId,
    connectedByUserId: context.userId,
    provider: input.provider,
    providerAccountId: account.providerAccountId,
    accountLabel: account.accountLabel,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? undefined,
    grantedScopes: account.grantedScopes,
    tokenExpiresAt,
  });

  return 'success';
}
