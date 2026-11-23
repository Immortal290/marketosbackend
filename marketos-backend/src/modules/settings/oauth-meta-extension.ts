import { prisma } from '../../lib/prisma';

import { decryptOAuthToken } from './oauth-crypto';

import {
  EXTERNAL_OAUTH_PROVIDERS,
  getExternalOAuthCredentials,
} from './oauth-external-providers';

import {
  verifyExternalOAuthAccount,
} from './oauth-external-account-verification';

import {
  getOAuthRefreshSnapshot,
  markOAuthReconnectRequired,
  updateRefreshedOAuthAccessToken,
} from './oauth-storage';

import type { OAuthRefreshResult } from './oauth-refresh-service';

export class MetaOAuthExtensionError extends Error {
  constructor(
    message: string,
    public readonly reconnectRequired: boolean
  ) {
    super(message);
    this.name = 'MetaOAuthExtensionError';
  }
}

/**
 * Extend a still-valid Meta user access token.
 *
 * Credentials remain backend-only. Never log the request URL,
 * token, secret, or provider error body.
 */
export async function extendMetaAccessToken(
  accessToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim()
  ) {
    throw new MetaOAuthExtensionError(
      'Meta access token unavailable',
      true
    );
  }

  const credentials = getExternalOAuthCredentials('meta_ads');
  const url = new URL(EXTERNAL_OAUTH_PROVIDERS.meta_ads.tokenUrl);

  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', credentials.clientId);
  url.searchParams.set('client_secret', credentials.clientSecret);
  url.searchParams.set('fb_exchange_token', accessToken);

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new MetaOAuthExtensionError(
      'Meta token service temporarily unavailable',
      false
    );
  }

  if (!response.ok) {
    let providerCode: unknown;

    if (response.status === 400 || response.status === 401) {
      try {
        const error: unknown = await response.json();

        if (error && typeof error === 'object') {
          const details = (error as Record<string, unknown>).error;

          if (details && typeof details === 'object') {
            providerCode =
              (details as Record<string, unknown>).code;
          }
        }
      } catch {
        // Never expose raw provider responses.
      }
    }

    throw new MetaOAuthExtensionError(
      'Meta token extension failed',
      providerCode === 190
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new MetaOAuthExtensionError(
      'Invalid Meta extension response',
      false
    );
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new MetaOAuthExtensionError(
      'Invalid Meta extension response',
      false
    );
  }

  const result = data as Record<string, unknown>;
  const expiresIn = Number(result.expires_in);

  if (
    typeof result.access_token !== 'string' ||
    !result.access_token.trim() ||
    !Number.isSafeInteger(expiresIn) ||
    expiresIn <= 30 ||
    expiresIn > 90 * 24 * 3600
  ) {
    throw new MetaOAuthExtensionError(
      'Invalid Meta extension credentials',
      false
    );
  }

  return {
    accessToken: result.access_token,
    expiresIn,
  };
}

/**
 * Refresh Meta connections before the existing token expires.
 *
 * A token that has already expired cannot be silently extended.
 * It must be reauthorized by its user.
 */
export async function refreshMetaOAuthConnection(input: {
  workspaceId: string;
  connectionId: string;
}): Promise<OAuthRefreshResult> {
  const provider = 'meta_ads';

  const snapshot = await getOAuthRefreshSnapshot(
    input.workspaceId,
    provider,
    input.connectionId
  );

  if (!snapshot) {
    return { status: 'unavailable' };
  }

  const markReconnect = async (): Promise<OAuthRefreshResult> => {
    const marked = await markOAuthReconnectRequired({
      workspaceId: input.workspaceId,
      provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken:
        snapshot.encryptedAccessToken,
    });

    return {
      status: marked ? 'reconnect_required' : 'stale',
    };
  };

  if (!snapshot.tokenExpiresAt) {
    return markReconnect();
  }

  // Extend during the last seven days, not after expiration.
  if (
    snapshot.tokenExpiresAt.getTime() >
    Date.now() + 7 * 24 * 3600 * 1000
  ) {
    return { status: 'not_due' };
  }

  if (
    snapshot.tokenExpiresAt.getTime() <=
    Date.now() + 30_000
  ) {
    return markReconnect();
  }

  const currentToken = decryptOAuthToken(
    snapshot.encryptedAccessToken,
    input.workspaceId,
    provider,
    input.connectionId,
    'access'
  );

  try {
    const renewed = await extendMetaAccessToken(currentToken);

    // Verify the new token against Meta before persisting it.
    const account = await verifyExternalOAuthAccount({
      provider,
      accessToken: renewed.accessToken,
    });

    const stored = await prisma.oAuthConnection.findFirst({
      where: {
        id: input.connectionId,
        workspaceId: input.workspaceId,
        provider,
        connectionStatus: 'ACTIVE',
        encryptedAccessToken:
          snapshot.encryptedAccessToken,
      },
      select: {
        providerAccountId: true,
      },
    });

    if (!stored) {
      return { status: 'stale' };
    }

    if (
      stored.providerAccountId !== account.providerAccountId ||
      !snapshot.grantedScopes.every(
        scope => account.grantedScopes.includes(scope)
      )
    ) {
      return markReconnect();
    }

    const updated = await updateRefreshedOAuthAccessToken({
      workspaceId: input.workspaceId,
      provider,
      connectionId: input.connectionId,
      expectedEncryptedAccessToken:
        snapshot.encryptedAccessToken,
      newAccessToken: renewed.accessToken,
      expiresIn: renewed.expiresIn,
    });

    return {
      status: updated ? 'refreshed' : 'stale',
    };
  } catch (error) {
    if (
      error instanceof MetaOAuthExtensionError &&
      error.reconnectRequired
    ) {
      return markReconnect();
    }

    throw error;
  }
}
