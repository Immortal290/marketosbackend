import { createOAuthState } from './oauth-state';

export const EXTERNAL_OAUTH_PROVIDERS = {
  mailchimp: {
    authorizationUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopes: [],
    scopeSeparator: ' ',
    tokenLifecycle: 'non_expiring',
  },
  hubspot: {
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/2026-09/token',
    scopes: ['crm.objects.contacts.read', 'crm.lists.read'],
    scopeSeparator: ' ',
    tokenLifecycle: 'refresh_token',
  },
  meta_ads: {
    authorizationUrl: 'https://www.facebook.com/v26.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v26.0/oauth/access_token',
    scopes: ['ads_read'],
    scopeSeparator: ',',
    tokenLifecycle: 'long_lived_exchange',
  },
  linkedin: {
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_ads', 'r_ads_reporting'],
    scopeSeparator: ' ',
    tokenLifecycle: 'reauthorize_or_partner_refresh',
  },
} as const;

export type ExternalOAuthProvider =
  keyof typeof EXTERNAL_OAUTH_PROVIDERS;

export function isExternalOAuthProvider(
  value: string
): value is ExternalOAuthProvider {
  return Object.prototype.hasOwnProperty.call(
    EXTERNAL_OAUTH_PROVIDERS,
    value
  );
}

export function getExternalOAuthCredentials(
  provider: ExternalOAuthProvider
) {
  const prefix = provider.toUpperCase();

  const clientId = process.env[`${prefix}_OAUTH_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_OAUTH_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_OAUTH_REDIRECT_URI`];

  if (!clientId?.trim() || !clientSecret?.trim() ||
      !redirectUri?.trim()) {
    throw new Error(
      `${provider} OAuth credentials or callback are not configured`
    );
  }

  let redirect: URL;

  try {
    redirect = new URL(redirectUri);
  } catch {
    throw new Error('Invalid OAuth callback URL');
  }

  const local =
    redirect.hostname === 'localhost' ||
    redirect.hostname === '127.0.0.1';

  if (
    redirect.protocol !== 'https:' &&
    !(local && redirect.protocol === 'http:')
  ) {
    throw new Error('OAuth callback must use HTTPS');
  }

  if (
    redirect.pathname !==
      `/api/v1/settings/oauth/${provider}/callback` ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password
  ) {
    throw new Error('Invalid OAuth callback destination');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Construct authorization URLs for non-Google providers.
 * OAuth state is stored in the existing Redis-backed,
 * single-use authorization state service.
 *
 * This function does not exchange tokens or store credentials.
 */
export async function createExternalOAuthAuthorizationUrl(input: {
  provider: ExternalOAuthProvider;
  userId: string;
  workspaceId: string;
}): Promise<string> {
  const provider = EXTERNAL_OAUTH_PROVIDERS[input.provider];

  if (!provider) {
    throw new Error('Unsupported external OAuth provider');
  }

  // Validate configuration before creating Redis state.
  const credentials = getExternalOAuthCredentials(input.provider);

  const oauthState = await createOAuthState({
    userId: input.userId,
    workspaceId: input.workspaceId,
    provider: input.provider,
  });

  const url = new URL(provider.authorizationUrl);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', credentials.clientId);
  url.searchParams.set('redirect_uri', credentials.redirectUri);
  url.searchParams.set('state', oauthState.state);

  if (provider.scopes.length > 0) {
    url.searchParams.set(
      'scope',
      provider.scopes.join(provider.scopeSeparator)
    );
  }

  return url.toString();
}
