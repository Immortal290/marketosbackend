import {
  OAUTH_PROVIDERS,
  ConfiguredOAuthProvider,
  getGoogleOAuthCredentials,
} from './oauth-providers';

import { createOAuthState } from './oauth-state';

export async function createGoogleAuthorizationUrl(input: {
  userId: string;
  workspaceId: string;
  provider: ConfiguredOAuthProvider;
}): Promise<string> {
  const config = OAUTH_PROVIDERS[input.provider];

  if (config.family !== 'google') {
    throw new Error('Unsupported Google OAuth provider');
  }

  const { clientId } = getGoogleOAuthCredentials();

  const redirectUri = getValidatedGoogleRedirectUri();

  const { state, codeChallenge, codeChallengeMethod } =
    await createOAuthState(input);

  const url = new URL(config.authorizationUrl);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');

  return url.toString();
}

export interface GoogleOAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  grantedScopes: string[];
  idToken?: string;
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleOAuthTokenResponse> {
  if (!input.code?.trim() || !input.codeVerifier?.trim()) {
    throw new Error('OAuth authorization code and PKCE verifier are required');
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeVerifier)) {
    throw new Error('Invalid PKCE verifier');
  }

  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  const redirectUri = getValidatedGoogleRedirectUri();

  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: input.codeVerifier,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed (${response.status})`);
  }

  const data: unknown = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Google OAuth token response');
  }

  const token = data as Record<string, unknown>;

  if (
    typeof token.access_token !== 'string' ||
    !token.access_token.trim()
  ) {
    throw new Error('Google OAuth access token missing');
  }

  if (
    token.token_type !== undefined &&
    token.token_type !== 'Bearer'
  ) {
    throw new Error('Unsupported Google OAuth token type');
  }

  return {
    accessToken: token.access_token,
    refreshToken:
      typeof token.refresh_token === 'string'
        ? token.refresh_token
        : undefined,
    expiresIn:
      typeof token.expires_in === 'number' &&
      Number.isFinite(token.expires_in) &&
      token.expires_in > 0
        ? token.expires_in
        : undefined,
    grantedScopes:
      typeof token.scope === 'string'
        ? token.scope.split(/\s+/).filter(Boolean)
        : [],
    idToken:
      typeof token.id_token === 'string'
        ? token.id_token
        : undefined,
  };
}
export interface VerifiedGoogleOAuthAccount {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
}

export async function verifyGoogleOAuthAccount(
  idToken: string
): Promise<VerifiedGoogleOAuthAccount> {
  if (!idToken?.trim()) {
    throw new Error('Google identity token is required');
  }

  const { OAuth2Client } = await import('google-auth-library');
  const { clientId } = getGoogleOAuthCredentials();

  const client = new OAuth2Client(clientId);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.email !== 'string' ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    throw new Error('Google account identity could not be verified');
  }

  return {
    providerAccountId: payload.sub,
    email: payload.email,
    emailVerified: true,
  };
}
export function getValidatedGoogleRedirectUri(): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!configured) {
    throw new Error('GOOGLE_OAUTH_REDIRECT_URI is not configured');
  }

  let url: URL;

  try {
    url = new URL(configured);
  } catch {
    throw new Error('Invalid GOOGLE_OAUTH_REDIRECT_URI');
  }

  const expectedPath = '/api/v1/settings/oauth/google/callback';

  if (
    url.pathname !== expectedPath ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)))
  ) {
    throw new Error('Invalid Google OAuth callback configuration');
  }

  return url.toString();
}
export class GoogleOAuthRefreshError extends Error {
  constructor(
    message: string,
    public readonly reconnectRequired: boolean
  ) {
    super(message);
    this.name = 'GoogleOAuthRefreshError';
  }
}

export interface GoogleOAuthRefreshResult {
  accessToken: string;
  expiresIn: number;
  grantedScopes?: string[];
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<GoogleOAuthRefreshResult> {
  if (!refreshToken?.trim()) {
    throw new GoogleOAuthRefreshError(
      'Google OAuth refresh token is unavailable',
      true
    );
  }

  const { clientId, clientSecret } = getGoogleOAuthCredentials();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorCode =
      data && typeof data === 'object' &&
      typeof (data as Record<string, unknown>).error === 'string'
        ? (data as Record<string, string>).error
        : undefined;

    throw new GoogleOAuthRefreshError(
      errorCode === 'invalid_grant'
        ? 'Google authorization expired or was revoked'
        : 'Google OAuth token refresh failed',
      errorCode === 'invalid_grant'
    );
  }

  if (!data || typeof data !== 'object') {
    throw new GoogleOAuthRefreshError(
      'Invalid Google OAuth refresh response',
      false
    );
  }

  const token = data as Record<string, unknown>;

  if (
    typeof token.access_token !== 'string' ||
    !token.access_token.trim() ||
    typeof token.expires_in !== 'number' ||
    !Number.isFinite(token.expires_in) ||
    token.expires_in <= 0 ||
    (token.token_type !== undefined && token.token_type !== 'Bearer')
  ) {
    throw new GoogleOAuthRefreshError(
      'Google OAuth refresh response missing required fields',
      false
    );
  }

  return {
    accessToken: token.access_token,
    expiresIn: token.expires_in,
    grantedScopes:
      typeof token.scope === 'string'
        ? token.scope.split(/\s+/).filter(Boolean)
        : undefined,
  };
}
