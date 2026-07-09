"use client";

/**
 * AuthContext — provides authentication state and actions to all app pages.
 *
 * Usage:
 *   const { user, isAuthenticated, login, logout, register } = useAuth();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./api";
import type { User, RegisterPayload } from "./auth-types";

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount: try to restore session from stored token
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.auth
      .me()
      .then(setUser)
      .catch(() => {
        // Token invalid/expired — try refresh
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearTokens();
          setIsLoading(false);
          return;
        }
        api.auth
          .refresh(refreshToken)
          .then((tokens) => {
            setTokens(tokens);
            return api.auth.me();
          })
          .then(setUser)
          .catch(() => {
            clearTokens();
          })
          .finally(() => setIsLoading(false));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.auth.login(email, password);
      setTokens(tokens);
      const me = await api.auth.me();
      setUser(me);
      router.push("/dashboard");
    },
    [router]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const tokens = await api.auth.register(payload);
      setTokens(tokens);
      const me = await api.auth.me();
      setUser(me);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore errors — we always clear tokens locally
    } finally {
      clearTokens();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
