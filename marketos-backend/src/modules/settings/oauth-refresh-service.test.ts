import {
  refreshGoogleOAuthConnection,
} from './oauth-refresh-service';

import {
  getOAuthRefreshSnapshot,
  updateRefreshedOAuthAccessToken,
  markOAuthReconnectRequired,
} from './oauth-storage';

import {
  refreshGoogleAccessToken,
  GoogleOAuthRefreshError,
} from './oauth-google';

jest.mock('./oauth-storage', () => ({
  getOAuthRefreshSnapshot: jest.fn(),
  updateRefreshedOAuthAccessToken: jest.fn(),
  markOAuthReconnectRequired: jest.fn(),
}));

jest.mock('./oauth-google', () => ({
  refreshGoogleAccessToken: jest.fn(),
  GoogleOAuthRefreshError: class extends Error {
    constructor(
      message: string,
      public readonly reconnectRequired: boolean
    ) {
      super(message);
      this.name = 'GoogleOAuthRefreshError';
    }
  },
}));

const getSnapshot = jest.mocked(getOAuthRefreshSnapshot);
const updateToken = jest.mocked(updateRefreshedOAuthAccessToken);
const markReconnect = jest.mocked(markOAuthReconnectRequired);
const refreshToken = jest.mocked(refreshGoogleAccessToken);

const input = {
  workspaceId: 'test-workspace',
  provider: 'gmail',
  connectionId: 'test-connection',
};

const snapshot = {
  encryptedAccessToken: 'fake-old-ciphertext',
  refreshToken: 'fake-refresh-token',
  tokenExpiresAt: new Date(Date.now() - 60000),
  grantedScopes: [
    'openid',
    'email',
    'https://www.googleapis.com/auth/gmail.send',
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  getSnapshot.mockResolvedValue({ ...snapshot });
  markReconnect.mockResolvedValue(true);
  updateToken.mockResolvedValue(true);
  refreshToken.mockResolvedValue({
    accessToken: 'fake-new-access-token',
    expiresIn: 3600,
  });
});

describe('Google OAuth refresh service', () => {
  test('refreshes and conditionally stores the encrypted token', async () => {
    const result = await refreshGoogleOAuthConnection(input);

    expect(result).toEqual({ status: 'refreshed' });
    expect(updateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: input.workspaceId,
        provider: 'gmail',
        connectionId: input.connectionId,
        expectedEncryptedAccessToken: 'fake-old-ciphertext',
        newAccessToken: 'fake-new-access-token',
        expiresIn: 3600,
      })
    );
  });

  test('does not refresh a token that is not due', async () => {
    getSnapshot.mockResolvedValue({
      ...snapshot,
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'not_due' });

    expect(refreshToken).not.toHaveBeenCalled();
    expect(updateToken).not.toHaveBeenCalled();
  });

  test('marks revoked authorization for reconnection', async () => {
    refreshToken.mockRejectedValue(
      new GoogleOAuthRefreshError('Revoked', true)
    );

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(markReconnect).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedEncryptedAccessToken: 'fake-old-ciphertext',
      })
    );
  });

  test('marks missing refresh tokens for reconnection', async () => {
    getSnapshot.mockResolvedValue({
      ...snapshot,
      refreshToken: null,
    });

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(markReconnect).toHaveBeenCalledTimes(1);
    expect(refreshToken).not.toHaveBeenCalled();
  });

  test('rejects stale refresh updates', async () => {
    updateToken.mockResolvedValue(false);

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'stale' });
  });

  test('does not overwrite a newer connection on revocation', async () => {
    refreshToken.mockRejectedValue(
      new GoogleOAuthRefreshError('Revoked', true)
    );
    markReconnect.mockResolvedValue(false);

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'stale' });
  });

  test('does not silently accept missing permissions', async () => {
    refreshToken.mockResolvedValue({
      accessToken: 'fake-new-access-token',
      expiresIn: 3600,
      grantedScopes: ['openid', 'email'],
    });

    expect(await refreshGoogleOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(markReconnect).toHaveBeenCalledTimes(1);
    expect(updateToken).not.toHaveBeenCalled();
  });

  test('does not mark temporary Google errors as revoked', async () => {
    refreshToken.mockRejectedValue(
      new GoogleOAuthRefreshError('Temporary failure', false)
    );

    await expect(refreshGoogleOAuthConnection(input))
      .rejects.toThrow('Temporary failure');

    expect(markReconnect).not.toHaveBeenCalled();
  });
});
