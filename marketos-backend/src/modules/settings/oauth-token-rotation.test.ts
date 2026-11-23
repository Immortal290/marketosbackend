import { prisma } from '../../lib/prisma';
import { encryptOAuthToken } from './oauth-crypto';
import { updateRotatedOAuthTokens } from './oauth-storage';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: { updateMany: jest.fn() },
  },
}));

jest.mock('./oauth-crypto', () => ({
  encryptOAuthToken: jest.fn((value: string) => `encrypted:${value}`),
  decryptOAuthToken: jest.fn(),
}));

const update = jest.mocked(prisma.oAuthConnection.updateMany);
const encrypt = jest.mocked(encryptOAuthToken);

const input = {
  workspaceId: 'workspace-1',
  provider: 'hubspot' as const,
  connectionId: 'connection-1',
  expectedEncryptedAccessToken: 'previous-encrypted-access',
  newAccessToken: 'new-private-access',
  newRefreshToken: 'new-private-refresh',
  expiresIn: 1800,
};

beforeEach(() => {
  jest.clearAllMocks();
  update.mockResolvedValue({ count: 1 });
});

describe('Atomic encrypted OAuth token rotation', () => {
  test('encrypts and updates both tokens atomically', async () => {
    expect(await updateRotatedOAuthTokens(input)).toBe(true);

    expect(encrypt).toHaveBeenCalledWith(
      'new-private-access',
      'workspace-1',
      'hubspot',
      'connection-1',
      'access'
    );

    expect(encrypt).toHaveBeenCalledWith(
      'new-private-refresh',
      'workspace-1',
      'hubspot',
      'connection-1',
      'refresh'
    );

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'connection-1',
        workspaceId: 'workspace-1',
        provider: 'hubspot',
        connectionStatus: 'ACTIVE',
        encryptedAccessToken: 'previous-encrypted-access',
      },
      data: expect.objectContaining({
        encryptedAccessToken: 'encrypted:new-private-access',
        encryptedRefreshToken: 'encrypted:new-private-refresh',
        tokenExpiresAt: expect.any(Date),
      }),
    });
  });

  test('preserves stored refresh token when no new token is issued', async () => {
    await updateRotatedOAuthTokens({
      ...input,
      newRefreshToken: null,
    });

    const data = update.mock.calls[0][0].data;

    expect(data).not.toHaveProperty('encryptedRefreshToken');
    expect(encrypt).toHaveBeenCalledTimes(1);
  });

  test('returns false when the previous token changed', async () => {
    update.mockResolvedValue({ count: 0 });

    expect(await updateRotatedOAuthTokens(input)).toBe(false);
  });

  test('rejects unrelated providers', async () => {
    await expect(updateRotatedOAuthTokens({
      ...input,
      provider: 'gmail' as any,
    })).rejects.toThrow('Unsupported');

    expect(update).not.toHaveBeenCalled();
  });

  test('rejects invalid refresh-token lifetimes', async () => {
    await expect(updateRotatedOAuthTokens({
      ...input,
      expiresIn: 0,
    })).rejects.toThrow('Invalid OAuth token lifetime');

    expect(update).not.toHaveBeenCalled();
  });

  test('rejects invalid rotated refresh tokens', async () => {
    await expect(updateRotatedOAuthTokens({
      ...input,
      newRefreshToken: ' ',
    })).rejects.toThrow('Invalid rotated OAuth refresh token');

    expect(update).not.toHaveBeenCalled();
  });

  test('requires connection and workspace context', async () => {
    await expect(updateRotatedOAuthTokens({
      ...input,
      workspaceId: '',
    })).rejects.toThrow('Workspace ID');

    expect(update).not.toHaveBeenCalled();
  });
});
