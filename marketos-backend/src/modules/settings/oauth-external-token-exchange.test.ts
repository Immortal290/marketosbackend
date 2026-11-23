import { exchangeExternalOAuthCode } from './oauth-external-token-exchange';

const providers = ['mailchimp', 'hubspot', 'meta_ads', 'linkedin'];

const savedEnv = new Map<string, string | undefined>();

for (const provider of providers) {
  for (const suffix of ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI']) {
    const key = `${provider.toUpperCase()}_OAUTH_${suffix}`;
    savedEnv.set(key, process.env[key]);
  }
}

let fetchMock: jest.SpyInstance;

function reply(data: unknown, ok = true): Response {
  return {
    ok,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, 'fetch');

  for (const provider of providers) {
    const prefix = provider.toUpperCase();
    process.env[`${prefix}_OAUTH_CLIENT_ID`] = 'test-client';
    process.env[`${prefix}_OAUTH_CLIENT_SECRET`] = 'test-secret';
    process.env[`${prefix}_OAUTH_REDIRECT_URI`] =
      `http://localhost:3002/api/v1/settings/oauth/${provider}/callback`;
  }
});

afterEach(() => {
  fetchMock.mockRestore();
});

afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('External OAuth token exchange', () => {
  test('Mailchimp stores a non-expiring token', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'mailchimp-access',
    }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'mailchimp',
      code: 'test-code',
    });

    expect(tokens).toEqual({
      accessToken: 'mailchimp-access',
      refreshToken: null,
      expiresIn: null,
      grantedScopes: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('HubSpot exchanges code using v3 POST endpoint', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'hubspot-access',
      refresh_token: 'hubspot-refresh',
      expires_in: 1800,
      scope: 'crm.objects.contacts.read',
    }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'hubspot',
      code: 'test-code',
    });

    expect(tokens.expiresIn).toBe(1800);
    expect(tokens.refreshToken).toBe('hubspot-refresh');
    expect(tokens.grantedScopes).toContain(
      'crm.objects.contacts.read'
    );

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://api.hubapi.com/oauth/2026-09/token'
    );
    expect(options.method).toBe('POST');
    expect(options.body.get('grant_type')).toBe(
      'authorization_code'
    );
  });

  test('LinkedIn preserves returned scopes and refresh token', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'linkedin-access',
      refresh_token: 'linkedin-refresh',
      expires_in: 5184000,
      scope: 'r_ads r_ads_reporting',
    }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'linkedin',
      code: 'test-code',
    });

    expect(tokens.refreshToken).toBe('linkedin-refresh');
    expect(tokens.grantedScopes).toEqual([
      'r_ads',
      'r_ads_reporting',
    ]);
  });

  test('LinkedIn works without partner refresh-token approval', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'linkedin-access',
      expires_in: 5184000,
    }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'linkedin',
      code: 'test-code',
    });

    expect(tokens.refreshToken).toBeNull();
    expect(tokens.grantedScopes).toEqual([]);
  });

  test('Meta exchanges a short token for a long-lived token', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({
        access_token: 'temporary-meta-token',
      }))
      .mockResolvedValueOnce(reply({
        access_token: 'long-lived-meta-token',
        expires_in: 5184000,
      }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'meta_ads',
      code: 'test-code',
    });

    expect(tokens.accessToken).toBe('long-lived-meta-token');
    expect(tokens.expiresIn).toBe(5184000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondUrl = new URL(fetchMock.mock.calls[1][0]);

    expect(secondUrl.searchParams.get('grant_type')).toBe(
      'fb_exchange_token'
    );

    expect(secondUrl.searchParams.get('fb_exchange_token')).toBe(
      'temporary-meta-token'
    );
  });

  test('fails closed when credentials are missing', async () => {
    delete process.env.HUBSPOT_OAUTH_CLIENT_SECRET;

    await expect(exchangeExternalOAuthCode({
      provider: 'hubspot',
      code: 'test-code',
    })).rejects.toThrow('not configured');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects invalid authorization codes', async () => {
    await expect(exchangeExternalOAuthCode({
      provider: 'mailchimp',
      code: '',
    })).rejects.toThrow('Invalid OAuth authorization code');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('does not expose provider error bodies', async () => {
    fetchMock.mockResolvedValue(reply({
      error: 'secret-provider-error',
    }, false));

    await expect(exchangeExternalOAuthCode({
      provider: 'mailchimp',
      code: 'test-code',
    })).rejects.toThrow('OAuth provider token exchange failed');
  });

  test('rejects an expired or invalid token lifetime', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'hubspot-access',
      expires_in: 0,
    }));

    await expect(exchangeExternalOAuthCode({
      provider: 'hubspot',
      code: 'test-code',
    })).rejects.toThrow('Invalid OAuth token expiration');
  });

  test('rejects missing expiration on expiring providers', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'linkedin-access',
    }));

    await expect(exchangeExternalOAuthCode({
      provider: 'linkedin',
      code: 'test-code',
    })).rejects.toThrow('OAuth token expiration missing');
  });

  test('rejects missing access tokens', async () => {
    fetchMock.mockResolvedValue(reply({
      expires_in: 3600,
    }));

    await expect(exchangeExternalOAuthCode({
      provider: 'hubspot',
      code: 'test-code',
    })).rejects.toThrow('did not return an access token');
  });

  test('does not assume requested permissions were granted', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'hubspot-access',
      expires_in: 1800,
    }));

    const tokens = await exchangeExternalOAuthCode({
      provider: 'hubspot',
      code: 'test-code',
    });

    expect(tokens.grantedScopes).toEqual([]);
  });
});
