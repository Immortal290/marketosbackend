import {
  EXTERNAL_OAUTH_PROVIDERS,
  ExternalOAuthProvider,
  getExternalOAuthCredentials,
} from './oauth-external-providers';

export interface ExternalOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  grantedScopes: string[];
}

function requireAccessToken(data: Record<string, unknown>): string {
  if (
    typeof data.access_token !== 'string' ||
    !data.access_token.trim()
  ) {
    throw new Error('OAuth provider did not return an access token');
  }

  return data.access_token;
}

function parseExpiry(value: unknown, required: boolean): number | null {
  if (value === undefined || value === null) {
    if (required) throw new Error('OAuth token expiration missing');
    return null;
  }

  const seconds = Number(value);

  if (
    !Number.isFinite(seconds) ||
    seconds <= 30 ||
    seconds > 10 * 365 * 24 * 3600
  ) {
    throw new Error('Invalid OAuth token expiration');
  }

  return seconds;
}

function parseScopes(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...new Set(value.split(/[,\s]+/).filter(Boolean))];
  }

  if (
    Array.isArray(value) &&
    value.every((scope) => typeof scope === 'string')
  ) {
    return [...new Set(value.filter(Boolean))];
  }

  // Never assume the requested scopes were actually granted.
  return [];
}

async function requestToken(
  url: string,
  options: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    // Never include provider error bodies, URLs, codes, or secrets.
    throw new Error('OAuth provider token exchange failed');
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error('Invalid OAuth provider token response');
  }

  return data as Record<string, unknown>;
}

export async function exchangeExternalOAuthCode(input: {
  provider: ExternalOAuthProvider;
  code: string;
}): Promise<ExternalOAuthTokens> {
  const config = EXTERNAL_OAUTH_PROVIDERS[input.provider];

  if (!config) {
    throw new Error('Unsupported external OAuth provider');
  }

  if (
    typeof input.code !== 'string' ||
    !input.code.trim() ||
    input.code.length > 8192
  ) {
    throw new Error('Invalid OAuth authorization code');
  }

  const credentials = getExternalOAuthCredentials(input.provider);

  let data: Record<string, unknown>;

  if (input.provider === 'meta_ads') {
    // Meta's server-side authorization code exchange uses GET.
    // Never log these URLs: they contain confidential values.
    const shortUrl = new URL(config.tokenUrl);

    shortUrl.searchParams.set('client_id', credentials.clientId);
    shortUrl.searchParams.set('client_secret', credentials.clientSecret);
    shortUrl.searchParams.set('redirect_uri', credentials.redirectUri);
    shortUrl.searchParams.set('code', input.code);

    const short = await requestToken(
      shortUrl.toString(),
      { method: 'GET' }
    );

    const shortToken = requireAccessToken(short);

    // Never persist the short-lived Meta token.
    const longUrl = new URL(config.tokenUrl);

    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', credentials.clientId);
    longUrl.searchParams.set('client_secret', credentials.clientSecret);
    longUrl.searchParams.set('fb_exchange_token', shortToken);

    data = await requestToken(
      longUrl.toString(),
      { method: 'GET' }
    );
  } else {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: credentials.redirectUri,
      code: input.code,
    });

    data = await requestToken(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
  }

  const accessToken = requireAccessToken(data);

  const refreshToken =
    typeof data.refresh_token === 'string' &&
    data.refresh_token.trim()
      ? data.refresh_token
      : null;

  const expiresIn =
    input.provider === 'mailchimp'
      ? null
      : parseExpiry(data.expires_in, true);

  return {
    accessToken,
    refreshToken,
    expiresIn,
    grantedScopes: parseScopes(data.scope ?? data.scopes),
  };
}
