import { prisma } from '../../lib/prisma';
import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import { listAccessibleOAuthAssets } from './oauth-asset-discovery';
import {
  readAuthorizedGoogleAdsCampaigns,
  readAuthorizedMetaAdsCampaigns,
  readAuthorizedLinkedInAnalytics,
} from './oauth-agent-ad-campaign-read';
import routes from './oauth-ad-campaign-routes';

jest.mock('../../lib/prisma', () => ({
  prisma: { oAuthConnection: { findFirst: jest.fn() } },
}));
jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));
jest.mock('./oauth-asset-discovery', () => ({
  listAccessibleOAuthAssets: jest.fn(),
}));
jest.mock('../../middlewares/jwt-auth.middleware', () => ({
  requireJwtAuth: jest.fn((_req, _res, next) => next()),
}));
jest.mock('./oauth-workspace-auth', () => ({
  requireOAuthWorkspaceOwner: jest.fn((_req, _res, next) => next()),
}));

const findConnection = prisma.oAuthConnection.findFirst as jest.Mock;
const executor = executeAuthorizedOAuthOperation as jest.Mock;
const discover = listAccessibleOAuthAssets as jest.Mock;
const originalFetch = globalThis.fetch;
const originalDevToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const originalGraphVersion = process.env.META_GRAPH_API_VERSION;
const originalLinkedInVersion = process.env.LINKEDIN_MARKETING_VERSION;

const context = {
  userId: 'owner-1', workspaceId: 'ws-1', connectionId: 'conn-1',
};

function foundSelected(assetId: string) {
  findConnection.mockResolvedValue({ selectedAssets: { assetIds: [assetId] } });
  discover.mockResolvedValue([{ id: assetId, type: 'test' }]);
}

