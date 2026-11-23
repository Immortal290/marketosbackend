import { prisma } from '../../lib/prisma';
import {
  authorizeOAuthOperation,
} from './oauth-agent-authorization';
import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';
import { getOAuthTokens } from './oauth-storage';
import {
  refreshGoogleOAuthConnection,
} from './oauth-refresh-service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workspaceMember: {
      findUnique: jest.fn(),
    },
    oAuthConnection: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('./oauth-storage', () => ({
  getOAuthTokens: jest.fn(),
}));

jest.mock('./oauth-refresh-service', () => ({
  refreshGoogleOAuthConnection: jest.fn(),
}));

const member = jest.mocked(prisma.workspaceMember.findUnique);
const connection = jest.mocked(prisma.oAuthConnection.findFirst);
const getTokens = jest.mocked(getOAuthTokens);
const refresh = jest.mocked(refreshGoogleOAuthConnection);

const input = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  operation: 'mailchimp.read' as const,
};

function storedConnection(
  provider: string,
  expiry: Date | null,
  scopes: string[] = []
) {
  return {
    id: 'connection-1',
    provider,
    accountLabel: 'Test account',
    grantedScopes: scopes,
    tokenExpiresAt: expiry,
    connectionStatus: 'ACTIVE',
  } as any;
}

beforeEach(() => {
  jest.resetAllMocks();

  member.mockResolvedValue({ role: 'OWNER' } as any);

  connection.mockResolvedValue(
    storedConnection('mailchimp', null)
  );

  getTokens.mockResolvedValue({
    accessToken: 'fake-private-token',
    refreshToken: null,
    grantedScopes: [],
    tokenExpiresAt: null,
  });
});

describe('Mailchimp authorization and safe token execution', () => {
  test('authorizes active non-expiring Mailchimp credentials', async () => {
    const result = await authorizeOAuthOperation(input);

    expect(result.authorizedOperation).toBe('mailchimp.read');
    expect(result.provider).toBe('mailchimp');
    expect(result).not.toHaveProperty('accessToken');
  });

  test('enforces user, workspace and provider isolation', async () => {
    await authorizeOAuthOperation(input);

    expect(connection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: input.connectionId,
          workspaceId: input.workspaceId,
          connectedByUserId: input.userId,
          provider: 'mailchimp',
        }),
      })
    );
  });

  test('rejects users without workspace membership', async () => {
    member.mockResolvedValue(null);

    await expect(
      authorizeOAuthOperation(input)
    ).rejects.toThrow();

    expect(connection).not.toHaveBeenCalled();
  });

  test('rejects expired Mailchimp credentials', async () => {
    connection.mockResolvedValue(
      storedConnection(
        'mailchimp',
        new Date(Date.now() - 60000)
      )
    );

    await expect(
      authorizeOAuthOperation(input)
    ).rejects.toThrow('expired');
  });

  test('still rejects Google tokens without expiration', async () => {
    connection.mockResolvedValue(
      storedConnection(
        'gmail',
        null,
        ['https://www.googleapis.com/auth/gmail.send']
      )
    );

    await expect(
      authorizeOAuthOperation({
        ...input,
        operation: 'gmail.send',
      })
    ).rejects.toThrow('expired');
  });

  test('still enforces Google OAuth scopes', async () => {
    connection.mockResolvedValue(
      storedConnection(
        'gmail',
        new Date(Date.now() + 3600000),
        []
      )
    );

    await expect(
      authorizeOAuthOperation({
        ...input,
        operation: 'gmail.send',
      })
    ).rejects.toThrow('Required OAuth permission not granted');
  });

  test('executes authorized Mailchimp operations', async () => {
    const operation = jest.fn().mockResolvedValue({
      success: true,
    });

    const result = await executeAuthorizedOAuthOperation(
      input,
      operation
    );

    expect(result).toEqual({ success: true });
    expect(operation).toHaveBeenCalledWith(
      'fake-private-token'
    );

    expect(refresh).not.toHaveBeenCalled();
  });

  test('never attempts Google refresh for Mailchimp', async () => {
    getTokens.mockResolvedValue(null);

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('requires reconnection');

    expect(refresh).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });
});
