const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    // If running in browser over HTTPS and env var points to http://localhost, fallback to relative /api/v1
    if (typeof window !== "undefined" && window.location.protocol === "https:" && process.env.NEXT_PUBLIC_API_BASE_URL.includes("localhost")) {
      return "/api/v1";
    }
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  // When running inside the browser (`window` is defined) and no explicit external API URL was injected,
  // ALWAYS use relative path "/api/v1" so it works across Railway, Vercel, Docker, or local proxies.
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  return DEFAULT_API_BASE_URL;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function getToken() {
  if (typeof window !== "undefined") {
    // Modify to match your app's actual token storage key
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

// SWR fetcher function
export const fetcher = (url: string) => apiRequest(url).then((res: any) => res.data || res);
