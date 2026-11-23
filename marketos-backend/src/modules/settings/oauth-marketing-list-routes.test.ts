import { readMailchimpOAuthCampaigns, readHubSpotOAuthLists } from './oauth-agent-marketing-list-read';
import routes from './oauth-marketing-list-routes';
import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';

jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));
jest.mock('../../middlewares/jwt-auth.middleware', () => ({
  requireJwtAuth: jest.fn((_req, _res, next) => next()),
}));
jest.mock('./oauth-workspace-auth', () => ({
  requireOAuthWorkspaceOwner: jest.fn((_req, _res, next) => next()),
}));

const executor = executeAuthorizedOAuthOperation as jest.Mock;
const realFetch = globalThis.fetch;
const context = { userId: 'user', workspaceId: 'workspace', connectionId: 'connection' };
const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => data,
});

function response() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function invoke(path: string, req: any) {
  const layer: any = (routes as any).stack.find((x: any) => x.route?.path === path);
  if (!layer) throw new Error('Missing protected OAuth route');
  expect(layer.route.stack).toHaveLength(3);
  expect(layer.route.methods.get).toBe(true);
  const res = response();
  await layer.route.stack[2].handle(req, res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  executor.mockImplementation(async (_auth, action) => action('mock-token'));
});
afterEach(() => { globalThis.fetch = realFetch; });

test('Mailchimp campaigns use scoped OAuth and a validated data center', async () => {
  const fake = jest.fn()
    .mockResolvedValueOnce(jsonResponse({ dc: 'us6' }))
    .mockResolvedValueOnce(jsonResponse({ campaigns: [{ id: 'c1', status: 'save', settings: { title: 'Draft', subject_line: 'Test' } }] }));
  globalThis.fetch = fake;
  const result = await readMailchimpOAuthCampaigns(context);
  expect(result.campaigns).toEqual([{ id: 'c1', status: 'save', title: 'Draft', subject: 'Test' }]);
  expect(executor.mock.calls[0][0].operation).toBe('mailchimp.read');
  expect(fake.mock.calls[1][0]).toBe('https://us6.api.mailchimp.com/3.0/campaigns?count=10');
  expect(fake.mock.calls[1][1].method).toBe('GET');
});

test('Mailchimp prevents malicious host injection', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse({ dc: 'us6.evil.example' }));
  await expect(readMailchimpOAuthCampaigns(context)).rejects.toThrow('Invalid Mailchimp account data center');
  expect((globalThis.fetch as jest.Mock)).toHaveBeenCalledTimes(1);
});

test('HubSpot lists require the dedicated crm.lists.read operation', async () => {
  const fake = jest.fn().mockResolvedValue(jsonResponse({ lists: [{ listId: '42', name: 'Leads', processingType: 'DYNAMIC' }] }));
  globalThis.fetch = fake;
  const result = await readHubSpotOAuthLists(context);
  expect(result.lists).toEqual([{ id: '42', name: 'Leads', processingType: 'DYNAMIC' }]);
  expect(executor.mock.calls[0][0].operation).toBe('hubspot.lists_read');
  expect(fake.mock.calls[0][0]).toBe('https://api.hubapi.com/crm/v3/lists/search');
  expect(fake.mock.calls[0][1].method).toBe('POST');
  expect(JSON.parse(fake.mock.calls[0][1].body)).toEqual({ offset: 0, count: 10 });
});

test('provider errors never include OAuth tokens', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 403));
  await expect(readHubSpotOAuthLists(context)).rejects.toThrow('Provider operation unavailable (HTTP 403)');
});

test('the route uses authentication and derived workspace identity', async () => {
  const fake = jest.fn().mockResolvedValue(jsonResponse({ lists: [] }));
  globalThis.fetch = fake;
  const res = await invoke('/connections/:connectionId/hubspot-lists', {
    params: { connectionId: 'conn-1' }, oauthWorkspace: { userId: 'owner-1', workspaceId: 'ws-1' },
    body: { userId: 'attacker', workspaceId: 'other' },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(executor.mock.calls[0][0]).toEqual({
    userId: 'owner-1', workspaceId: 'ws-1', connectionId: 'conn-1', operation: 'hubspot.lists_read',
  });
});

test('route rejects absent workspace and malformed connection', async () => {
  const noWorkspace = await invoke('/connections/:connectionId/mailchimp-campaigns', {
    params: { connectionId: 'conn-1' },
  });
  expect(noWorkspace.status).toHaveBeenCalledWith(403);
  const invalid = await invoke('/connections/:connectionId/mailchimp-campaigns', {
    params: { connectionId: '../another' }, oauthWorkspace: { userId: 'u', workspaceId: 'w' },
  });
  expect(invalid.status).toHaveBeenCalledWith(400);
  expect(executor).not.toHaveBeenCalled();
});

test('route maps scope denial to 403 and hides provider details', async () => {
  executor.mockRejectedValue(new Error('Required OAuth permission not granted'));
  const res = await invoke('/connections/:connectionId/hubspot-lists', {
    params: { connectionId: 'conn-1' }, oauthWorkspace: { userId: 'u', workspaceId: 'w' },
  });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('token');
});
