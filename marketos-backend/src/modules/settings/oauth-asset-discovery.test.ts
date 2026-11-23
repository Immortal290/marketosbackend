import {
  discoverOAuthAssets,
  listAccessibleOAuthAssets,
} from './oauth-asset-discovery';

import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));

const execute = jest.mocked(executeAuthorizedOAuthOperation);

let fetchMock: jest.SpyInstance;

const originalDeveloperToken =
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

function reply(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  jest.resetAllMocks();

  fetchMock = jest.spyOn(globalThis, 'fetch');

  process.env.GOOGLE_ADS_DEVELOPER_TOKEN =
    'fake-developer-token';

  (execute as jest.Mock).mockImplementation(
    async (_authorization, operation) =>
      operation('fake-private-token')
  );
});

afterEach(() => {
  fetchMock.mockRestore();
});

afterAll(() => {
  if (originalDeveloperToken === undefined) {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  } else {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN =
      originalDeveloperToken;
  }
});

describe('Verified OAuth asset discovery', () => {
  test('discovers GA4 properties across account-summary pages', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({
        accountSummaries: [{
          propertySummaries: [{
            property: 'properties/123',
            displayName: 'Example Site',
          }],
        }],
        nextPageToken: 'next-page',
      }))
      .mockResolvedValueOnce(reply({
        accountSummaries: [{
          propertySummaries: [{
            property: 'properties/456',
            displayName: 'Another Site',
          }],
        }],
      }));

    const result = await discoverOAuthAssets(
      'ga4', 'fake-private-token'
    );

    expect(result.map((asset) => asset.id)).toEqual([
      'properties/123', 'properties/456',
    ]);

    expect(new URL(fetchMock.mock.calls[1][0])
      .searchParams.get('pageToken')).toBe('next-page');
  });

  test('Google Ads discovery requires a developer token', async () => {
    fetchMock.mockResolvedValue(reply({
      resourceNames: ['customers/1234567890'],
    }));

    const result = await discoverOAuthAssets(
      'google_ads', 'fake-private-token'
    );

    expect(result[0].id).toBe('customers/1234567890');

    expect(fetchMock.mock.calls[0][1].headers[
      'developer-token'
    ]).toBe('fake-developer-token');

    expect(fetchMock.mock.calls[0][1].headers.Authorization)
      .toBe('Bearer fake-private-token');
  });

  test('Google Ads fails closed when developer token is missing', async () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    await expect(discoverOAuthAssets(
      'google_ads', 'fake-private-token'
    )).rejects.toThrow('not configured');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('discovers Meta advertising accounts using safe pagination', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({
        data: [{ id: 'act_123', name: 'Main Ads' }],
        paging: {
          next: 'https://untrusted.example/steal',
          cursors: { after: 'safe-cursor' },
        },
      }))
      .mockResolvedValueOnce(reply({
        data: [{ id: 'act_456', name: 'Secondary Ads' }],
      }));

    const result = await discoverOAuthAssets(
      'meta_ads', 'fake-private-token'
    );

    expect(result.map((asset) => asset.id)).toEqual([
      'act_123', 'act_456',
    ]);

    const secondUrl = new URL(fetchMock.mock.calls[1][0]);

    expect(secondUrl.hostname).toBe('graph.facebook.com');
    expect(secondUrl.searchParams.get('after'))
      .toBe('safe-cursor');
  });

  test('discovers LinkedIn accounts with versioned API headers', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({
        elements: [{
          account: 'urn:li:sponsoredAccount:100',
        }],
        paging: { total: 2 },
      }))
      .mockResolvedValueOnce(reply({
        elements: [{
          account: 'urn:li:sponsoredAccount:200',
        }],
        paging: { total: 2 },
      }));

    const result = await discoverOAuthAssets(
      'linkedin', 'fake-private-token'
    );

    expect(result).toHaveLength(2);

    expect(fetchMock.mock.calls[0][1].headers[
      'LinkedIn-Version'
    ]).toBe('202609');

    expect(new URL(fetchMock.mock.calls[1][0])
      .searchParams.get('start')).toBe('1');
  });

  test('rejects invalid asset identifiers', async () => {
    fetchMock.mockResolvedValue(reply({
      data: [{
        id: 'https://untrusted.example',
        name: 'Invalid',
      }],
    }));

    await expect(discoverOAuthAssets(
      'meta_ads', 'fake-private-token'
    )).rejects.toThrow('Invalid provider asset identifier');
  });

  test('does not disclose provider error contents', async () => {
    fetchMock.mockResolvedValue(reply({
      secret: 'private-provider-error',
    }, 403));

    await expect(discoverOAuthAssets(
      'ga4', 'fake-private-token'
    )).rejects.toThrow(
      'Unable to retrieve provider assets'
    );
  });

  test('uses authorized backend execution with verified identity', async () => {
    fetchMock.mockResolvedValue(reply({
      accountSummaries: [],
    }));

    const result = await listAccessibleOAuthAssets({
      userId: 'verified-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      provider: 'ga4',
    });

    expect(result).toEqual([]);

    expect(execute).toHaveBeenCalledWith(
      {
        userId: 'verified-user',
        workspaceId: 'workspace-1',
        connectionId: 'connection-1',
        operation: 'ga4.read',
      },
      expect.any(Function)
    );
  });

  test('does not fetch assets when authorization fails', async () => {
    execute.mockRejectedValue(
      new Error('OAuth connection not authorized')
    );

    await expect(listAccessibleOAuthAssets({
      userId: 'unauthorized-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      provider: 'meta_ads',
    })).rejects.toThrow('not authorized');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects unsupported providers before execution', async () => {
    await expect(listAccessibleOAuthAssets({
      userId: 'verified-user',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      provider: 'gmail' as any,
    })).rejects.toThrow('Unsupported');

    expect(execute).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
