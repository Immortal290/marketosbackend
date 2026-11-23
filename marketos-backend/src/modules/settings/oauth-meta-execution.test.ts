import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

import {
  authorizeOAuthGrantForRefresh,
  authorizeOAuthOperation,
} from './oauth-agent-authorization';

import { getOAuthTokens } from './oauth-storage';
import { refreshMetaOAuthConnection } from './oauth-meta-extension';

jest.mock('./oauth-agent-authorization', () => ({
  authorizeOAuthGrantForRefresh: jest.fn(),
  authorizeOAuthOperation: jest.fn(),
}));

jest.mock('./oauth-storage', () => ({
  getOAuthTokens: jest.fn(),
}));

jest.mock('./oauth-meta-extension', () => ({
  refreshMetaOAuthConnection: jest.fn(),
}));

jest.mock('./oauth-refresh-service', () => ({
  refreshGoogleOAuthConnection: jest.fn(),
}));

jest.mock('./oauth-external-refresh-service', () => ({
  refreshExternalOAuthConnection: jest.fn(),
}));

const grant = jest.mocked(authorizeOAuthGrantForRefresh);
const authorize = jest.mocked(authorizeOAuthOperation);
const tokens = jest.mocked(getOAuthTokens);
const meta = jest.mocked(refreshMetaOAuthConnection);

const input = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  operation: 'meta_ads.read' as const,
};

const permission = {
  connectionId: 'connection-1',
  provider: 'meta_ads',
  accountLabel: 'Meta account',
  authorizedOperation: 'meta_ads.read' as const,
};

beforeEach(() => {
  jest.resetAllMocks();

  grant.mockResolvedValue(permission);
  authorize.mockResolvedValue(permission);

  tokens.mockResolvedValue({
    accessToken: 'valid-private-token',
    refreshToken: null,
    grantedScopes: ['ads_read'],
    tokenExpiresAt: new Date(Date.now() + 3600000),
  });

  meta.mockResolvedValue({ status: 'not_due' });
});

describe('Proactive Meta OAuth execution', () => {
  test('checks Meta renewal before retrieving credentials', async () => {
    meta.mockResolvedValue({ status: 'refreshed' });

    tokens.mockResolvedValue({
      accessToken: 'renewed-private-token',
      refreshToken: null,
      grantedScopes: ['ads_read'],
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    const operation = jest.fn().mockResolvedValue('success');

    const result = await executeAuthorizedOAuthOperation(
      input,
      operation
    );

    expect(result).toBe('success');

    expect(meta).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
    });

    expect(
      meta.mock.invocationCallOrder[0]
    ).toBeLessThan(
      tokens.mock.invocationCallOrder[0]
    );

    expect(operation).toHaveBeenCalledWith(
      'renewed-private-token'
    );
  });

  test('uses a still-valid token when extension is not due', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    expect(await executeAuthorizedOAuthOperation(
      input,
      operation
    )).toBe('success');

    expect(operation).toHaveBeenCalledWith(
      'valid-private-token'
    );
  });

  test('revalidates a connection after a stale renewal result', async () => {
    meta.mockResolvedValue({ status: 'stale' });

    const operation = jest.fn().mockResolvedValue('ok');

    expect(await executeAuthorizedOAuthOperation(
      input,
      operation
    )).toBe('ok');

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(tokens).toHaveBeenCalledTimes(2);
  });

  test('blocks revoked Meta authorization', async () => {
    meta.mockResolvedValue({
      status: 'reconnect_required',
    });

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('requires reconnection');

    expect(tokens).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks an unavailable connection', async () => {
    meta.mockResolvedValue({ status: 'unavailable' });

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('OAuth access token unavailable');

    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks execution on temporary extension failures', async () => {
    meta.mockRejectedValue(
      new Error('Meta token service temporarily unavailable')
    );

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('temporarily unavailable');

    expect(operation).not.toHaveBeenCalled();
  });

  test('does not renew an unauthorized connection', async () => {
    grant.mockRejectedValue(
      new Error('OAuth workspace access denied')
    );

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('OAuth workspace access denied');

    expect(meta).not.toHaveBeenCalled();
    expect(tokens).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  test('rechecks permissions after renewal', async () => {
    meta.mockResolvedValue({ status: 'refreshed' });
    authorize.mockRejectedValue(
      new Error('Required OAuth permission not granted')
    );

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('Required OAuth permission not granted');

    expect(operation).not.toHaveBeenCalled();
  });

  test('never executes using unavailable credentials', async () => {
    meta.mockResolvedValue({ status: 'stale' });
    tokens.mockResolvedValue(null);

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation(
      input,
      operation
    )).rejects.toThrow('requires reconnection');

    expect(operation).not.toHaveBeenCalled();
  });
});
