import router from './oauth-ga4-report-routes';

import {
  requireJwtAuth,
} from '../../middlewares/jwt-auth.middleware';

import {
  requireOAuthWorkspaceOwner,
} from './oauth-workspace-auth';

import {
  getAuthorizedGA4Summary,
} from './oauth-agent-ga4-report';

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

jest.mock('./oauth-agent-ga4-report', () => ({
  getAuthorizedGA4Summary: jest.fn(),
}));

const report = jest.mocked(getAuthorizedGA4Summary);

function handlers() {
  const layer = (router as any).stack.find(
    (entry: any) =>
      entry.route?.path ===
        '/connections/:connectionId/ga4-summary' &&
      entry.route.methods.get
  );

  if (!layer) {
    throw new Error('GA4 report route not registered');
  }

  return layer.route.stack;
}

function request(): any {
  return {
    params: {
      connectionId: 'connection-1',
    },
    query: {
      propertyId: 'properties/123',
    },
    oauthWorkspace: {
      userId: 'verified-user',
      workspaceId: 'workspace-1',
    },
  };
}

function response(): any {
  const res: any = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

async function call(req = request()) {
  const res = response();
  const stack = handlers();

  await stack[stack.length - 1].handle(req, res);

  return res;
}

beforeEach(() => {
  jest.resetAllMocks();

  report.mockResolvedValue({
    provider: 'ga4',
    propertyId: 'properties/123',
    period: 'last_7_complete_days',
    activeUsers: 42,
    sessions: 64,
  });
});

describe('Authenticated GA4 reporting API', () => {
  test('requires JWT and workspace owner middleware', () => {
    const stack = handlers();

    expect(stack).toHaveLength(3);
    expect(stack[0].handle).toBe(requireJwtAuth);
    expect(stack[1].handle).toBe(
      requireOAuthWorkspaceOwner
    );
  });

  test('returns a token-free aggregate report', async () => {
    const res = await call();

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        provider: 'ga4',
        propertyId: 'properties/123',
        period: 'last_7_complete_days',
        activeUsers: 42,
        sessions: 64,
      },
    });
  });

  test('uses verified identity and workspace', async () => {
    const req = request();

    req.query.userId = 'attacker';
    req.query.workspaceId = 'another-workspace';

    await call(req);

    expect(report).toHaveBeenCalledWith({
      userId: 'verified-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      propertyId: 'properties/123',
    });
  });

  test('rejects missing workspace authorization', async () => {
    const req = request();
    delete req.oauthWorkspace;

    const res = await call(req);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(report).not.toHaveBeenCalled();
  });

  test('rejects invalid property identifiers', async () => {
    const req = request();
    req.query.propertyId = 'https://untrusted.example';

    const res = await call(req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(report).not.toHaveBeenCalled();
  });

  test('rejects invalid connection identifiers', async () => {
    const req = request();
    req.params.connectionId = '../../other-workspace';

    const res = await call(req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(report).not.toHaveBeenCalled();
  });

  test('rejects array-valued query parameters', async () => {
    const req = request();
    req.query.propertyId = ['properties/123'];

    const res = await call(req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(report).not.toHaveBeenCalled();
  });

  test('returns forbidden for unselected properties', async () => {
    report.mockRejectedValue(
      new Error('GA4 property is not authorized')
    );

    const res = await call();

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('does not disclose provider error contents', async () => {
    report.mockRejectedValue(
      new Error('private-provider-token-error')
    );

    const res = await call();

    expect(res.status).toHaveBeenCalledWith(503);

    expect(JSON.stringify(res.json.mock.calls))
      .not.toContain('private-provider-token-error');
  });
});