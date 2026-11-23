import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import {
  authorizeOAuthGrantForRefresh,
  authorizeOAuthOperation,
} from './oauth-agent-authorization';
import { getOAuthTokens } from './oauth-storage';
import { refreshGoogleOAuthConnection } from './oauth-refresh-service';

jest.mock('./oauth-agent-authorization', () => ({
  authorizeOAuthGrantForRefresh: jest.fn(),
  authorizeOAuthOperation: jest.fn(),
}));

jest.mock('./oauth-storage', () => ({
  getOAuthTokens: jest.fn(),
}));

jest.mock('./oauth-refresh-service', () => ({
  refreshGoogleOAuthConnection: jest.fn(),
}));

const authorizeGrant = jest.mocked(authorizeOAuthGrantForRefresh);
const authorizeOperation = jest.mocked(authorizeOAuthOperation);
const getTokens = jest.mocked(getOAuthTokens);
const refresh = jest.mocked(refreshGoogleOAuthConnection);

const input = {
  userId: 'test-user',
  workspaceId: 'test-workspace',
  connectionId: 'test-connection',
  operation: 'gmail.send' as const,
};

const authorization = {
  connectionId: 'test-connection',
  provider: 'gmail',
  accountLabel: 'test@example.invalid',
  authorizedOperation: 'gmail.send' as const,
};

const tokens = {
  accessToken: 'fake-private-access-token',
  refreshToken: 'fake-refresh-token',
  grantedScopes: [
    'https://www.googleapis.com/auth/gmail.send',
  ],
  tokenExpiresAt: new Date(Date.now() + 3600000),
};

beforeEach(() => {
  jest.resetAllMocks();
  authorizeGrant.mockResolvedValue(authorization);
  authorizeOperation.mockResolvedValue(authorization);
  getTokens.mockResolvedValue(tokens);
  refresh.mockResolvedValue({ status: 'refreshed' });
});

describe('Authorized OAuth connector execution', () => {
  test('executes with valid credentials without refreshing', async () => {
    const operation = jest.fn().mockResolvedValue({ success: true });

    const result = await executeAuthorizedOAuthOperation(input, operation);

    expect(result).toEqual({ success: true });
    expect(operation).toHaveBeenCalledWith(tokens.accessToken);
    expect(authorizeGrant).toHaveBeenCalledTimes(1);
    expect(authorizeOperation).toHaveBeenCalledTimes(1);
    expect(getTokens).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('refreshes expired credentials before execution', async () => {
    getTokens
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...tokens,
        accessToken: 'fake-new-access-token',
      });

    const operation = jest.fn().mockResolvedValue({ success: true });

    await executeAuthorizedOAuthOperation(input, operation);

    expect(refresh).toHaveBeenCalledWith({
      workspaceId: input.workspaceId,
      provider: 'gmail',
      connectionId: input.connectionId,
    });

    expect(operation).toHaveBeenCalledWith('fake-new-access-token');
  });

  test('blocks unauthorized access before retrieving credentials', async () => {
    authorizeGrant.mockRejectedValue(
      new Error('OAuth workspace access denied')
    );

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('OAuth workspace access denied');

    expect(getTokens).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks revoked connections', async () => {
    getTokens.mockResolvedValueOnce(null);
    refresh.mockResolvedValue({ status: 'reconnect_required' });

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('OAuth connection requires reconnection');

    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks unavailable refresh results', async () => {
    getTokens.mockResolvedValueOnce(null);
    refresh.mockResolvedValue({ status: 'unavailable' });

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('OAuth access token unavailable');

    expect(operation).not.toHaveBeenCalled();
  });

  test('rejects stale refresh when no valid token exists', async () => {
    getTokens.mockResolvedValue(null);
    refresh.mockResolvedValue({ status: 'stale' });

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('OAuth access token unavailable');

    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks permission changes before execution', async () => {
    authorizeOperation.mockRejectedValue(
      new Error('Required OAuth permission not granted')
    );

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('Required OAuth permission not granted');

    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks missing credentials after authorization', async () => {
    getTokens
      .mockResolvedValueOnce(tokens)
      .mockResolvedValueOnce(null);

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('OAuth access token unavailable');

    expect(operation).not.toHaveBeenCalled();
  });

  test('propagates temporary token-refresh failures', async () => {
    getTokens.mockResolvedValueOnce(null);
    refresh.mockRejectedValue(new Error('Temporary Google error'));

    const operation = jest.fn();

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('Temporary Google error');

    expect(operation).not.toHaveBeenCalled();
  });

  test('propagates backend provider-operation failures', async () => {
    const operation = jest.fn().mockRejectedValue(
      new Error('Provider request failed')
    );

    await expect(
      executeAuthorizedOAuthOperation(input, operation)
    ).rejects.toThrow('Provider request failed');
  });
});
