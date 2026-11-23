import {
  refreshExternalOAuthAccessToken,
  ExternalOAuthRefreshError,
} from './oauth-external-refresh';

const providers = ['HUBSPOT', 'LINKEDIN'];
const originalEnv = new Map<string, string | undefined>();

for (const provider of providers) {
  for (const field of [
    'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI',
  ]) {
    const key = `${provider}_OAUTH_${field}`;
    originalEnv.set(key, process.env[key]);
  }
}

let fetchMock: jest.SpyInstance;

function reply(
  data: unknown,
  status = 200
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, 'fetch');

  for (const provider of providers) {
    const id = provider.toLowerCase();

    process.env[`${provider}_OAUTH_CLIENT_ID`] = 'test-client';
    process.env[`${provider}_OAUTH_CLIENT_SECRET`] = 'test-secret';
    process.env[`${provider}_OAUTH_REDIRECT_URI`] =
      `http://localhost:3002/api/v1/settings/oauth/${id}/callback`;
  }
});

afterEach(() => {
  fetchMock.mockRestore();
});

afterAll(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('External OAuth refresh exchange', () => {
  test('refreshes HubSpot tokens using configured endpoint', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'new-hubspot-access',
      refresh_token: 'new-hubspot-refresh',
      expires_in: 1800,
      scope: 'crm.objects.contacts.read crm.lists.read',
    }));

    const result = await refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: 'old-refresh',
    });

    expect(result.accessToken).toBe('new-hubspot-access');
    expect(result.refreshToken).toBe('new-hubspot-refresh');
    expect(result.expiresIn).toBe(1800);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://api.hubapi.com/oauth/2026-09/token'
    );

    expect(options.method).toBe('POST');
    expect(options.body.get('grant_type')).toBe('refresh_token');
    expect(options.body.get('refresh_token')).toBe('old-refresh');

    // Secrets must appear only in the POST body.
    expect(url).not.toContain('old-refresh');
    expect(url).not.toContain('test-secret');
  });

  test('refreshes LinkedIn partner credentials', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'new-linkedin-access',
      refresh_token: 'new-linkedin-refresh',
      expires_in: 5184000,
      scope: 'r_ads r_ads_reporting',
    }));

    const result = await refreshExternalOAuthAccessToken({
      provider: 'linkedin',
      refreshToken: 'old-linkedin-refresh',
    });

    expect(result.accessToken).toBe('new-linkedin-access');
    expect(result.refreshToken).toBe('new-linkedin-refresh');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://www.linkedin.com/oauth/v2/accessToken'
    );
  });

  test('supports providers that do not rotate refresh tokens', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'new-access',
      expires_in: 1800,
    }));

    const result = await refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: 'existing-refresh',
    });

    expect(result.refreshToken).toBeNull();
    expect(result.grantedScopes).toBeNull();
  });

  test('rejects invalid_grant and requires reconnection', async () => {
    fetchMock.mockResolvedValue(reply({
      error: 'invalid_grant',
      error_description: 'sensitive provider details',
    }, 400));

    try {
      await refreshExternalOAuthAccessToken({
        provider: 'hubspot',
        refreshToken: 'old-refresh',
      });

      throw new Error('Expected refresh to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ExternalOAuthRefreshError);

      const failure = error as ExternalOAuthRefreshError;

      expect(failure.reconnectRequired).toBe(true);
      expect(failure.message).not.toContain('sensitive');
    }
  });

  test('treats temporary server errors as retryable', async () => {
    fetchMock.mockResolvedValue(reply({
      error: 'private-provider-error',
    }, 503));

    await expect(refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: 'old-refresh',
    })).rejects.toMatchObject({
      reconnectRequired: false,
      message: 'OAuth token refresh failed',
    });
  });

  test('rejects reduced LinkedIn permissions', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'new-access',
      expires_in: 5184000,
      scope: 'r_ads',
    }));

    await expect(refreshExternalOAuthAccessToken({
      provider: 'linkedin',
      refreshToken: 'old-refresh',
    })).rejects.toMatchObject({
      reconnectRequired: true,
    });
  });

  test('rejects missing access tokens', async () => {
    fetchMock.mockResolvedValue(reply({
      expires_in: 1800,
    }));

    await expect(refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: 'old-refresh',
    })).rejects.toThrow('access token missing');
  });

  test('rejects invalid expiration values', async () => {
    fetchMock.mockResolvedValue(reply({
      access_token: 'new-access',
      expires_in: 0,
    }));

    await expect(refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: 'old-refresh',
    })).rejects.toThrow('token lifetime');
  });

  test('does not attempt Google refresh for Mailchimp or Meta', async () => {
    for (const provider of ['mailchimp', 'meta_ads']) {
      await expect(refreshExternalOAuthAccessToken({
        provider: provider as any,
        refreshToken: 'test-refresh',
      })).rejects.toThrow('does not support');
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects missing credentials before network requests', async () => {
    delete process.env.LINKEDIN_OAUTH_CLIENT_SECRET;

    await expect(refreshExternalOAuthAccessToken({
      provider: 'linkedin',
      refreshToken: 'old-refresh',
    })).rejects.toThrow('not configured');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects missing refresh tokens', async () => {
    await expect(refreshExternalOAuthAccessToken({
      provider: 'hubspot',
      refreshToken: '',
    })).rejects.toMatchObject({
      reconnectRequired: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
