"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanEye } from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";
import { apiRequest } from "@/lib/api";
import GoogleSignIn from "@/components/auth/GoogleSignIn";

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const result = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!result.success || !result.data?.accessToken || !result.data?.refreshToken) {
        throw new Error("The server returned an invalid authentication response.");
      }

      localStorage.setItem("marketos_token", result.data.accessToken);
      localStorage.setItem("marketos_refresh_token", result.data.refreshToken);

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">MarketOS</h1>
        <p className="mt-2 font-medium text-black/70">Welcome back. Log in to your account.</p>
      </div>

      <NeoCard accent="cyan" className="p-8">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <NeoInput
            label="Email Address"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
          <div className="relative">
            <NeoInput
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute bottom-2.5 right-3 flex h-7 w-7 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <ScanEye
                size={19}
                aria-hidden="true"
                className={showPassword ? "text-black" : "text-black/60"}
              />
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <NeoButton
            variant="primary"
            type="submit"
            disabled={loading}
            className="mt-4 w-full justify-center"
          >
            {loading ? "Logging in..." : "Log In"}
          </NeoButton>
        </form>

        {Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs font-bold text-black/50">
              <div className="h-px flex-1 bg-black/20" />
              OR
              <div className="h-px flex-1 bg-black/20" />
            </div>

            <GoogleSignIn />
          </>
        )}

        <div className="mt-6 text-center font-mono text-xs font-bold text-black/60">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-black underline hover:text-neo-pink">
            Sign up
          </Link>
        </div>
      </NeoCard>
    </div>
  );
}
