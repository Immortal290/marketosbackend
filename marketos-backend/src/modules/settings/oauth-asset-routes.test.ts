import router from './oauth-asset-routes';
import { prisma } from '../../lib/prisma';

import {
  requireJwtAuth,
} from '../../middlewares/jwt-auth.middleware';

import {
  requireOAuthWorkspaceOwner,
} from './oauth-workspace-auth';

import {
  listAccessibleOAuthAssets,
} from './oauth-asset-discovery';

import {
  saveVerifiedOAuthAssetSelection,
} from './oauth-asset-selection';

jest.mock('../../middlewares/jwt-auth.middleware', () => ({
  requireJwtAuth: jest.fn(
    (_req, _res, next) => next()
  ),
}));

jest.mock('./oauth-workspace-auth', () => ({
  requireOAuthWorkspaceOwner: jest.fn(
    (_req, _res, next) => next()
  ),
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('./oauth-asset-discovery', () => ({
  listAccessibleOAuthAssets: jest.fn(),
}));

jest.mock('./oauth-asset-selection', () => ({
  saveVerifiedOAuthAssetSelection: jest.fn(),
}));

const findConnection = jest.mocked(
  prisma.oAuthConnection.findFirst
);

const discover = jest.mocked(listAccessibleOAuthAssets);

const save = jest.mocked(saveVerifiedOAuthAssetSelection);

function endpoint(method: 'get' | 'put') {
  const layer = (router as any).stack.find(
    (entry: any) =>
      entry.route?.path === '/connections/:connectionId/assets' &&
      entry.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Missing ${method} asset route`);
  }

  return layer.route.stack;
}

function request(
  body: unknown = { assetIds: ['properties/123'] }
): any {
  return {
    params: { connectionId: 'connection-1' },
    oauthWorkspace: {
      userId: 'verified-user',
      workspaceId: 'workspace-1',
    },
    body,
  };
}

function response(): any {
  const res: any = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

async function call(
  method: 'get' | 'put',
  req = request()
) {
  const res = response();
  const handlers = endpoint(method);

  await handlers[handlers.length - 1].handle(req, res);

  return res;
}

beforeEach(() => {
  jest.resetAllMocks();

  findConnection.mockResolvedValue({
    provider: 'ga4',
    selectedAssets: {
      assetIds: ['properties/123'],
    },
  } as any);

  discover.mockResolvedValue([
    {
      id: 'properties/123',
      label: 'Main Property',
      type: 'ga4_property',
    },
    {
      id: 'properties/456',
      label: 'Second Property',
      type: 'ga4_property',
    },
  ]);

  save.mockResolvedValue({
    provider: 'ga4',
    selectedAssetIds: ['properties/123'],
  });
});

describe('OAuth asset API security', () => {
  test('GET and PUT require JWT and workspace-owner middleware', () => {
    for (const method of ['get', 'put'] as const) {
      const handlers = endpoint(method);

      expect(handlers).toHaveLength(3);
      expect(handlers[0].handle).toBe(requireJwtAuth);
      expect(handlers[1].handle).toBe(
        requireOAuthWorkspaceOwner
      );
    }
  });

  test('GET returns only accessible selected assets', async () => {
    const res = await call('get');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        provider: 'ga4',
        assets: expect.any(Array),
        selectedAssetIds: ['properties/123'],
      },
    });

    expect(findConnection).toHaveBeenCalledWith({
      where: {
        id: 'connection-1',
        workspaceId: 'workspace-1',
        connectedByUserId: 'verified-user',
        connectionStatus: 'ACTIVE',
      },
      select: {
        provider: true,
        selectedAssets: true,
      },
    });

    expect(discover).toHaveBeenCalledWith({
      userId: 'verified-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      provider: 'ga4',
    });
  });

  test('GET filters previously selected inaccessible assets', async () => {
    findConnection.mockResolvedValue({
      provider: 'ga4',
      selectedAssets: {
        assetIds: ['properties/123', 'properties/999'],
      },
    } as any);

    const res = await call('get');

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json.mock.calls[0][0].data.selectedAssetIds)
      .toEqual(['properties/123']);
  });

  test('GET requires authorized workspace context', async () => {
    const req = request();
    delete req.oauthWorkspace;

    const res = await call('get', req);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(findConnection).not.toHaveBeenCalled();
  });

  test('GET rejects connections outside caller ownership', async () => {
    findConnection.mockResolvedValue(null);

    const res = await call('get');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(discover).not.toHaveBeenCalled();
  });

  test('GET rejects unsupported providers', async () => {
    findConnection.mockResolvedValue({
      provider: 'gmail',
      selectedAssets: null,
    } as any);

    const res = await call('get');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(discover).not.toHaveBeenCalled();
  });

  test('GET never reveals provider failure details', async () => {
    discover.mockRejectedValue(
      new Error('private-provider-token-error')
    );

    const res = await call('get');

    expect(res.status).toHaveBeenCalledWith(503);

    expect(JSON.stringify(res.json.mock.calls))
      .not.toContain('private-provider-token-error');
  });

  test('PUT saves using authenticated user identity', async () => {
    const res = await call('put');

    expect(res.status).toHaveBeenCalledWith(200);

    expect(save).toHaveBeenCalledWith({
      userId: 'verified-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      assetIds: ['properties/123'],
    });
  });

  test('PUT rejects injected token and workspace fields', async () => {
    const req = request({
      assetIds: ['properties/123'],
      accessToken: 'untrusted-token',
      workspaceId: 'another-workspace',
    });

    const res = await call('put', req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
  });

  test('PUT rejects malformed asset identifiers', async () => {
    const res = await call('put', request({
      assetIds: [123],
    }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
  });

  test('PUT rejects missing workspace authorization', async () => {
    const req = request();
    delete req.oauthWorkspace;

    const res = await call('put', req);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(save).not.toHaveBeenCalled();
  });

  test('PUT reports forbidden connection access', async () => {
    save.mockRejectedValue(
      new Error('OAuth connection not authorized')
    );

    const res = await call('put');

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('PUT rejects unverified assets', async () => {
    save.mockRejectedValue(
      new Error(
        'One or more selected assets are not accessible'
      )
    );

    const res = await call('put');

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('PUT returns a conflict for concurrent changes', async () => {
    save.mockRejectedValue(
      new Error(
        'OAuth connection changed; retry asset selection'
      )
    );

    const res = await call('put');

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('PUT does not disclose unexpected errors', async () => {
    save.mockRejectedValue(
      new Error('sensitive-database-details')
    );

    const res = await call('put');

    expect(res.status).toHaveBeenCalledWith(503);

    expect(JSON.stringify(res.json.mock.calls))
      .not.toContain('sensitive-database-details');
  });
});