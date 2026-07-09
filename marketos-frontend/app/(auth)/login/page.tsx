"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // AuthContext handles redirect → /dashboard
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">
          MarketOS
        </h1>
        <p className="mt-2 font-medium text-black/70">
          Welcome back. Log in to your account.
        </p>
      </div>

      <NeoCard accent="cyan" className="p-8">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 border-[2px] border-red-600 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <NeoInput
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <NeoInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          <NeoButton
            variant="primary"
            type="submit"
            className="mt-4 w-full justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Logging in…
              </span>
            ) : (
              "Log In"
            )}
          </NeoButton>
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
