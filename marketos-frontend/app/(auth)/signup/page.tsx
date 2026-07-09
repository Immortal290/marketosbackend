"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";
import { AlertCircle, Loader2 } from "lucide-react";

export default function SignupPage() {
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Split "Jane Doe" → firstName: "Jane", lastName: "Doe"
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || undefined;

    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        workspaceName: company || undefined,
      });
      // AuthContext handles redirect → /dashboard
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
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
          Create your account to start your free trial.
        </p>
      </div>

      <NeoCard accent="pink" className="p-8">
        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 border-[2px] border-red-600 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <NeoInput
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
          />
          <NeoInput
            label="Work Email"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <NeoInput
            label="Company Name"
            type="text"
            placeholder="Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
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
                Creating account…
              </span>
            ) : (
              "Create Account"
            )}
          </NeoButton>
        </form>

        <div className="mt-6 text-center font-mono text-xs font-bold text-black/60">
          Already have an account?{" "}
          <Link href="/login" className="text-black underline hover:text-neo-cyan">
            Log in
          </Link>
        </div>
      </NeoCard>
    </div>
  );
}
