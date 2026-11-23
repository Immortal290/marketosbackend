import router from './oauth-audience-crm-routes';
import {
  readMailchimpOAuthAudiences,
  readHubSpotOAuthContacts,
} from './oauth-agent-audience-crm-read';

jest.mock('../../middlewares/jwt-auth.middleware', () => ({
  requireJwtAuth: jest.fn((_req, _res, next) => next()),
}));

jest.mock('./oauth-workspace-auth', () => ({
  requireOAuthWorkspaceOwner: jest.fn((_req, _res, next) => next()),
}));

jest.mock('./oauth-agent-audience-crm-read', () => ({
  readMailchimpOAuthAudiences: jest.fn(),
  readHubSpotOAuthContacts: jest.fn(),
}));

const mailchimp = readMailchimpOAuthAudiences as jest.Mock;
const hubspot = readHubSpotOAuthContacts as jest.Mock;

const workspace = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
};

function createResponse() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

async function invoke(path: string, req: any) {
  const layer: any = (router as any).stack.find(
    (item: any) => item.route?.path === path
  );

  if (!layer) throw new Error('Expected OAuth route missing');

  const res = createResponse();

  const handlers = layer.route.stack;

  // Both authentication middlewares must be registered.
  expect(handlers).toHaveLength(3);
  expect(layer.route.methods.get).toBe(true);

  await handlers[2].handle(req, res);

  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

const mailchimpPath =
  '/connections/:connectionId/mailchimp-audiences';

const hubspotPath =
  '/connections/:connectionId/hubspot-contacts';

test('Mailchimp route passes authenticated workspace context', async () => {
  mailchimp.mockResolvedValue({
    provider: 'mailchimp',
    audiences: [{ id: 'aud-1', name: 'Test' }],
  });

  const res = await invoke(mailchimpPath, {
    params: { connectionId: 'connection-1' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(200);
  expect(mailchimp).toHaveBeenCalledWith({
    ...workspace,
    connectionId: 'connection-1',
  });
});

test('HubSpot route passes authenticated workspace context', async () => {
  hubspot.mockResolvedValue({
    provider: 'hubspot',
    contacts: [],
  });

  const res = await invoke(hubspotPath, {
    params: { connectionId: 'connection-2' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(200);
  expect(hubspot).toHaveBeenCalledWith({
    ...workspace,
    connectionId: 'connection-2',
  });
});

test('rejects missing workspace authorization', async () => {
  const res = await invoke(mailchimpPath, {
    params: { connectionId: 'connection-1' },
  });

  expect(res.status).toHaveBeenCalledWith(403);
  expect(mailchimp).not.toHaveBeenCalled();
});

test('rejects invalid connection identifiers', async () => {
  const res = await invoke(hubspotPath, {
    params: { connectionId: '../invalid' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(400);
  expect(hubspot).not.toHaveBeenCalled();
});

test('rejects unauthorized OAuth connections', async () => {
  hubspot.mockRejectedValue(
    new Error('OAuth connection not authorized')
  );

  const res = await invoke(hubspotPath, {
    params: { connectionId: 'connection-1' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(403);
});

test('requires reconnect when OAuth credentials expire', async () => {
  mailchimp.mockRejectedValue(
    new Error('OAuth connection requires reconnection')
  );

  const res = await invoke(mailchimpPath, {
    params: { connectionId: 'connection-1' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(409);
});

test('does not leak provider error messages or tokens', async () => {
  hubspot.mockRejectedValue(
    new Error('Provider secret: mock-sensitive-token')
  );

  const res = await invoke(hubspotPath, {
    params: { connectionId: 'connection-1' },
    oauthWorkspace: workspace,
  });

  expect(res.status).toHaveBeenCalledWith(503);

  expect(JSON.stringify(res.json.mock.calls))
    .not.toContain('mock-sensitive-token');
});
