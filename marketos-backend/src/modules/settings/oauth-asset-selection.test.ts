import { prisma } from '../../lib/prisma';

import {
  saveVerifiedOAuthAssetSelection,
} from './oauth-asset-selection';

import {
  listAccessibleOAuthAssets,
} from './oauth-asset-discovery';

import {
  authorizeOAuthOperation,
} from './oauth-agent-authorization';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('./oauth-asset-discovery', () => ({
  listAccessibleOAuthAssets: jest.fn(),
}));

jest.mock('./oauth-agent-authorization', () => ({
  authorizeOAuthOperation: jest.fn(),
}));

const findConnection = jest.mocked(
  prisma.oAuthConnection.findFirst
);

const update = jest.mocked(
  prisma.oAuthConnection.updateMany
);

const member = jest.mocked(
  prisma.workspaceMember.findUnique
);

const discover = jest.mocked(listAccessibleOAuthAssets);
const authorize = jest.mocked(authorizeOAuthOperation);

const updatedAt = new Date('2026-11-01T10:00:00Z');

const input = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  assetIds: ['properties/123'],
};

beforeEach(() => {
  jest.resetAllMocks();

  findConnection
    .mockResolvedValueOnce({
      provider: 'ga4',
    } as any)
    .mockResolvedValueOnce({
      encryptedAccessToken: 'encrypted-current',
      updatedAt,
    } as any);

  discover.mockResolvedValue([
    {
      id: 'properties/123',
      label: 'Website A',
      type: 'ga4_property',
    },
    {
      id: 'properties/456',
      label: 'Website B',
      type: 'ga4_property',
    },
  ]);

  authorize.mockResolvedValue({
    provider: 'ga4',
    connectionId: 'connection-1',
    accountLabel: 'Google account',
    authorizedOperation: 'ga4.read',
  });

  member.mockResolvedValue({ role: 'OWNER' } as any);
  update.mockResolvedValue({ count: 1 });
});

describe('Verified OAuth asset selection', () => {
  test('saves only provider-verified assets', async () => {
    const result = await saveVerifiedOAuthAssetSelection(input);

    expect(result).toEqual({
      provider: 'ga4',
      selectedAssetIds: ['properties/123'],
    });

    expect(discover).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      provider: 'ga4',
    });

    expect(update).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'connection-1',
        workspaceId: 'workspace-1',
        connectedByUserId: 'user-1',
        provider: 'ga4',
        connectionStatus: 'ACTIVE',
        encryptedAccessToken: 'encrypted-current',
        updatedAt,
      }),
      data: {
        selectedAssets: {
          assetIds: ['properties/123'],
          verifiedAt: expect.any(String),
        },
      },
    });
  });

  test('rejects arbitrary asset IDs', async () => {
    await expect(saveVerifiedOAuthAssetSelection({
      ...input,
      assetIds: ['properties/999'],
    })).rejects.toThrow('not accessible');

    expect(update).not.toHaveBeenCalled();
  });

  test('rejects duplicate assets', async () => {
    await expect(saveVerifiedOAuthAssetSelection({
      ...input,
      assetIds: ['properties/123', 'properties/123'],
    })).rejects.toThrow('Duplicate');

    expect(discover).not.toHaveBeenCalled();
  });

  test('rejects invalid input', async () => {
    await expect(saveVerifiedOAuthAssetSelection({
      ...input,
      assetIds: 'properties/123' as any,
    })).rejects.toThrow('Invalid OAuth asset selection');

    expect(findConnection).not.toHaveBeenCalled();
  });

  test('rejects connections not owned by the caller', async () => {
    findConnection.mockReset();
    findConnection.mockResolvedValue(null);

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('not authorized');

    expect(discover).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects unauthorized providers', async () => {
    findConnection.mockReset();
    findConnection.mockResolvedValue({
      provider: 'gmail',
    } as any);

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('does not support');

    expect(discover).not.toHaveBeenCalled();
  });

  test('rechecks permission after discovery', async () => {
    authorize.mockRejectedValue(
      new Error('Required OAuth permission not granted')
    );

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('Required OAuth permission');

    expect(update).not.toHaveBeenCalled();
  });

  test('rejects revoked workspace ownership', async () => {
    member.mockResolvedValue(null);

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('Workspace owner permission required');

    expect(update).not.toHaveBeenCalled();
  });

  test('prevents stale concurrent updates', async () => {
    update.mockResolvedValue({ count: 0 });

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('retry asset selection');
  });

  test('supports clearing a selection after verification', async () => {
    const result = await saveVerifiedOAuthAssetSelection({
      ...input,
      assetIds: [],
    });

    expect(result.selectedAssetIds).toEqual([]);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          selectedAssets: {
            assetIds: [],
            verifiedAt: expect.any(String),
          },
        },
      })
    );
  });

  test('does not save when provider discovery fails', async () => {
    discover.mockRejectedValue(
      new Error('Unable to retrieve provider assets')
    );

    await expect(
      saveVerifiedOAuthAssetSelection(input)
    ).rejects.toThrow('Unable to retrieve provider assets');

    expect(update).not.toHaveBeenCalled();
  });
});
