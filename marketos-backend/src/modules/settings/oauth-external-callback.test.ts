import { prisma } from '../../lib/prisma';

import {
  completeExternalOAuthCallback,
} from './oauth-external-callback';

import { consumeOAuthState } from './oauth-state';
import { exchangeExternalOAuthCode } from './oauth-external-token-exchange';
import { verifyExternalOAuthAccount } from './oauth-external-account-verification';
import { saveOAuthConnection } from './oauth-storage';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workspaceMember: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('./oauth-state', () => ({
  consumeOAuthState: jest.fn(),
}));

jest.mock('./oauth-external-token-exchange', () => ({
  exchangeExternalOAuthCode: jest.fn(),
}));

jest.mock('./oauth-external-account-verification', () => ({
  verifyExternalOAuthAccount: jest.fn(),
}));

jest.mock('./oauth-storage', () => ({
  saveOAuthConnection: jest.fn(),
}));

const consume = jest.mocked(consumeOAuthState);
const exchange = jest.mocked(exchangeExternalOAuthCode);
const verify = jest.mocked(verifyExternalOAuthAccount);
const save = jest.mocked(saveOAuthConnection);
const membership = jest.mocked(
  prisma.workspaceMember.findUnique
);

function context(provider: string) {
  return {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider,
    codeVerifier: 'test-verifier',
    createdAt: Date.now(),
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  consume.mockResolvedValue(context('hubspot'));

  membership.mockResolvedValue({
    role: 'OWNER',
  } as any);

  exchange.mockResolvedValue({
    accessToken: 'fake-private-access',
    refreshToken: 'fake-private-refresh',
    expiresIn: 1800,
    grantedScopes: ['crm.objects.contacts.read', 'crm.lists.read'],
  });

  verify.mockResolvedValue({
    providerAccountId: 'account-123',
    accountLabel: 'Example account',
    grantedScopes: ['crm.objects.contacts.read', 'crm.lists.read'],
  });

  save.mockResolvedValue({} as any);
});

describe('External OAuth callback security', () => {
  const input = {
    provider: 'hubspot' as const,
    state: 'test-state',
    code: 'fake-authorization-code',
  };

  test('verifies identity and saves a valid account', async () => {
    const result = await completeExternalOAuthCallback(input);

    expect(result).toBe('success');

    expect(consume).toHaveBeenCalledWith(
      'test-state',
      'hubspot'
    );

    expect(membership).toHaveBeenCalledWith({
      where: {
        userId_workspaceId: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
        },
      },
      select: { role: true },
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        connectedByUserId: 'user-1',
        provider: 'hubspot',
        providerAccountId: 'account-123',
        accessToken: 'fake-private-access',
        refreshToken: 'fake-private-refresh',
        grantedScopes: ['crm.objects.contacts.read', 'crm.lists.read'],
        tokenExpiresAt: expect.any(Date),
      })
    );
  });

  test('consumes state on cancelled authorization', async () => {
    const result = await completeExternalOAuthCallback({
      ...input,
      error: 'access_denied',
    });

    expect(result).toBe('cancelled');
    expect(consume).toHaveBeenCalledTimes(1);
    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects other provider errors', async () => {
    const result = await completeExternalOAuthCallback({
      ...input,
      error: 'server_error',
    });

    expect(result).toBe('error');
    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects callback without authorization code', async () => {
    const result = await completeExternalOAuthCallback({
      ...input,
      code: '',
    });

    expect(result).toBe('error');
    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects state from another provider', async () => {
    consume.mockResolvedValue(context('linkedin'));

    await expect(
      completeExternalOAuthCallback(input)
    ).rejects.toThrow('OAuth provider state mismatch');

    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects expired workspace ownership', async () => {
    membership.mockResolvedValue(null);

    await expect(
      completeExternalOAuthCallback(input)
    ).rejects.toThrow('OAuth workspace permission revoked');

    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects missing verified API permissions', async () => {
    verify.mockResolvedValue({
      providerAccountId: 'account-123',
      accountLabel: 'Example account',
      grantedScopes: [],
    });

    await expect(
      completeExternalOAuthCallback(input)
    ).rejects.toThrow('Required OAuth permissions not granted');

    expect(save).not.toHaveBeenCalled();
  });

  test('rejects provider identity verification failure', async () => {
    verify.mockRejectedValue(
      new Error('OAuth account verification failed')
    );

    await expect(
      completeExternalOAuthCallback(input)
    ).rejects.toThrow('OAuth account verification failed');

    expect(save).not.toHaveBeenCalled();
  });

  test('saves Mailchimp without a token expiration', async () => {
    consume.mockResolvedValue(context('mailchimp'));

    exchange.mockResolvedValue({
      accessToken: 'fake-mailchimp-token',
      refreshToken: null,
      expiresIn: null,
      grantedScopes: [],
    });

    verify.mockResolvedValue({
      providerAccountId: 'mailchimp-123',
      accountLabel: 'Example Mailchimp',
      grantedScopes: [],
      dataCenter: 'us6',
    });

    const result = await completeExternalOAuthCallback({
      ...input,
      provider: 'mailchimp',
    });

    expect(result).toBe('success');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'mailchimp',
        tokenExpiresAt: null,
        refreshToken: undefined,
      })
    );
  });

  test('rejects missing expiration on expiring providers', async () => {
    exchange.mockResolvedValue({
      accessToken: 'fake-access',
      refreshToken: null,
      expiresIn: null,
      grantedScopes: [],
    });

    await expect(
      completeExternalOAuthCallback(input)
    ).rejects.toThrow('Invalid OAuth token expiration');

    expect(save).not.toHaveBeenCalled();
  });
});
