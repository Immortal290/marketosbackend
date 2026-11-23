import type { OAuthRefreshResult } from './oauth-refresh-service';

import {
  getOAuthRefreshSnapshot,
  updateRotatedOAuthTokens,
  markOAuthReconnectRequired,
} from './oauth-storage';

import {
  refreshExternalOAuthAccessToken,
  ExternalOAuthRefreshError,
  RefreshableExternalProvider,
} from './oauth-external-refresh';

/**
 * Internal backend-only external OAuth refresh.
 *
 * Callers must authorize the verified user, workspace,
 * connection ownership and operation scopes before invocation.
 * Never return tokens through HTTP, logs, or agent prompts.
 */
export async function refreshExternalOAuthConnection(input: {
  workspaceId: string;
  provider: RefreshableExternalProvider;
  connectionId: string;
  force?: boolean;
}): Promise<OAuthRefreshResult> {
  if (
    input.provider !== 'hubspot' &&
    input.provider !== 'linkedin'
  ) {
    throw new Error('Unsupported external OAuth refresh provider');
  }

  const snapshot = await getOAuthRefreshSnapshot(
    input.workspaceId,
    input.provider,
    input.connectionId
  );

  if (!snapshot) {
    return { status: 'unavailable' };
  }

  if (
    !input.force &&
    snapshot.tokenExpiresAt &&
    snapshot.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000
  ) {
    return { status: 'not_due' };
  }

  const markReconnect = async (): Promise<OAuthRefreshResult> => {
    const marked = await markOAuthReconnectRequired({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken: snapshot.encryptedAccessToken,
    });

    return {
      status: marked ? 'reconnect_required' : 'stale',
    };
  };

  if (!snapshot.refreshToken) {
    return markReconnect();
  }

  try {
    const refreshed = await refreshExternalOAuthAccessToken({
      provider: input.provider,
      refreshToken: snapshot.refreshToken,
    });

    // Never overwrite a stored grant with reduced permissions.
    if (
      refreshed.grantedScopes !== null &&
      !snapshot.grantedScopes.every(
        (scope) => refreshed.grantedScopes!.includes(scope)
      )
    ) {
      return markReconnect();
    }

    const updated = await updateRotatedOAuthTokens({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken: snapshot.encryptedAccessToken,
      newAccessToken: refreshed.accessToken,
      newRefreshToken: refreshed.refreshToken,
      expiresIn: refreshed.expiresIn,
    });

    return { status: updated ? 'refreshed' : 'stale' };
  } catch (error) {
    if (
      error instanceof ExternalOAuthRefreshError &&
      error.reconnectRequired
    ) {
      return markReconnect();
    }

    throw error;
  }
}
