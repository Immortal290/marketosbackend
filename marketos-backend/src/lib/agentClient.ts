/**
 * AgentClient — Railway Private Networking bridge
 *
 * All calls to the Python agent service (renewed-dedication) go through
 * this client.  Configure the base URL via:
 *
 *   AGENT_SERVICE_URL=http://renewed-dedication.railway.internal:8000
 *
 * Railway's private networking resolves *.railway.internal hostnames only
 * inside the same Railway project, so the real app port (8000) is used
 * directly — no public proxy or port-remapping involved.
 *
 * For local development, set AGENT_SERVICE_URL=http://localhost:8000 (or
 * wherever your local Python dev server runs).
 */

import { logger } from './logger';

// ── Base URL resolution ──────────────────────────────────────────────────────
// Falls back to localhost:8000 so local dev works with zero extra config.

const AGENT_SERVICE_URL = (
  process.env.AGENT_SERVICE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

logger.info(`[AgentClient] Agent service URL: ${AGENT_SERVICE_URL}`);

// ── Types mirrored from the Python API ──────────────────────────────────────

export interface AgentMeta {
  name: string;
  module: string;
  skills: string[];
  temperature: number | null;
  sla: string;
}

export interface PipelineResult {
  ok: boolean;
  data: Record<string, unknown>;
  error?: string | null;
  meta: {
    agent: string;
    elapsed_ms: number;
    trace_id: string;
    timestamp: string;
  };
}

export interface HealthResult {
  ok: boolean;
  data: {
    status: 'healthy' | 'degraded';
    kafka: string;
    postgres: string;
    redis: string;
    clickhouse: string;
  };
  meta: { timestamp: string };
}

export interface CampaignRunOptions {
  user_intent: string;
  channels?: string[] | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  sender_name?: string;
  company_name?: string;
  company_address?: string;
  unsubscribe_url?: string;
  workspace_id?: string;
}

export interface QueryRunOptions {
  query: string;
  workspace_id?: string;
}

// ── Internal fetch helper ────────────────────────────────────────────────────

interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
}

async function agentFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 30_000 } = opts;
  const url = `${AGENT_SERVICE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Agent service returned ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Agent service request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}

// ── SSE streaming proxy helper ───────────────────────────────────────────────
// Returns the raw ReadableStream so the caller can pipe it directly to the
// Express response as text/event-stream.

export async function agentFetchStream(
  path: string,
  body: unknown,
  timeoutMs = 120_000,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${AGENT_SERVICE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Agent service streaming returned ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    return response.body;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Agent service stream timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * GET /v1/health — Check infrastructure health of the agent service.
 */
export async function getAgentServiceHealth(): Promise<HealthResult> {
  return agentFetch<HealthResult>('/v1/health');
}

/**
 * GET /v1/agents — List all agents registered in the Python service.
 */
export async function listAgents(): Promise<{
  ok: boolean;
  data: { agents: AgentMeta[]; total: number };
}> {
  return agentFetch('/v1/agents');
}

/**
 * POST /v1/agents/{name}/run — Run a single agent with the provided state.
 */
export async function runAgent(
  agentName: string,
  state: Record<string, unknown>,
): Promise<PipelineResult> {
  return agentFetch<PipelineResult>(`/v1/agents/${agentName}/run`, {
    method: 'POST',
    body: { state },
    timeoutMs: 60_000,
  });
}

/**
 * POST /v1/pipeline/campaign — Run the full campaign pipeline synchronously.
 */
export async function runCampaignSync(opts: CampaignRunOptions): Promise<PipelineResult> {
  return agentFetch<PipelineResult>('/v1/pipeline/campaign', {
    method: 'POST',
    body: opts,
    timeoutMs: 120_000,
  });
}

/**
 * POST /v1/pipeline/campaign/async — Submit campaign intent to Kafka (202).
 */
export async function runCampaignAsync(opts: CampaignRunOptions): Promise<{
  ok: boolean;
  data: { campaign_id: string; status: string };
  meta: { poll_url: string };
}> {
  return agentFetch('/v1/pipeline/campaign/async', {
    method: 'POST',
    body: opts,
    timeoutMs: 15_000,
  });
}

/**
 * GET /v1/pipeline/{id}/status — Poll an async campaign's status from the
 * agent service's PostgreSQL store.
 */
export async function getCampaignStatus(campaignId: string): Promise<{
  ok: boolean;
  data: { campaign_id: string; status: string; result_data: unknown };
}> {
  return agentFetch(`/v1/pipeline/${campaignId}/status`);
}

/**
 * POST /v1/pipeline/campaign/stream — SSE-streaming campaign pipeline.
 * Returns the raw ReadableStream.  Pipe it to res:
 *   res.setHeader('Content-Type', 'text/event-stream');
 *   stream.pipeTo(...)
 */
export async function streamCampaign(
  opts: CampaignRunOptions,
): Promise<ReadableStream<Uint8Array>> {
  return agentFetchStream('/v1/pipeline/campaign/stream', opts);
}

/**
 * POST /v1/query/stream — GLM-Orchestrated query pipeline (SSE).
 * Returns the raw ReadableStream.
 */
export async function streamQuery(
  opts: QueryRunOptions,
): Promise<ReadableStream<Uint8Array>> {
  return agentFetchStream('/v1/query/stream', opts, 180_000);
}

// ── Named export for convenient one-import usage ─────────────────────────────

export const agentClient = {
  baseUrl: AGENT_SERVICE_URL,
  getHealth: getAgentServiceHealth,
  listAgents,
  runAgent,
  runCampaignSync,
  runCampaignAsync,
  getCampaignStatus,
  streamCampaign,
  streamQuery,
};

export default agentClient;
