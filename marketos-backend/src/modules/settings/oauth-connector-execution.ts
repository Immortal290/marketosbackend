import {
  authorizeOAuthGrantForRefresh,
  authorizeOAuthOperation,
  AuthorizeOAuthOperationInput,
} from './oauth-agent-authorization';

import { getOAuthTokens } from './oauth-storage';
import { refreshMetaOAuthConnection } from './oauth-meta-extension';
import { refreshExternalOAuthConnection } from './oauth-external-refresh-service';

import {
  refreshGoogleOAuthConnection,
} from './oauth-refresh-service';

/**
 * Backend-only connector execution.
 *
 * The caller must supply verified user identity and workspace context.
 * Only trusted provider adapters may receive the access token.
 *
 * Never expose access tokens to frontend clients or Python agents.
 */
export async function executeAuthorizedOAuthOperation<T>(
  input: AuthorizeOAuthOperationInput,
  backendOperation: (accessToken: string) => Promise<T>
): Promise<T> {
  // Verify workspace membership, account ownership, status and scopes.
  // Expired access tokens are allowed here solely for renewal.
  const grant = await authorizeOAuthGrantForRefresh(input);

  // Meta tokens must be extended while still valid.
  // Waiting for getOAuthTokens() to fail would be too late.
  if (grant.provider === 'meta_ads') {
    const renewal = await refreshMetaOAuthConnection({
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
    });

    if (renewal.status === 'reconnect_required') {
      throw new Error('OAuth connection requires reconnection');
    }

    if (renewal.status === 'unavailable') {
      throw new Error('OAuth access token unavailable');
    }

    // For 'refreshed', 'not_due', or 'stale', retrieve credentials
    // from storage and revalidate permissions before execution.
    // Never reuse a token obtained before a possible rotation.
  }
  let tokens = await getOAuthTokens(
    input.workspaceId,
    grant.provider,
    input.connectionId
  );

  if (!tokens) {
    let refresh;

    if (
      grant.provider === 'hubspot' ||
      grant.provider === 'linkedin'
    ) {
      refresh = await refreshExternalOAuthConnection({
        workspaceId: input.workspaceId,
        provider: grant.provider,
        connectionId: input.connectionId,
      });
    } else if (
      grant.provider === 'gmail' ||
      grant.provider === 'ga4' ||
      grant.provider === 'google_ads'
    ) {
      refresh = await refreshGoogleOAuthConnection({
        workspaceId: input.workspaceId,
        provider: grant.provider,
        connectionId: input.connectionId,
      });
    } else {
      // Mailchimp does not use expiring refresh tokens.
      // Meta requires its own token-lifecycle strategy.
      throw new Error(
        'OAuth access token unavailable or requires reconnection'
      );
    }

    if (refresh.status === 'reconnect_required') {
      throw new Error('OAuth connection requires reconnection');
    }

    if (
      refresh.status !== 'refreshed' &&
      refresh.status !== 'stale' &&
      refresh.status !== 'not_due'
    ) {
      throw new Error('OAuth access token unavailable');
    }
  }

  // Revalidate permission and expiration after any refresh.
  const permission = await authorizeOAuthOperation(input);

  tokens = await getOAuthTokens(
    input.workspaceId,
    permission.provider,
    input.connectionId
  );

  if (!tokens) {
    throw new Error(
      'OAuth access token unavailable or requires refresh'
    );
  }

  return backendOperation(tokens.accessToken);
}
