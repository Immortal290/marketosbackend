"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type AuthStatus = "checking" | "authenticated";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const token = localStorage.getItem("marketos_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        await apiRequest("/auth/me");

        if (active) {
          setStatus("authenticated");
        }
      } catch {
        localStorage.removeItem("marketos_token");
        localStorage.removeItem("marketos_refresh_token");

        if (active) {
          router.replace("/login");
        }
      }
    }

    verifySession();

    return () => {
      active = false;
    };
  }, [router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neo-bg font-display">
        <p className="font-mono text-sm font-bold">Verifying your session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
