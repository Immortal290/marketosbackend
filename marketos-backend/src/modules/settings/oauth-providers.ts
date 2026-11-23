export const OAUTH_PROVIDERS = {
  gmail: {
    family: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  },
  ga4: {
    family: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  },
  google_ads: {
    family: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/adwords',
    ],
  },
} as const;

export type ConfiguredOAuthProvider = keyof typeof OAUTH_PROVIDERS;

export function isConfiguredOAuthProvider(
  provider: string
): provider is ConfiguredOAuthProvider {
  return Object.prototype.hasOwnProperty.call(
    OAUTH_PROVIDERS,
    provider
  );
}

export function getGoogleOAuthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  return { clientId, clientSecret };
}
