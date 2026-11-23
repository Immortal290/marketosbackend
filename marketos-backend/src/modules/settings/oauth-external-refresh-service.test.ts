import {
  refreshExternalOAuthConnection,
} from './oauth-external-refresh-service';

import {
  getOAuthRefreshSnapshot,
  updateRotatedOAuthTokens,
  markOAuthReconnectRequired,
} from './oauth-storage';

import {
  refreshExternalOAuthAccessToken,
  ExternalOAuthRefreshError,
} from './oauth-external-refresh';

jest.mock('./oauth-storage', () => ({
  getOAuthRefreshSnapshot: jest.fn(),
  updateRotatedOAuthTokens: jest.fn(),
  markOAuthReconnectRequired: jest.fn(),
}));

jest.mock('./oauth-external-refresh', () => {
  const actual = jest.requireActual('./oauth-external-refresh');

  return {
    ...actual,
    refreshExternalOAuthAccessToken: jest.fn(),
  };
});

const snapshot = jest.mocked(getOAuthRefreshSnapshot);
const rotate = jest.mocked(updateRotatedOAuthTokens);
const mark = jest.mocked(markOAuthReconnectRequired);
const exchange = jest.mocked(refreshExternalOAuthAccessToken);

const input = {
  workspaceId: 'workspace-1',
  provider: 'hubspot' as const,
  connectionId: 'connection-1',
};

function expiredSnapshot() {
  return {
    encryptedAccessToken: 'previous-encrypted-access',
    refreshToken: 'previous-private-refresh',
    grantedScopes: ['crm.objects.contacts.read'],
    tokenExpiresAt: new Date(Date.now() - 60000),
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  snapshot.mockResolvedValue(expiredSnapshot());

  rotate.mockResolvedValue(true);
  mark.mockResolvedValue(true);

  exchange.mockResolvedValue({
    accessToken: 'new-private-access',
    refreshToken: 'new-private-refresh',
    expiresIn: 1800,
    grantedScopes: ['crm.objects.contacts.read'],
  });
});

describe('HubSpot and LinkedIn connection refresh service', () => {
  test('rotates both credentials using scoped CAS update', async () => {
    const result = await refreshExternalOAuthConnection(input);

    expect(result).toEqual({ status: 'refreshed' });

    expect(exchange).toHaveBeenCalledWith({
      provider: 'hubspot',
      refreshToken: 'previous-private-refresh',
    });

    expect(rotate).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'hubspot',
      connectionId: 'connection-1',
      expectedEncryptedAccessToken: 'previous-encrypted-access',
      newAccessToken: 'new-private-access',
      newRefreshToken: 'new-private-refresh',
      expiresIn: 1800,
    });
  });

  test('skips refresh when token is not due', async () => {
    snapshot.mockResolvedValue({
      ...expiredSnapshot(),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'not_due' });

    expect(exchange).not.toHaveBeenCalled();
  });

  test('preserves existing refresh token when rotation omitted', async () => {
    exchange.mockResolvedValue({
      accessToken: 'new-private-access',
      refreshToken: null,
      expiresIn: 1800,
      grantedScopes: null,
    });

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'refreshed' });

    expect(rotate).toHaveBeenCalledWith(
      expect.objectContaining({ newRefreshToken: null })
    );
  });

  test('marks connections without refresh tokens', async () => {
    snapshot.mockResolvedValue({
      ...expiredSnapshot(),
      refreshToken: null,
    });

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(mark).toHaveBeenCalled();
    expect(exchange).not.toHaveBeenCalled();
  });

  test('reports unavailable connections', async () => {
    snapshot.mockResolvedValue(null);

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'unavailable' });

    expect(exchange).not.toHaveBeenCalled();
  });

  test('does not overwrite newer credentials', async () => {
    rotate.mockResolvedValue(false);

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'stale' });
  });

  test('requires reconnection on invalid_grant', async () => {
    exchange.mockRejectedValue(
      new ExternalOAuthRefreshError('Grant revoked', true)
    );

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(rotate).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalled();
  });

  test('rejects reduced granted permissions', async () => {
    exchange.mockResolvedValue({
      accessToken: 'new-private-access',
      refreshToken: null,
      expiresIn: 1800,
      grantedScopes: [],
    });

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(rotate).not.toHaveBeenCalled();
  });

  test('propagates temporary provider failures', async () => {
    exchange.mockRejectedValue(
      new ExternalOAuthRefreshError('Temporary failure', false)
    );

    await expect(refreshExternalOAuthConnection(input))
      .rejects.toThrow('Temporary failure');

    expect(mark).not.toHaveBeenCalled();
  });

  test('requires reconnection for LinkedIn without a refresh token', async () => {
    snapshot.mockResolvedValue({
      ...expiredSnapshot(),
      refreshToken: null,
    });

    expect(await refreshExternalOAuthConnection({
      ...input,
      provider: 'linkedin',
    })).toEqual({ status: 'reconnect_required' });

    expect(exchange).not.toHaveBeenCalled();
  });

  test('rejects unsupported provider families', async () => {
    await expect(refreshExternalOAuthConnection({
      ...input,
      provider: 'meta_ads' as any,
    })).rejects.toThrow('Unsupported');

    expect(snapshot).not.toHaveBeenCalled();
  });

  test('does not overwrite a newer grant after invalidation', async () => {
    exchange.mockRejectedValue(
      new ExternalOAuthRefreshError('Revoked', true)
    );
    mark.mockResolvedValue(false);

    expect(await refreshExternalOAuthConnection(input))
      .toEqual({ status: 'stale' });
  });
});
