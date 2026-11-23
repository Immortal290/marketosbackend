import { createOAuthState } from './oauth-state';
import {
  EXTERNAL_OAUTH_PROVIDERS,
  createExternalOAuthAuthorizationUrl,
  getExternalOAuthCredentials,
  isExternalOAuthProvider,
  ExternalOAuthProvider,
} from './oauth-external-providers';

jest.mock('./oauth-state', () => ({
  createOAuthState: jest.fn(),
}));

const createState = jest.mocked(createOAuthState);
const providers: ExternalOAuthProvider[] =
  ['mailchimp', 'hubspot', 'meta_ads', 'linkedin'];

const originals = new Map<string, string | undefined>();

for (const provider of providers) {
  for (const suffix of [
    'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI'
  ]) {
    const key = `${provider.toUpperCase()}_OAUTH_${suffix}`;
    originals.set(key, process.env[key]);
  }
}

beforeEach(() => {
  jest.resetAllMocks();

  createState.mockResolvedValue({
    state: 'test-state',
    codeChallenge: 'test-challenge',
    codeChallengeMethod: 'S256',
  });

  for (const provider of providers) {
    const prefix = provider.toUpperCase();
    process.env[`${prefix}_OAUTH_CLIENT_ID`] = 'fake-client-id';
    process.env[`${prefix}_OAUTH_CLIENT_SECRET`] = 'fake-secret';
    process.env[`${prefix}_OAUTH_REDIRECT_URI`] =
      `http://localhost:3002/api/v1/settings/oauth/${provider}/callback`;
  }
});

afterAll(() => {
  for (const [key, value] of originals) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('External OAuth provider authorization', () => {
  test.each(providers)(
    '%s generates the correct HTTPS authorization destination',
    async (provider) => {
      const result = await createExternalOAuthAuthorizationUrl({
        provider,
        userId: 'user-1',
        workspaceId: 'workspace-1',
      });

      const url = new URL(result);

      expect(url.protocol).toBe('https:');
      expect(url.origin + url.pathname).toBe(
        EXTERNAL_OAUTH_PROVIDERS[provider].authorizationUrl
      );
      expect(url.searchParams.get('client_id')).toBe('fake-client-id');
      expect(url.searchParams.get('state')).toBe('test-state');
      expect(url.searchParams.get('response_type')).toBe('code');

      expect(url.searchParams.get('redirect_uri')).toBe(
        `http://localhost:3002/api/v1/settings/oauth/${provider}/callback`
      );

      expect(result).not.toContain('fake-secret');

      expect(createState).toHaveBeenCalledWith({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        provider,
      });
    }
  );

  test('Mailchimp does not request unsupported scopes', async () => {
    const url = new URL(await createExternalOAuthAuthorizationUrl({
      provider: 'mailchimp',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    }));

    expect(url.searchParams.has('scope')).toBe(false);
    expect(
      EXTERNAL_OAUTH_PROVIDERS.mailchimp.tokenLifecycle
    ).toBe('non_expiring');
  });

  test('HubSpot requests read-only CRM permission', async () => {
    const url = new URL(await createExternalOAuthAuthorizationUrl({
      provider: 'hubspot',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    }));

    expect(url.searchParams.get('scope')).toBe(
      'crm.objects.contacts.read crm.lists.read'
    );
    expect(EXTERNAL_OAUTH_PROVIDERS.hubspot.tokenUrl).toContain(
      '/oauth/2026-09/token'
    );
  });

  test('Meta requests only ads_read initially', async () => {
    const url = new URL(await createExternalOAuthAuthorizationUrl({
      provider: 'meta_ads',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    }));

    expect(url.searchParams.get('scope')).toBe('ads_read');
  });

  test('LinkedIn requests approved advertising read scopes', async () => {
    const url = new URL(await createExternalOAuthAuthorizationUrl({
      provider: 'linkedin',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    }));

    expect(url.searchParams.get('scope')).toBe(
      'r_ads r_ads_reporting'
    );
  });

  test('rejects unknown providers', () => {
    expect(isExternalOAuthProvider('gmail')).toBe(false);
    expect(isExternalOAuthProvider('mailchimp')).toBe(true);
    expect(isExternalOAuthProvider('__proto__')).toBe(false);
  });

  test('fails closed when credentials are missing', async () => {
    delete process.env.MAILCHIMP_OAUTH_CLIENT_SECRET;

    await expect(createExternalOAuthAuthorizationUrl({
      provider: 'mailchimp',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    })).rejects.toThrow('not configured');

    expect(createState).not.toHaveBeenCalled();
  });

  test('rejects insecure remote callbacks', () => {
    process.env.LINKEDIN_OAUTH_REDIRECT_URI =
      'http://example.com/api/v1/settings/oauth/linkedin/callback';

    expect(() =>
      getExternalOAuthCredentials('linkedin')
    ).toThrow('must use HTTPS');
  });

  test('rejects callbacks pointing to unexpected paths', () => {
    process.env.HUBSPOT_OAUTH_REDIRECT_URI =
      'https://example.com/untrusted/callback';

    expect(() =>
      getExternalOAuthCredentials('hubspot')
    ).toThrow('Invalid OAuth callback destination');
  });
});
