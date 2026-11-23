import {
  refreshGoogleAccessToken,
} from './oauth-google';

describe('Google OAuth access-token refresh', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let originalClientId: string | undefined;
  let originalClientSecret: string | undefined;

  beforeEach(() => {
    originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    originalClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    process.env.GOOGLE_OAUTH_CLIENT_ID = 'local-test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'local-test-secret';

    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();

    if (originalClientId === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = originalClientSecret;
    }
  });

  function mockResponse(status: number, body: unknown) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  }

  test('successfully refreshes an access token', async () => {
    mockResponse(200, {
      access_token: 'new-test-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email',
    });

    const result = await refreshGoogleAccessToken(
      'fake-refresh-token'
    );

    expect(result).toEqual({
      accessToken: 'new-test-access-token',
      expiresIn: 3600,
      grantedScopes: ['openid', 'email'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(options?.method).toBe('POST');

    const body = options?.body as URLSearchParams;

    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('fake-refresh-token');
    expect(body.get('client_id')).toBe('local-test-client-id');
  });

  test('requires reconnection for revoked authorization', async () => {
    mockResponse(400, { error: 'invalid_grant' });

    await expect(
      refreshGoogleAccessToken('revoked-test-token')
    ).rejects.toMatchObject({
      name: 'GoogleOAuthRefreshError',
      reconnectRequired: true,
    });
  });

  test('does not require reconnection for temporary provider errors', async () => {
    mockResponse(503, { error: 'temporarily_unavailable' });

    await expect(
      refreshGoogleAccessToken('fake-refresh-token')
    ).rejects.toMatchObject({
      name: 'GoogleOAuthRefreshError',
      reconnectRequired: false,
    });
  });

  test('rejects invalid refresh responses', async () => {
    mockResponse(200, {
      access_token: '',
      expires_in: -1,
    });

    await expect(
      refreshGoogleAccessToken('fake-refresh-token')
    ).rejects.toMatchObject({
      name: 'GoogleOAuthRefreshError',
      reconnectRequired: false,
    });
  });

  test('rejects missing refresh tokens without contacting Google', async () => {
    await expect(
      refreshGoogleAccessToken('')
    ).rejects.toMatchObject({
      name: 'GoogleOAuthRefreshError',
      reconnectRequired: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
