/**
 * MarketOS API Client
 *
 * All requests are routed through the Next.js server-side proxy at /api/v1/[...path].
 * The proxy (app/api/v1/[...path]/route.ts) forwards to the real backend using
 * NEXT_PUBLIC_API_BASE_URL, which is available server-side at runtime.
 *
 * This avoids the Next.js build-time NEXT_PUBLIC_ baking problem: even if the env
 * var wasn't present during `next build`, the proxy reads it correctly at request time.
 * It also eliminates CORS issues since the browser only ever calls same-origin /api/v1/...
 */

// Use a relative URL so requests go through the Next.js proxy (/api/v1/...)
// Works in development (localhost) and production (Railway) identically.
const API_BASE = '';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    // Empty baseUrl → relative URL → hits Next.js proxy → forwarded to backend
    const url = `${this.baseUrl}/api/v1${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error(`[API] ${path} failed:`, error);
      throw error;
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async getExecutiveAnalytics(dateRange = 'LAST_30_DAYS') {
    return this.request<any>(`/analytics/executive?dateRange=${dateRange}`);
  }

  async getRealtimeAnalytics() {
    return this.request<{
      connected: boolean;
      latestSnapshot: any;
      anomalies: any[];
      lastUpdated: string;
    }>('/analytics/realtime');
  }

  async getAttribution(model = 'MULTI_TOUCH') {
    return this.request<any>(`/analytics/attribution?model=${model}`);
  }

  async getChannelAnalytics(channel?: string) {
    const params = channel ? `?channel=${channel}` : '';
    return this.request<any>(`/analytics/channels${params}`);
  }

  async getFunnelAnalytics(dateRange = 'LAST_30_DAYS') {
    return this.request<any>(`/analytics/funnel?dateRange=${dateRange}`);
  }

  async getJourneyAnalytics() {
    return this.request<any>('/analytics/journey');
  }

  async getCohortAnalytics(type = 'RETENTION') {
    return this.request<any>(`/analytics/cohorts?type=${type}`);
  }

  // ── Monitoring ─────────────────────────────────────────────────────────

  async getSystemHealth() {
    return this.request<any>('/monitoring/health');
  }

  async getAlerts(severity?: string) {
    const params = severity ? `?severity=${severity}` : '';
    return this.request<any>(`/monitoring/alerts${params}`);
  }

  async resolveAlert(id: string, note?: string) {
    return this.request<any>(`/monitoring/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async getIncidents() {
    return this.request<any>('/monitoring/incidents');
  }

  async getRemediation() {
    return this.request<any>('/monitoring/remediation');
  }

  // ── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard() {
    return this.request<any>('/dashboard');
  }

  // ── Campaigns ──────────────────────────────────────────────────────────

  async getCampaigns() {
    return this.request<any>('/campaigns');
  }

  async getCampaignDetail(id: string) {
    return this.request<any>(`/campaign-detail/${id}`);
  }
}

export const api = new ApiClient(API_BASE);


interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error(`[API] ${path} failed:`, error);
      throw error;
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async getExecutiveAnalytics(dateRange = 'LAST_30_DAYS') {
    return this.request<any>(`/analytics/executive?dateRange=${dateRange}`);
  }

  async getRealtimeAnalytics() {
    return this.request<{
      connected: boolean;
      latestSnapshot: any;
      anomalies: any[];
      lastUpdated: string;
    }>('/analytics/realtime');
  }

  async getAttribution(model = 'MULTI_TOUCH') {
    return this.request<any>(`/analytics/attribution?model=${model}`);
  }

  async getChannelAnalytics(channel?: string) {
    const params = channel ? `?channel=${channel}` : '';
    return this.request<any>(`/analytics/channels${params}`);
  }

  async getFunnelAnalytics(dateRange = 'LAST_30_DAYS') {
    return this.request<any>(`/analytics/funnel?dateRange=${dateRange}`);
  }

  async getJourneyAnalytics() {
    return this.request<any>('/analytics/journey');
  }

  async getCohortAnalytics(type = 'RETENTION') {
    return this.request<any>(`/analytics/cohorts?type=${type}`);
  }

  // ── Monitoring ─────────────────────────────────────────────────────────

  async getSystemHealth() {
    return this.request<any>('/monitoring/health');
  }

  async getAlerts(severity?: string) {
    const params = severity ? `?severity=${severity}` : '';
    return this.request<any>(`/monitoring/alerts${params}`);
  }

  async resolveAlert(id: string, note?: string) {
    return this.request<any>(`/monitoring/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async getIncidents() {
    return this.request<any>('/monitoring/incidents');
  }

  async getRemediation() {
    return this.request<any>('/monitoring/remediation');
  }

  // ── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard() {
    return this.request<any>('/dashboard');
  }

  // ── Campaigns ──────────────────────────────────────────────────────────

  async getCampaigns() {
    return this.request<any>('/campaigns');
  }

  async getCampaignDetail(id: string) {
    return this.request<any>(`/campaign-detail/${id}`);
  }
}

export const api = new ApiClient(API_BASE);
