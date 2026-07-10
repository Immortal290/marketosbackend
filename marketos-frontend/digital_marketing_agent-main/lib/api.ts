// ── API base URL resolution ──────────────────────────────────────────────────
// In the browser:  always use relative /api/v1  → hits Next.js proxy → backend
// Server-side SSR: use NEXT_PUBLIC_API_BASE_URL (with /api/v1 appended)
//
// The Next.js proxy at app/api/v1/[...path]/route.ts forwards every request
// to the real backend using NEXT_PUBLIC_API_BASE_URL server-side, so the
// browser never needs to know the backend's public URL directly.

export function getApiBaseUrl(): string {
  // Client-side: always use relative path → same-origin → Next.js proxy
  if (typeof window !== "undefined") {
    return "/api/v1";
  }

  // Server-side (SSR/API routes): call the backend directly
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl) {
    // Strip trailing slash, then append /api/v1 if not already there
    const base = envUrl.replace(/\/$/, "");
    return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  }

  return "http://localhost:3000/api/v1";
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function getToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("marketos_token") || "";
  }
  return "";
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// SWR fetcher — used by useSWR hooks across the app
export const fetcher = (url: string) => apiRequest(url).then((res: any) => res.data || res);

