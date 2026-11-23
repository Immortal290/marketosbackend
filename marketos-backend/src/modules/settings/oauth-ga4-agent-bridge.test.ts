import { getAuthorizedGA4Summary } from './oauth-agent-ga4-report';
import { analyzeAuthorizedGA4 } from './oauth-ga4-agent-bridge';

jest.mock('./oauth-agent-ga4-report', () => ({
  getAuthorizedGA4Summary: jest.fn(),
}));

const summaryFn = jest.mocked(getAuthorizedGA4Summary);

const input = {
  userId: 'verified-user',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  propertyId: 'properties/123',
};

const summary = {
  provider: 'ga4' as const,
  propertyId: 'properties/123',
  period: 'last_7_complete_days' as const,
  activeUsers: 42,
  sessions: 64,
};

let fetchSpy: jest.SpyInstance;
let previousUrl: string | undefined;

beforeEach(() => {
  jest.resetAllMocks();

  previousUrl = process.env.OAUTH_ANALYTICS_AGENT_URL;
  process.env.OAUTH_ANALYTICS_AGENT_URL =
    'http://marketos_oauth_test_agents:8000';

  summaryFn.mockResolvedValue(summary);

  fetchSpy = jest.spyOn(globalThis, 'fetch');

  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        analytics_result: {
          source: 'ga4',
          insight: {
            overall_health: 'good',
            top_insight: 'Website traffic analyzed',
          },
        },
      },
    }),
  });
});

afterEach(() => {
  fetchSpy.mockRestore();

  if (previousUrl === undefined) {
    delete process.env.OAUTH_ANALYTICS_AGENT_URL;
  } else {
    process.env.OAUTH_ANALYTICS_AGENT_URL = previousUrl;
  }
});

describe('Trusted GA4-to-AnalyticsAgent bridge', () => {
  test('sends aggregate metrics but never OAuth tokens', async () => {
    const result = await analyzeAuthorizedGA4(input);

    expect(result.source).toBe('ga4');
    expect(result.summary.activeUsers).toBe(42);

    const [url, options] = fetchSpy.mock.calls[0];

    expect(url).toBe(
      'http://marketos_oauth_test_agents:8000/v1/agents/analytics/run'
    );

    expect(JSON.parse(options.body)).toEqual({
      state: {
        ga4_mode: 'standalone',
        ga4_summary: summary,
      },
    });

    expect(options.redirect).toBe('error');
    expect(options.body).not.toContain('accessToken');
    expect(options.body).not.toContain('mock-private-token');
  });

  test('refuses execution without explicit configuration', async () => {
    delete process.env.OAUTH_ANALYTICS_AGENT_URL;

    await expect(
      analyzeAuthorizedGA4(input)
    ).rejects.toThrow('not configured');

    expect(summaryFn).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('blocks untrusted external destinations', async () => {
    process.env.OAUTH_ANALYTICS_AGENT_URL =
      'https://untrusted.example:8000';

    await expect(
      analyzeAuthorizedGA4(input)
    ).rejects.toThrow('Untrusted');

    expect(summaryFn).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('does not call Python after failed OAuth authorization', async () => {
    summaryFn.mockRejectedValue(
      new Error('GA4 property is not authorized')
    );

    await expect(
      analyzeAuthorizedGA4(input)
    ).rejects.toThrow('GA4 property is not authorized');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fails closed when the Python service rejects the request', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(
      analyzeAuthorizedGA4(input)
    ).rejects.toThrow('GA4 analytics agent unavailable');
  });
});