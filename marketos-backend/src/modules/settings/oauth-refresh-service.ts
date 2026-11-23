import {
  OAUTH_PROVIDERS,
  isConfiguredOAuthProvider,
} from './oauth-providers';

import {
  GoogleOAuthRefreshError,
  refreshGoogleAccessToken,
} from './oauth-google';

import {
  getOAuthRefreshSnapshot,
  updateRefreshedOAuthAccessToken,
  markOAuthReconnectRequired,
} from './oauth-storage';

export type OAuthRefreshStatus =
  | 'refreshed'
  | 'not_due'
  | 'reconnect_required'
  | 'stale'
  | 'unavailable';

export interface OAuthRefreshResult {
  status: OAuthRefreshStatus;
}

/**
 * Internal backend-only token lifecycle operation.
 *
 * Callers must independently enforce user/workspace authorization
 * and required OAuth scopes before using a connection.
 *
 * Never expose the refresh snapshot or provider tokens to clients.
 */
export async function refreshGoogleOAuthConnection(input: {
  workspaceId: string;
  provider: string;
  connectionId: string;
  force?: boolean;
}): Promise<OAuthRefreshResult> {
  if (
    !isConfiguredOAuthProvider(input.provider) ||
    OAUTH_PROVIDERS[input.provider].family !== 'google'
  ) {
    throw new Error('Unsupported Google OAuth provider');
  }

  const snapshot = await getOAuthRefreshSnapshot(
    input.workspaceId,
    input.provider,
    input.connectionId
  );

  if (!snapshot) {
    return { status: 'unavailable' };
  }

  const refreshWindowMs = 5 * 60 * 1000;

  if (
    !input.force &&
    snapshot.tokenExpiresAt &&
    snapshot.tokenExpiresAt.getTime() >
      Date.now() + refreshWindowMs
  ) {
    return { status: 'not_due' };
  }

  if (!snapshot.refreshToken) {
    const marked = await markOAuthReconnectRequired({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken: snapshot.encryptedAccessToken,
    });

    return {
      status: marked ? 'reconnect_required' : 'stale',
    };
  }

  try {
    const refreshed = await refreshGoogleAccessToken(
      snapshot.refreshToken
    );

    // A refresh must never silently expand or alter our stored grant.
    // If Google reports scopes, require the existing permissions.
    if (
      refreshed.grantedScopes &&
      !snapshot.grantedScopes.every(scope =>
        refreshed.grantedScopes!.includes(scope)
      )
    ) {
      const marked = await markOAuthReconnectRequired({
        workspaceId: input.workspaceId,
        provider: input.provider,
        connectionId: input.connectionId,
        expectedEncryptedAccessToken: snapshot.encryptedAccessToken,
      });

      return {
        status: marked ? 'reconnect_required' : 'stale',
      };
    }

    const updated = await updateRefreshedOAuthAccessToken({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken:
        snapshot.encryptedAccessToken,
      newAccessToken: refreshed.accessToken,
      expiresIn: refreshed.expiresIn,
    });

    return { status: updated ? 'refreshed' : 'stale' };
  } catch (error) {
    if (
      error instanceof GoogleOAuthRefreshError &&
      error.reconnectRequired
    ) {
      const marked = await markOAuthReconnectRequired({
        workspaceId: input.workspaceId,
        provider: input.provider,
        connectionId: input.connectionId,
        expectedEncryptedAccessToken: snapshot.encryptedAccessToken,
      });

      return {
        status: marked ? 'reconnect_required' : 'stale',
      };
    }

    throw error;
  }
}
