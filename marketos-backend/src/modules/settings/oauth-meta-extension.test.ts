import { prisma } from '../../lib/prisma';
import { decryptOAuthToken } from './oauth-crypto';

import {
  extendMetaAccessToken,
  refreshMetaOAuthConnection,
} from './oauth-meta-extension';

import {
  getOAuthRefreshSnapshot,
  markOAuthReconnectRequired,
  updateRefreshedOAuthAccessToken,
} from './oauth-storage';

import {
  verifyExternalOAuthAccount,
} from './oauth-external-account-verification';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('./oauth-crypto', () => ({
  decryptOAuthToken: jest.fn(),
}));

jest.mock('./oauth-storage', () => ({
  getOAuthRefreshSnapshot: jest.fn(),
  markOAuthReconnectRequired: jest.fn(),
  updateRefreshedOAuthAccessToken: jest.fn(),
}));

jest.mock('./oauth-external-account-verification', () => ({
  verifyExternalOAuthAccount: jest.fn(),
}));

const snapshot = jest.mocked(getOAuthRefreshSnapshot);
const mark = jest.mocked(markOAuthReconnectRequired);
const update = jest.mocked(updateRefreshedOAuthAccessToken);
const decrypt = jest.mocked(decryptOAuthToken);
const verify = jest.mocked(verifyExternalOAuthAccount);
const findConnection = jest.mocked(
  prisma.oAuthConnection.findFirst
);

const originalEnv = {
  id: process.env.META_ADS_OAUTH_CLIENT_ID,
  secret: process.env.META_ADS_OAUTH_CLIENT_SECRET,
  redirect: process.env.META_ADS_OAUTH_REDIRECT_URI,
};

let fetchMock: jest.SpyInstance;

const input = {
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
};

function refreshSnapshot(daysUntilExpiry: number) {
  return {
    encryptedAccessToken: 'encrypted-old-access',
    refreshToken: null,
    grantedScopes: ['ads_read'],
    tokenExpiresAt: new Date(
      Date.now() + daysUntilExpiry * 24 * 3600 * 1000
    ),
  };
}

function reply(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  jest.resetAllMocks();

  process.env.META_ADS_OAUTH_CLIENT_ID = 'test-meta-client';
  process.env.META_ADS_OAUTH_CLIENT_SECRET = 'test-meta-secret';
  process.env.META_ADS_OAUTH_REDIRECT_URI =
    'http://localhost:3002/api/v1/settings/oauth/meta_ads/callback';

  fetchMock = jest.spyOn(globalThis, 'fetch');

  snapshot.mockResolvedValue(refreshSnapshot(3));
  decrypt.mockReturnValue('old-private-token');
  mark.mockResolvedValue(true);
  update.mockResolvedValue(true);

  findConnection.mockResolvedValue({
    providerAccountId: 'meta-user-1',
  } as any);

  verify.mockResolvedValue({
    providerAccountId: 'meta-user-1',
    accountLabel: 'Meta account',
    grantedScopes: ['ads_read'],
  });

  fetchMock.mockResolvedValue(reply({
    access_token: 'new-private-token',
    expires_in: 5184000,
  }));
});

afterEach(() => fetchMock.mockRestore());

afterAll(() => {
  for (const [key, value] of [
    ['META_ADS_OAUTH_CLIENT_ID', originalEnv.id],
    ['META_ADS_OAUTH_CLIENT_SECRET', originalEnv.secret],
    ['META_ADS_OAUTH_REDIRECT_URI', originalEnv.redirect],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Meta OAuth token lifecycle', () => {
  test('extends an unexpired Meta token', async () => {
    const result = await refreshMetaOAuthConnection(input);

    expect(result.status).toBe('refreshed');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        provider: 'meta_ads',
        connectionId: 'connection-1',
        expectedEncryptedAccessToken: 'encrypted-old-access',
        newAccessToken: 'new-private-token',
        expiresIn: 5184000,
      })
    );

    expect(verify).toHaveBeenCalledWith({
      provider: 'meta_ads',
      accessToken: 'new-private-token',
    });
  });

  test('skips renewal when token has more than seven days', async () => {
    snapshot.mockResolvedValue(refreshSnapshot(20));

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'not_due' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('never attempts to extend an expired token', async () => {
    snapshot.mockResolvedValue(refreshSnapshot(-1));

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test('reports unavailable connections', async () => {
    snapshot.mockResolvedValue(null);

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'unavailable' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects tokens from a different Meta account', async () => {
    verify.mockResolvedValue({
      providerAccountId: 'another-user',
      accountLabel: 'Different Meta account',
      grantedScopes: ['ads_read'],
    });

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(update).not.toHaveBeenCalled();
  });

  test('rejects reduced Meta permissions', async () => {
    verify.mockResolvedValue({
      providerAccountId: 'meta-user-1',
      accountLabel: 'Meta account',
      grantedScopes: [],
    });

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(update).not.toHaveBeenCalled();
  });

  test('does not overwrite a concurrent token rotation', async () => {
    update.mockResolvedValue(false);

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'stale' });
  });

  test('does not overwrite a changed connection', async () => {
    findConnection.mockResolvedValue(null);

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'stale' });

    expect(update).not.toHaveBeenCalled();
  });

  test('recognizes revoked Meta access', async () => {
    fetchMock.mockResolvedValue(reply({
      error: { code: 190, message: 'private details' },
    }, 400));

    expect(await refreshMetaOAuthConnection(input))
      .toEqual({ status: 'reconnect_required' });

    expect(update).not.toHaveBeenCalled();
  });

  test('does not invalidate tokens on temporary server errors', async () => {
    fetchMock.mockResolvedValue(reply({
      error: { message: 'private details' },
    }, 503));

    await expect(refreshMetaOAuthConnection(input))
      .rejects.toThrow('Meta token extension failed');

    expect(mark).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test('keeps credentials out of error messages', async () => {
    fetchMock.mockResolvedValue(reply({
      error: { message: 'sensitive-provider-token' },
    }, 500));

    await expect(
      extendMetaAccessToken('private-access-token')
    ).rejects.not.toThrow('sensitive-provider-token');
  });
});
