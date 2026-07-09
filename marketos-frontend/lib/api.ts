/**
 * Typed API client for the MarketOS backend.
 *
 * Features:
 *  - Reads base URL from NEXT_PUBLIC_API_BASE_URL
 *  - Injects Authorization: Bearer <accessToken> on every request
 *  - On 401: silently attempts token refresh, then retries
 *  - On second 401: clears tokens and redirects to /login
 */

import type { AuthTokens } from "./auth-types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://marketosbackend-production.up.railway.app/api/v1";

// ─── Token helpers (localStorage + cookie for middleware) ─────────────────────

const ACCESS_KEY = "marketos_access_token";
const REFRESH_KEY = "marketos_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  // Also set a cookie so Next.js middleware can read it server-side
  document.cookie = `marketos_access_token=${tokens.accessToken}; path=/; max-age=${tokens.expiresIn}; SameSite=Strict`;
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie =
    "marketos_access_token=; path=/; max-age=0; SameSite=Strict";
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function tryRefresh(): Promise<AuthTokens | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as AuthTokens) : null;
  } catch {
    return null;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth = false, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const fetchOpts: RequestInit = {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(`${BASE_URL}${path}`, fetchOpts);

  // 401 → try token refresh once
  if (res.status === 401 && !skipAuth) {
    const newTokens = await tryRefresh();
    if (newTokens) {
      setTokens(newTokens);
      headers["Authorization"] = `Bearer ${newTokens.accessToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...fetchOpts, headers });
    }

    // Still 401 after refresh → force logout
    if (res.status === 401) {
      clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(
      json.error ?? json.message ?? `Request failed: ${res.status}`
    );
  }

  return (json.data ?? json) as T;
}

// ─── Typed endpoint helpers ───────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<AuthTokens>("/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
      }),

    register: (payload: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      workspaceName?: string;
    }) =>
      apiFetch<AuthTokens>("/auth/register", {
        method: "POST",
        body: payload,
        skipAuth: true,
      }),

    refresh: (refreshToken: string) =>
      apiFetch<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        skipAuth: true,
      }),

    logout: () =>
      apiFetch<null>("/auth/logout", { method: "POST" }),

    me: () =>
      apiFetch<{
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        createdAt: string;
      }>("/auth/me"),
  },

  analytics: {
    executive: (dateRange: string = "LAST_30_DAYS") =>
      apiFetch<{
        revenue: number;
        pipeline: number;
        cac: number;
        ltv: number;
        roas: number;
        conversionRate: number;
      }>(`/analytics/executive?dateRange=${dateRange}`),

    channels: (dateRange: string = "LAST_30_DAYS") =>
      apiFetch<Record<string, unknown>>(`/analytics/channels?dateRange=${dateRange}`),

    funnel: (dateRange: string = "LAST_30_DAYS") =>
      apiFetch<
        Array<{
          stage: string;
          count: number;
          convRate: number;
          dropoffRate: number;
        }>
      >(`/analytics/funnel?dateRange=${dateRange}`),

    attribution: (dateRange: string = "LAST_30_DAYS") =>
      apiFetch<{
        model: string;
        channels: Array<{
          channel: string;
          contribution: number;
          revenue: number;
        }>;
      }>(`/analytics/attribution?dateRange=${dateRange}`),

    cohorts: (type: string = "RETENTION") =>
      apiFetch<{
        cohorts: unknown[];
        periods: string[];
      }>(`/analytics/cohorts?type=${type}`),

    journey: (dateRange: string = "LAST_30_DAYS") =>
      apiFetch<{
        topPaths: unknown[];
        touchpoints: unknown[];
        dropoffs: unknown[];
      }>(`/analytics/journey?dateRange=${dateRange}`),
  },
};
