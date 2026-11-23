import { prisma } from '../../lib/prisma';

import {
  authorizeOAuthOperation,
} from './oauth-agent-authorization';

import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

import { getOAuthTokens } from './oauth-storage';
import { refreshMetaOAuthConnection } from './oauth-meta-extension';

import {
  refreshGoogleOAuthConnection,
} from './oauth-refresh-service';

import {
  refreshExternalOAuthConnection,
} from './oauth-external-refresh-service';

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

jest.mock('./oauth-external-refresh-service', () => ({
  refreshExternalOAuthConnection: jest.fn(),
}));

jest.mock('./oauth-meta-extension', () => ({
  refreshMetaOAuthConnection: jest.fn(),
}));
const membership = jest.mocked(prisma.workspaceMember.findUnique);
const findConnection = jest.mocked(prisma.oAuthConnection.findFirst);
const getTokens = jest.mocked(getOAuthTokens);
const googleRefresh = jest.mocked(refreshGoogleOAuthConnection);
const externalRefresh = jest.mocked(refreshExternalOAuthConnection);
const metaRefresh = jest.mocked(refreshMetaOAuthConnection);

const identity = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
};

const future = () => new Date(Date.now() + 3600000);
const past = () => new Date(Date.now() - 60000);

function connection(
  provider: string,
  scopes: string[],
  expiration: Date | null = future()
) {
  return {
    id: identity.connectionId,
    provider,
    accountLabel: 'Example account',
    grantedScopes: scopes,
    tokenExpiresAt: expiration,
    connectionStatus: 'ACTIVE',
  } as any;
}

function credentials(accessToken = 'private-access') {
  return {
    accessToken,
    refreshToken: 'private-refresh',
    grantedScopes: [],
    tokenExpiresAt: future(),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  metaRefresh.mockResolvedValue({ status: 'not_due' });

  membership.mockResolvedValue({ role: 'OWNER' } as any);

  findConnection.mockResolvedValue(
    connection('hubspot', ['crm.objects.contacts.read'])
  );

  getTokens.mockResolvedValue(credentials());

  externalRefresh.mockResolvedValue({
    status: 'refreshed',
  });

  googleRefresh.mockResolvedValue({
    status: 'refreshed',
  });
});

describe('External OAuth operation authorization and execution', () => {
  test('authorizes HubSpot contacts read', async () => {
    const result = await authorizeOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    });

    expect(result.provider).toBe('hubspot');
    expect(result).not.toHaveProperty('accessToken');
  });

  test('rejects missing HubSpot scope', async () => {
    findConnection.mockResolvedValue(
      connection('hubspot', [])
    );

    await expect(authorizeOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    })).rejects.toThrow('Required OAuth permission');
  });

  test('authorizes LinkedIn reporting scope', async () => {
    findConnection.mockResolvedValue(
      connection('linkedin', ['r_ads_reporting'])
    );

    const result = await authorizeOAuthOperation({
      ...identity,
      operation: 'linkedin.ads_reporting',
    });

    expect(result.provider).toBe('linkedin');
  });

  test('rejects missing Meta advertising scope', async () => {
    findConnection.mockResolvedValue(
      connection('meta_ads', [])
    );

    await expect(authorizeOAuthOperation({
      ...identity,
      operation: 'meta_ads.read',
    })).rejects.toThrow('Required OAuth permission');
  });

  test('refreshes expired HubSpot credentials before execution', async () => {
    findConnection
      .mockResolvedValueOnce(
        connection('hubspot', ['crm.objects.contacts.read'], past())
      )
      .mockResolvedValueOnce(
        connection('hubspot', ['crm.objects.contacts.read'], future())
      );

    getTokens
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(credentials('new-hubspot-access'));

    const operation = jest.fn().mockResolvedValue({ ok: true });

    expect(await executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    }, operation)).toEqual({ ok: true });

    expect(externalRefresh).toHaveBeenCalledWith({
      workspaceId: identity.workspaceId,
      provider: 'hubspot',
      connectionId: identity.connectionId,
    });

    expect(googleRefresh).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledWith('new-hubspot-access');
  });

  test('refreshes expired LinkedIn credentials', async () => {
    findConnection
      .mockResolvedValueOnce(
        connection('linkedin', ['r_ads_reporting'], past())
      )
      .mockResolvedValueOnce(
        connection('linkedin', ['r_ads_reporting'], future())
      );

    getTokens
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(credentials('new-linkedin-access'));

    const operation = jest.fn().mockResolvedValue('done');

    expect(await executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'linkedin.ads_reporting',
    }, operation)).toBe('done');

    expect(externalRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'linkedin' })
    );

    expect(googleRefresh).not.toHaveBeenCalled();
  });

  test('does not refresh valid HubSpot credentials', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    expect(await executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    }, operation)).toBe('ok');

    expect(externalRefresh).not.toHaveBeenCalled();
    expect(googleRefresh).not.toHaveBeenCalled();
  });

  test('never sends an unavailable Meta token to Google refresh', async () => {
    findConnection.mockResolvedValue(
      connection('meta_ads', ['ads_read'])
    );
    getTokens.mockResolvedValue(null);

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'meta_ads.read',
    }, operation)).rejects.toThrow('requires reconnection');

    expect(externalRefresh).not.toHaveBeenCalled();
    expect(googleRefresh).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  test('requires reconnection when external refresh is revoked', async () => {
    getTokens.mockResolvedValueOnce(null);

    externalRefresh.mockResolvedValue({
      status: 'reconnect_required',
    });

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    }, operation)).rejects.toThrow('requires reconnection');

    expect(operation).not.toHaveBeenCalled();
  });

  test('blocks disconnected workspace members', async () => {
    membership.mockResolvedValue(null);

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    }, operation)).rejects.toThrow();

    expect(getTokens).not.toHaveBeenCalled();
    expect(externalRefresh).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  test('rechecks permissions before executing provider operations', async () => {
    findConnection
      .mockResolvedValueOnce(
        connection('hubspot', ['crm.objects.contacts.read'])
      )
      .mockResolvedValueOnce(
        connection('hubspot', [])
      );

    const operation = jest.fn();

    await expect(executeAuthorizedOAuthOperation({
      ...identity,
      operation: 'hubspot.contacts_read',
    }, operation)).rejects.toThrow('Required OAuth permission');

    expect(operation).not.toHaveBeenCalled();
  });
});
