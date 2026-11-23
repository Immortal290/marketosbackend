import { prisma } from '../../lib/prisma';
import { authorizeOAuthOperation } from './oauth-agent-authorization';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workspaceMember: { findUnique: jest.fn() },
    oAuthConnection: { findFirst: jest.fn() },
  },
}));

const membership = prisma.workspaceMember.findUnique as jest.Mock;
const connection = prisma.oAuthConnection.findFirst as jest.Mock;

const request = {
  userId: 'test-user',
  workspaceId: 'test-workspace',
  connectionId: 'test-connection',
  operation: 'gmail.send' as const,
};

beforeEach(() => {
  jest.resetAllMocks();

  membership.mockResolvedValue({ role: 'OWNER' });

  connection.mockResolvedValue({
    id: request.connectionId,
    provider: 'gmail',
    accountLabel: 'test@example.invalid',
    grantedScopes: [
      'https://www.googleapis.com/auth/gmail.send',
    ],
    connectionStatus: 'ACTIVE',
    tokenExpiresAt: new Date(Date.now() + 3600000),
  });
});

describe('OAuth agent operation authorization', () => {
  test('authorizes a valid connection and scope', async () => {
    const result = await authorizeOAuthOperation(request);

    expect(result.authorizedOperation).toBe('gmail.send');
    expect(result.connectionId).toBe(request.connectionId);

    expect(connection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: request.connectionId,
          workspaceId: request.workspaceId,
          connectedByUserId: request.userId,
          provider: 'gmail',
        }),
      })
    );

    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  test('rejects users without workspace membership', async () => {
    membership.mockResolvedValue(null);

    await expect(authorizeOAuthOperation(request))
      .rejects.toThrow('OAuth workspace access denied');

    expect(connection).not.toHaveBeenCalled();
  });

  test('rejects connections outside authorized query context', async () => {
    connection.mockResolvedValue(null);

    await expect(authorizeOAuthOperation(request))
      .rejects.toThrow('OAuth connection not authorized');
  });

  test('rejects connections requiring reconnection', async () => {
    connection.mockResolvedValue({
      id: request.connectionId,
      provider: 'gmail',
      grantedScopes: [
        'https://www.googleapis.com/auth/gmail.send',
      ],
      connectionStatus: 'RECONNECT_REQUIRED',
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    await expect(authorizeOAuthOperation(request))
      .rejects.toThrow('OAuth connection requires reconnection');
  });

  test('rejects missing OAuth permissions', async () => {
    connection.mockResolvedValue({
      id: request.connectionId,
      provider: 'gmail',
      grantedScopes: ['openid', 'email'],
      connectionStatus: 'ACTIVE',
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    await expect(authorizeOAuthOperation(request))
      .rejects.toThrow('Required OAuth permission not granted');
  });

  test('rejects expired access tokens', async () => {
    connection.mockResolvedValue({
      id: request.connectionId,
      provider: 'gmail',
      grantedScopes: [
        'https://www.googleapis.com/auth/gmail.send',
      ],
      connectionStatus: 'ACTIVE',
      tokenExpiresAt: new Date(Date.now() - 60000),
    });

    await expect(authorizeOAuthOperation(request))
      .rejects.toThrow('OAuth access token expired');
  });

  test('rejects unsupported operations', async () => {
    await expect(authorizeOAuthOperation({
      ...request,
      operation: 'unsupported.operation' as any,
    })).rejects.toThrow('Unsupported OAuth connector operation');

    expect(connection).not.toHaveBeenCalled();
  });

  test('rejects missing authorization context', async () => {
    await expect(authorizeOAuthOperation({
      ...request,
      userId: '',
    })).rejects.toThrow('OAuth authorization context is required');

    expect(membership).not.toHaveBeenCalled();
  });
});
