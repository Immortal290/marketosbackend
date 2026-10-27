"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ScanEye } from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setLoginError("");
    setLoading(true);

    try {
      const response = await apiRequest<{
        success: boolean;
        data?: { accessToken?: string };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const accessToken = response?.data?.accessToken;

      if (
        response?.success !== true ||
        typeof accessToken !== "string" ||
        accessToken.split(".").length !== 3
      ) {
        throw new Error("Authentication was not confirmed");
      }

      localStorage.setItem("marketos_token", accessToken);
      router.replace("/dashboard");
    } catch {
      setLoginError("Login failed. Check your email and password.");
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
          <NeoInput name="email" label="Email Address" type="email" placeholder="you@company.com" required />
          <div className="relative">
            <NeoInput
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="field-password"
              className="absolute bottom-2.5 right-3 flex h-7 w-7 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <ScanEye
                size={19}
                aria-hidden="true"
                className={showPassword ? "text-black" : "text-black/60"}
              />
            </button>
          </div>
          
          <NeoButton variant="primary" type="submit" disabled={loading} className="mt-4 w-full justify-center">
            {loading ? "Logging in..." : "Log In"}
          </NeoButton>
          {loginError && (
            <p role="alert" className="text-sm font-bold text-red-700">
              {loginError}
            </p>
          )}
        </form>

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
