import { prisma } from '../../lib/prisma';
import { decryptOAuthToken } from './oauth-crypto';
import { getOAuthTokens } from './oauth-storage';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('./oauth-crypto', () => ({
  encryptOAuthToken: jest.fn(() => 'encrypted-test'),
  decryptOAuthToken: jest.fn(() => 'decrypted-test-token'),
}));

const findConnection = jest.mocked(
  prisma.oAuthConnection.findFirst
);

const decrypt = jest.mocked(decryptOAuthToken);

function connection(
  provider: string,
  expiresAt: Date | null
) {
  return {
    id: 'connection-1',
    workspaceId: 'workspace-1',
    provider,
    connectedByUserId: 'user-1',
    providerAccountId: 'account-1',
    encryptedAccessToken: 'encrypted-test',
    encryptedRefreshToken: null,
    grantedScopes: [],
    tokenExpiresAt: expiresAt,
    connectionStatus: 'ACTIVE',
  } as any;
}

beforeEach(() => {
  // Preserve the decryption mock implementation.
  jest.clearAllMocks();
});

describe('Provider-specific OAuth token expiration', () => {
  test('accepts non-expiring Mailchimp tokens', async () => {
    findConnection.mockResolvedValue(
      connection('mailchimp', null)
    );

    const result = await getOAuthTokens(
      'workspace-1',
      'mailchimp',
      'connection-1'
    );

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('decrypted-test-token');
    expect(result?.tokenExpiresAt).toBeNull();

    expect(decrypt).toHaveBeenCalledWith(
      'encrypted-test',
      'workspace-1',
      'mailchimp',
      'connection-1',
      'access'
    );
  });

  test('rejects Google tokens without expiration', async () => {
    findConnection.mockResolvedValue(
      connection('gmail', null)
    );

    expect(await getOAuthTokens(
      'workspace-1', 'gmail', 'connection-1'
    )).toBeNull();

    expect(decrypt).not.toHaveBeenCalled();
  });

  test('rejects HubSpot tokens without expiration', async () => {
    findConnection.mockResolvedValue(
      connection('hubspot', null)
    );

    expect(await getOAuthTokens(
      'workspace-1', 'hubspot', 'connection-1'
    )).toBeNull();
  });

  test('rejects expired Mailchimp tokens', async () => {
    findConnection.mockResolvedValue(
      connection('mailchimp', new Date(Date.now() - 60000))
    );

    expect(await getOAuthTokens(
      'workspace-1', 'mailchimp', 'connection-1'
    )).toBeNull();
  });

  test('accepts unexpired Google tokens', async () => {
    findConnection.mockResolvedValue(
      connection('gmail', new Date(Date.now() + 3600000))
    );

    const result = await getOAuthTokens(
      'workspace-1', 'gmail', 'connection-1'
    );

    expect(result?.accessToken).toBe('decrypted-test-token');
  });

  test('rejects other providers without expiration', async () => {
    findConnection.mockResolvedValue(
      connection('linkedin', null)
    );

    expect(await getOAuthTokens(
      'workspace-1', 'linkedin', 'connection-1'
    )).toBeNull();
  });

  test('restricts lookup to the active workspace connection', async () => {
    findConnection.mockResolvedValue(null);

    const result = await getOAuthTokens(
      'workspace-1', 'mailchimp', 'connection-1'
    );

    expect(result).toBeNull();
    expect(findConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'connection-1',
          workspaceId: 'workspace-1',
          provider: 'mailchimp',
          connectionStatus: 'ACTIVE',
        }),
      })
    );

    expect(decrypt).not.toHaveBeenCalled();
  });
});