function reply(data: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

beforeEach(() => {
  jest.clearAllMocks();
  executor.mockImplementation(async (_auth, work) => work('fake-token'));
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'fake-developer-token';
  delete process.env.META_GRAPH_API_VERSION;
  delete process.env.LINKEDIN_MARKETING_VERSION;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalDevToken === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = originalDevToken;
  if (originalGraphVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
  else process.env.META_GRAPH_API_VERSION = originalGraphVersion;
  if (originalLinkedInVersion === undefined) delete process.env.LINKEDIN_MARKETING_VERSION;
  else process.env.LINKEDIN_MARKETING_VERSION = originalLinkedInVersion;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('Google Ads reads selected and currently accessible customer only', async () => {
  foundSelected('customers/1234567890');
  const fetchMock = jest.fn().mockResolvedValue(reply([
    { results: [{ campaign: { id: '11', name: 'Campaign A', status: 'ENABLED' } }] },
  ]));
  globalThis.fetch = fetchMock;
  const result = await readAuthorizedGoogleAdsCampaigns({
    ...context, assetId: 'customers/1234567890',
  });
  expect(result.campaigns).toEqual([
    { id: '11', name: 'Campaign A', status: 'ENABLED' },
  ]);
  expect(executor.mock.calls[0][0].operation).toBe('google_ads.manage');
  expect(findConnection.mock.calls[0][0].where).toEqual(expect.objectContaining({
    workspaceId: 'ws-1', connectedByUserId: 'owner-1', provider: 'google_ads',
  }));
  expect(fetchMock.mock.calls[0][0]).toContain('/v26/customers/1234567890/googleAds:searchStream');
  const req = fetchMock.mock.calls[0][1];
  expect(req.method).toBe('POST');
  expect(req.headers['developer-token']).toBe('fake-developer-token');
  expect(req.headers.Authorization).toBe('Bearer fake-token');
  expect(JSON.parse(req.body).query).toContain('FROM campaign');
});

test('Meta reads campaigns without modifying advertising accounts', async () => {
  foundSelected('act_12345');
  const fetchMock = jest.fn().mockResolvedValue(reply({
    data: [{ id: '55', name: 'Test', effective_status: 'ACTIVE' }],
  }));
  globalThis.fetch = fetchMock;
  const result = await readAuthorizedMetaAdsCampaigns({ ...context, assetId: 'act_12345' });
  expect(result.campaigns).toEqual([{ id: '55', name: 'Test', status: 'ACTIVE' }]);
  expect(executor.mock.calls[0][0].operation).toBe('meta_ads.read');
  expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  expect(fetchMock.mock.calls[0][0]).toContain('/act_12345/campaigns?');
});

test('rejects Google Ads asset not selected for workspace', async () => {
  findConnection.mockResolvedValue({ selectedAssets: { assetIds: ['customers/9999999999'] } });
  globalThis.fetch = jest.fn();
  await expect(readAuthorizedGoogleAdsCampaigns({
    ...context, assetId: 'customers/1234567890',
  })).rejects.toThrow('Selected OAuth asset not authorized');
  expect(discover).not.toHaveBeenCalled();
  expect(executor).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('rejects provider-revoked asset before token execution', async () => {
  foundSelected('act_12345');
  discover.mockResolvedValue([]);
  await expect(readAuthorizedMetaAdsCampaigns({
    ...context, assetId: 'act_12345',
  })).rejects.toThrow('OAuth asset access revoked');
  expect(executor).not.toHaveBeenCalled();
});

test('rejects foreign OAuth connection', async () => {
  findConnection.mockResolvedValue(null);
  await expect(readAuthorizedMetaAdsCampaigns({
    ...context, assetId: 'act_12345',
  })).rejects.toThrow('OAuth connection not authorized');
  expect(executor).not.toHaveBeenCalled();
});

test('requires backend Google Ads developer token', async () => {
  foundSelected('1234567890');
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  globalThis.fetch = jest.fn();
  await expect(readAuthorizedGoogleAdsCampaigns({
    ...context, assetId: '1234567890',
  })).rejects.toThrow('Google Ads developer token not configured');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('rejects unsafe asset ID before provider access', async () => {
  await expect(readAuthorizedMetaAdsCampaigns({
    ...context, assetId: 'act_12345/../../secrets',
  })).rejects.toThrow('Invalid Meta advertising account ID');
  expect(findConnection).not.toHaveBeenCalled();
});

test('does not return raw provider errors or secret tokens', async () => {
  foundSelected('act_12345');
  globalThis.fetch = jest.fn().mockResolvedValue(reply({
    error: 'secret fake-token',
  }, 403));
  await expect(readAuthorizedMetaAdsCampaigns({
    ...context, assetId: 'act_12345',
  })).rejects.toThrow('Advertising report unavailable (HTTP 403)');
});

function createResponse() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
async function invoke(path: string, req: any) {
  const layer: any = (routes as any).stack.find((x: any) => x.route?.path === path);
  if (!layer) throw new Error('Missing advertising campaign route');
  expect(layer.route.stack).toHaveLength(3);
  expect(layer.route.methods.get).toBe(true);
  const res = createResponse();
  await layer.route.stack[2].handle(req, res);
  return res;
}
const googleRoute = '/connections/:connectionId/google-ads-campaigns';
const metaRoute = '/connections/:connectionId/meta-ads-campaigns';

test('authenticated route reads Google Ads through authorized context', async () => {
  foundSelected('1234567890');
  globalThis.fetch = jest.fn().mockResolvedValue(reply([]));
  const res = await invoke(googleRoute, {
    oauthWorkspace: { userId: 'owner-1', workspaceId: 'ws-1' },
    params: { connectionId: 'conn-1' },
    query: { assetId: '1234567890' },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(findConnection.mock.calls[0][0].where).toEqual(expect.objectContaining({
    connectedByUserId: 'owner-1', workspaceId: 'ws-1',
  }));
});

test('route rejects missing authenticated workspace', async () => {
  const res = await invoke(metaRoute, {
    params: { connectionId: 'conn-1' }, query: { assetId: 'act_12345' },
  });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(findConnection).not.toHaveBeenCalled();
});

test('route rejects invalid identifiers', async () => {
  const res = await invoke(metaRoute, {
    oauthWorkspace: { userId: 'owner-1', workspaceId: 'ws-1' },
    params: { connectionId: '../../bad' }, query: { assetId: 'act_12345' },
  });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(findConnection).not.toHaveBeenCalled();
});

test('route masks revoked provider access', async () => {
  foundSelected('act_12345');
  discover.mockResolvedValue([]);
  const res = await invoke(metaRoute, {
    oauthWorkspace: { userId: 'owner-1', workspaceId: 'ws-1' },
    params: { connectionId: 'conn-1' }, query: { assetId: 'act_12345' },
  });
  expect(res.status).toHaveBeenCalledWith(403);
});


test('LinkedIn retrieves selected account analytics with r_ads_reporting', async () => {
  foundSelected('urn:li:sponsoredAccount:123456');
  const fetchMock = jest.fn().mockResolvedValue(reply({
    elements: [{ impressions: 100, clicks: 3, costInLocalCurrency: '12.34' }],
  }));
  globalThis.fetch = fetchMock;
  const result = await readAuthorizedLinkedInAnalytics({
    ...context, assetId: 'urn:li:sponsoredAccount:123456',
  });
  expect(result.metrics).toEqual([{
    impressions: 100, clicks: 3, costInLocalCurrency: '12.34',
  }]);
  expect(executor.mock.calls[0][0].operation).toBe('linkedin.ads_reporting');
  const request = fetchMock.mock.calls[0];
  expect(request[0]).toContain('api.linkedin.com/rest/adAnalytics');
  expect(request[0]).toContain('accounts=List(urn%3Ali%3AsponsoredAccount%3A123456)');
  expect(request[1].headers['Linkedin-Version']).toBe('202609');
  expect(request[1].method).toBe('GET');
});

test('LinkedIn rejects unselected ad account before network request', async () => {
  findConnection.mockResolvedValue({ selectedAssets: { assetIds: [] } });
  globalThis.fetch = jest.fn();
  await expect(readAuthorizedLinkedInAnalytics({
    ...context, assetId: 'urn:li:sponsoredAccount:123456',
  })).rejects.toThrow('Selected OAuth asset not authorized');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('LinkedIn analytics route uses workspace identity', async () => {
  foundSelected('urn:li:sponsoredAccount:123456');
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ elements: [] }));
  const res = await invoke('/connections/:connectionId/linkedin-analytics', {
    oauthWorkspace: { userId: 'owner-1', workspaceId: 'ws-1' },
    params: { connectionId: 'conn-1' },
    query: { assetId: 'urn:li:sponsoredAccount:123456' },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(executor.mock.calls[0][0].operation).toBe('linkedin.ads_reporting');
});
