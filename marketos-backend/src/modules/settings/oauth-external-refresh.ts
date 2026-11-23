import {
  EXTERNAL_OAUTH_PROVIDERS,
  getExternalOAuthCredentials,
} from './oauth-external-providers';

export type RefreshableExternalProvider = 'hubspot' | 'linkedin';

export interface ExternalRefreshTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  grantedScopes: string[] | null;
}

export class ExternalOAuthRefreshError extends Error {
  constructor(
    message: string,
    public readonly reconnectRequired: boolean
  ) {
    super(message);
    this.name = 'ExternalOAuthRefreshError';
  }
}

function parseScopes(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    return [...new Set(value.split(/[,\s]+/).filter(Boolean))];
  }

  if (
    Array.isArray(value) &&
    value.every((scope) => typeof scope === 'string')
  ) {
    return [...new Set(value.filter(Boolean))];
  }

  throw new ExternalOAuthRefreshError(
    'Invalid refreshed OAuth permissions',
    true
  );
}

/**
 * Backend-only refresh-token exchange.
 *
 * Does not update PostgreSQL. The caller must atomically
 * persist new encrypted access/refresh tokens before use.
 */
export async function refreshExternalOAuthAccessToken(input: {
  provider: RefreshableExternalProvider;
  refreshToken: string;
}): Promise<ExternalRefreshTokens> {
  if (
    input.provider !== 'hubspot' &&
    input.provider !== 'linkedin'
  ) {
    throw new ExternalOAuthRefreshError(
      'Provider does not support this refresh flow',
      true
    );
  }

  if (
    typeof input.refreshToken !== 'string' ||
    !input.refreshToken.trim() ||
    input.refreshToken.length > 16384
  ) {
    throw new ExternalOAuthRefreshError(
      'OAuth refresh token unavailable',
      true
    );
  }

  const config = EXTERNAL_OAUTH_PROVIDERS[input.provider];
  const credentials = getExternalOAuthCredentials(input.provider);

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  let response: Response;

  try {
    response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ExternalOAuthRefreshError(
      'OAuth provider temporarily unavailable',
      false
    );
  }

  if (!response.ok) {
    let errorCode: unknown = null;

    if (response.status === 400 || response.status === 401) {
      try {
        const body: unknown = await response.json();

        if (body && typeof body === 'object') {
          errorCode = (body as Record<string, unknown>).error;
        }
      } catch {
        // No provider error body is exposed or logged.
      }
    }

    if (errorCode === 'invalid_grant') {
      throw new ExternalOAuthRefreshError(
        'OAuth authorization expired or revoked',
        true
      );
    }

    throw new ExternalOAuthRefreshError(
      'OAuth token refresh failed',
      false
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new ExternalOAuthRefreshError(
      'Invalid OAuth refresh response',
      false
    );
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ExternalOAuthRefreshError(
      'Invalid OAuth refresh response',
      false
    );
  }

  const result = data as Record<string, unknown>;

  if (
    typeof result.access_token !== 'string' ||
    !result.access_token.trim()
  ) {
    throw new ExternalOAuthRefreshError(
      'Refreshed OAuth access token missing',
      false
    );
  }

  const expiresIn = Number(result.expires_in);

  if (
    !Number.isSafeInteger(expiresIn) ||
    expiresIn <= 30 ||
    expiresIn > 366 * 24 * 3600
  ) {
    throw new ExternalOAuthRefreshError(
      'Invalid refreshed OAuth token lifetime',
      false
    );
  }

  const scopes = parseScopes(result.scope ?? result.scopes);

  // Never silently accept permissions that have been reduced.
  if (
    scopes !== null &&
    !config.scopes.every((scope) => scopes.includes(scope))
  ) {
    throw new ExternalOAuthRefreshError(
      'OAuth permissions changed; reconnection required',
      true
    );
  }

  const refreshToken =
    typeof result.refresh_token === 'string' &&
    result.refresh_token.trim()
      ? result.refresh_token
      : null;

  return {
    accessToken: result.access_token,
    refreshToken,
    expiresIn,
    grantedScopes: scopes,
  };
}
