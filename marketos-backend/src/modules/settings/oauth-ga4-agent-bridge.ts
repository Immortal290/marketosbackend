import { getAuthorizedGA4Summary } from './oauth-agent-ga4-report';

type GA4Input = {
  userId: string;
  workspaceId: string;
  connectionId: string;
  propertyId: string;
};

/**
 * Uses one explicitly configured internal agent endpoint.
 * Never uses the generic multi-endpoint Railway fallback.
 */
function trustedAnalyticsEndpoint(): string {
  const configured = process.env.OAUTH_ANALYTICS_AGENT_URL;

  if (!configured) {
    throw new Error('GA4 analytics agent bridge is not configured');
  }

  let url: URL;

  try {
    url = new URL(configured);
  } catch {
    throw new Error('Invalid GA4 analytics agent endpoint');
  }

  const localHosts = new Set([
    '127.0.0.1',
    'localhost',
    'marketos_oauth_test_agents',
  ]);

  const isProduction = process.env.NODE_ENV === 'production';

  const trustedHost = isProduction
    ? url.hostname.endsWith('.railway.internal') &&
      url.hostname !== 'railway.internal'
    : localHosts.has(url.hostname);

  if (
    url.protocol !== 'http:' ||
    !trustedHost ||
    url.port !== '8000' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('Untrusted GA4 analytics agent endpoint');
  }

  return `${url.origin}/v1/agents/analytics/run`;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid analytics agent response');
  }

  return value as Record<string, unknown>;
}

/**
 * Authorization happens in Node. Only aggregate GA4 metrics
 * are sent to the internal Python AnalyticsAgent.
 */
export async function analyzeAuthorizedGA4(input: GA4Input) {
  const endpoint = trustedAnalyticsEndpoint();

  const summary = await getAuthorizedGA4Summary(input);

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: {
          ga4_mode: 'standalone',
          ga4_summary: summary,
        },
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error('GA4 analytics agent unavailable');
  }

  if (!response.ok) {
    throw new Error('GA4 analytics agent unavailable');
  }

  let result: Record<string, unknown>;

  try {
    result = record(await response.json());
  } catch {
    throw new Error('Invalid analytics agent response');
  }

  if (result.ok !== true) {
    throw new Error('GA4 analytics agent failed');
  }

  const data = record(result.data);
  const analytics = record(data.analytics_result);

  if (analytics.source !== 'ga4') {
    throw new Error('Unexpected analytics source');
  }

  const insight = record(analytics.insight);

  // Never return the entire Python state or raw provider response.
  return {
    source: 'ga4' as const,
    summary,
    insight,
  };
}