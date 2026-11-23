import { prisma } from '../../lib/prisma';

import {
  getAuthorizedGA4Summary,
} from './oauth-agent-ga4-report';

import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    oAuthConnection: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));

const findConnection = jest.mocked(
  prisma.oAuthConnection.findFirst
);

const execute = jest.mocked(
  executeAuthorizedOAuthOperation
);

const input = {
  userId: 'verified-user',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  propertyId: 'properties/123',
};

let fetchMock: jest.SpyInstance;

function reply(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function report(users = '42', sessions = '64') {
  return {
    metricHeaders: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    rows: [{
      metricValues: [
        { value: users },
        { value: sessions },
      ],
    }],
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  findConnection.mockResolvedValue({
    selectedAssets: {
      assetIds: ['properties/123'],
      verifiedAt: '2026-11-01T10:00:00.000Z',
    },
  } as any);

  (execute as jest.Mock).mockImplementation(
    async (_authorization, operation) =>
      operation('mock-private-token')
  );

  fetchMock = jest.spyOn(globalThis, 'fetch');
  fetchMock.mockResolvedValue(reply(report()));
});

afterEach(() => {
  fetchMock.mockRestore();
});

describe('Authorized GA4 agent reporting adapter', () => {
  test('returns only aggregate reporting results', async () => {
    const result = await getAuthorizedGA4Summary(input);

    expect(result).toEqual({
      provider: 'ga4',
      propertyId: 'properties/123',
      period: 'last_7_complete_days',
      activeUsers: 42,
      sessions: 64,
    });

    expect(JSON.stringify(result))
      .not.toContain('mock-private-token');
  });

  test('uses the existing OAuth authorization executor', async () => {
    await getAuthorizedGA4Summary(input);

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

  test('calls the fixed GA4 reporting endpoint', async () => {
    await getAuthorizedGA4Summary(input);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport'
    );

    const options = fetchMock.mock.calls[0][1];

    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('error');

    expect(JSON.parse(options.body)).toEqual({
      dateRanges: [{
        startDate: '7daysAgo',
        endDate: 'yesterday',
      }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
      ],
    });
  });

  test('rejects malformed property identifiers', async () => {
    await expect(getAuthorizedGA4Summary({
      ...input,
      propertyId: 'https://untrusted.example',
    })).rejects.toThrow('Invalid GA4 reporting request');

    expect(execute).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects properties that were not selected', async () => {
    findConnection.mockResolvedValue({
      selectedAssets: {
        assetIds: ['properties/456'],
      },
    } as any);

    await expect(
      getAuthorizedGA4Summary(input)
    ).rejects.toThrow('GA4 property is not authorized');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects absent or revoked connections', async () => {
    findConnection.mockResolvedValue(null);

    await expect(
      getAuthorizedGA4Summary(input)
    ).rejects.toThrow('GA4 property is not authorized');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('uses workspace and user isolation in the database', async () => {
    await getAuthorizedGA4Summary(input);

    expect(findConnection).toHaveBeenCalledWith({
      where: {
        id: 'connection-1',
        workspaceId: 'workspace-1',
        connectedByUserId: 'verified-user',
        provider: 'ga4',
        connectionStatus: 'ACTIVE',
      },
      select: {
        selectedAssets: true,
      },
    });
  });

  test('blocks unauthorized operations before provider requests', async () => {
    execute.mockRejectedValue(
      new Error('OAuth workspace access denied')
    );

    await expect(
      getAuthorizedGA4Summary(input)
    ).rejects.toThrow('OAuth workspace access denied');

    expect(findConnection).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('does not disclose Google provider errors', async () => {
    fetchMock.mockResolvedValue(reply({
      error: {
        message: 'private-provider-error',
      },
    }, 403));

    await expect(
      getAuthorizedGA4Summary(input)
    ).rejects.toThrow('GA4 report could not be retrieved');
  });

  test('rejects invalid metric values', async () => {
    fetchMock.mockResolvedValue(
      reply(report('not-a-number', '64'))
    );

    await expect(
      getAuthorizedGA4Summary(input)
    ).rejects.toThrow('Invalid GA4 metric value');
  });

  test('treats empty report rows as zero', async () => {
    fetchMock.mockResolvedValue(reply({
      metricHeaders: [
        { name: 'activeUsers' },
        { name: 'sessions' },
      ],
      rows: [],
    }));

    const result = await getAuthorizedGA4Summary(input);

    expect(result.activeUsers).toBe(0);
    expect(result.sessions).toBe(0);
  });
});
