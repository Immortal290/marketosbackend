import { verifyExternalOAuthAccount } from './oauth-external-account-verification';

const providers = ['HUBSPOT', 'META_ADS', 'LINKEDIN'];
const oldEnv = new Map<string, string | undefined>();

for (const provider of providers) {
  for (const suffix of ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI']) {
    const key = `${provider}_OAUTH_${suffix}`;
    oldEnv.set(key, process.env[key]);
  }
}

let fetchMock: jest.SpyInstance;

function response(data: unknown, ok = true): Response {
  return {
    ok,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, 'fetch');

  for (const provider of providers) {
    const prefix = provider.toLowerCase();
    process.env[`${provider}_OAUTH_CLIENT_ID`] = 'test-client';
    process.env[`${provider}_OAUTH_CLIENT_SECRET`] = 'test-secret';
    process.env[`${provider}_OAUTH_REDIRECT_URI`] =
      `http://localhost:3002/api/v1/settings/oauth/${prefix}/callback`;
  }
});

afterEach(() => fetchMock.mockRestore());

afterAll(() => {
  for (const [key, value] of oldEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('External OAuth account verification', () => {
  test('verifies Mailchimp account and data center', async () => {
    fetchMock.mockResolvedValue(response({
      user_id: 12345,
      dc: 'us6',
      accountname: 'Example Marketing',
    }));

    const result = await verifyExternalOAuthAccount({
      provider: 'mailchimp',
      accessToken: 'fake-access',
    });

    expect(result.providerAccountId).toBe('12345');
    expect(result.dataCenter).toBe('us6');
    expect(result.accountLabel).toBe('Example Marketing');
    expect(result.grantedScopes).toEqual([]);

    expect(fetchMock.mock.calls[0][1].headers.Authorization)
      .toBe('OAuth fake-access');
  });

  test('rejects unsafe Mailchimp data centers', async () => {
    fetchMock.mockResolvedValue(response({
      user_id: 12345,
      dc: 'evil.example.com',
    }));

    await expect(verifyExternalOAuthAccount({
      provider: 'mailchimp',
      accessToken: 'fake-access',
    })).rejects.toThrow('Invalid Mailchimp data center');
  });

  test('verifies HubSpot account and approved scopes', async () => {
    fetchMock.mockResolvedValue(response({
      active: true,
      client_id: 'test-client',
      hub_id: 778899,
      hub_domain: 'example.com',
      scopes: ['crm.objects.contacts.read'],
    }));

    const result = await verifyExternalOAuthAccount({
      provider: 'hubspot',
      accessToken: 'fake-access',
    });

    expect(result.providerAccountId).toBe('778899');
    expect(result.grantedScopes).toEqual([
      'crm.objects.contacts.read',
    ]);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.hubapi.com/oauth/2026-09/token/introspect'
    );
  });

  test('rejects HubSpot tokens without required permission', async () => {
    fetchMock.mockResolvedValue(response({
      active: true,
      client_id: 'test-client',
      hub_id: 778899,
      scopes: [],
    }));

    await expect(verifyExternalOAuthAccount({
      provider: 'hubspot',
      accessToken: 'fake-access',
    })).rejects.toThrow('Required OAuth permissions not granted');
  });

  test('verifies Meta token and ads_read permission', async () => {
    fetchMock.mockResolvedValue(response({
      data: {
        is_valid: true,
        app_id: 'test-client',
        type: 'USER',
        user_id: '45678',
        scopes: ['ads_read'],
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    }));

    const result = await verifyExternalOAuthAccount({
      provider: 'meta_ads',
      accessToken: 'fake-access',
    });

    expect(result.providerAccountId).toBe('45678');
    expect(result.grantedScopes).toContain('ads_read');
  });

  test('rejects Meta tokens belonging to another app', async () => {
    fetchMock.mockResolvedValue(response({
      data: {
        is_valid: true,
        app_id: 'another-app',
        type: 'USER',
        user_id: '45678',
        scopes: ['ads_read'],
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    }));

    await expect(verifyExternalOAuthAccount({
      provider: 'meta_ads',
      accessToken: 'fake-access',
    })).rejects.toThrow('Meta OAuth token verification failed');
  });

  test('verifies LinkedIn permissions and ad accounts', async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        active: true,
        client_id: 'test-client',
        auth_type: '3L',
        scope: 'r_ads,r_ads_reporting',
      }))
      .mockResolvedValueOnce(response({
        elements: [{
          user: 'urn:li:person:abc123',
          account: 'urn:li:sponsoredAccount:123456',
        }],
      }));

    const result = await verifyExternalOAuthAccount({
      provider: 'linkedin',
      accessToken: 'fake-access',
    });

    expect(result.providerAccountId).toBe(
      'urn:li:person:abc123'
    );
    expect(result.availableAssets).toEqual([
      'urn:li:sponsoredAccount:123456',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('rejects LinkedIn tokens without reporting scope', async () => {
    fetchMock.mockResolvedValue(response({
      active: true,
      client_id: 'test-client',
      scope: 'r_ads',
    }));

    await expect(verifyExternalOAuthAccount({
      provider: 'linkedin',
      accessToken: 'fake-access',
    })).rejects.toThrow('Required OAuth permissions not granted');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('rejects LinkedIn accounts without verified ownership', async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        active: true,
        client_id: 'test-client',
        scope: 'r_ads,r_ads_reporting',
      }))
      .mockResolvedValueOnce(response({
        elements: [{
          account: 'urn:li:sponsoredAccount:123456',
        }],
      }));

    await expect(verifyExternalOAuthAccount({
      provider: 'linkedin',
      accessToken: 'fake-access',
    })).rejects.toThrow('Invalid LinkedIn account ownership');
  });

  test('does not disclose failed provider response bodies', async () => {
    fetchMock.mockResolvedValue(
      response({ secret: 'provider-secret' }, false)
    );

    await expect(verifyExternalOAuthAccount({
      provider: 'mailchimp',
      accessToken: 'fake-access',
    })).rejects.toThrow('OAuth account verification failed');
  });
});
