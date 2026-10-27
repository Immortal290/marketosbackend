"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const email = String(form.get("email") || "").trim();
    const workspaceName = String(
      form.get("workspaceName") || form.get("companyName") || ""
    ).trim();
    const password = String(form.get("password") || "");

    if (!fullName || !email || !workspaceName || password.length < 8) {
      setError("Please complete all fields and use a password of at least 8 characters.");
      setLoading(false);
      return;
    }

    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    try {
      const result = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          workspaceName,
          password,
        }),
      });

      if (!result.success || !result.data?.accessToken || !result.data?.refreshToken) {
        throw new Error("The server returned an invalid registration response.");
      }

      localStorage.setItem("marketos_token", result.data.accessToken);
      localStorage.setItem("marketos_refresh_token", result.data.refreshToken);

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">MarketOS</h1>
        <p className="mt-2 font-medium text-black/70">Create your account to start your free trial.</p>
      </div>

      <NeoCard accent="pink" className="p-8">
        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          <NeoInput
            label="Full Name"
            name="fullName"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
          <NeoInput
            label="Work Email"
            name="email"
            type="email"
            placeholder="jane@company.com"
            autoComplete="email"
            required
          />
          <NeoInput
            label="Company Name"
            name="workspaceName"
            type="text"
            placeholder="Acme Corp"
            required
          />
          <NeoInput
            label="Password"
            name="password"
            type="password"
            placeholder="Create a password (min. 8 characters)"
            autoComplete="new-password"
            minLength={8}
            required
          />

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
            {loading ? "Creating account..." : "Create Account"}
          </NeoButton>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs font-bold text-black/50">
          <div className="h-px flex-1 bg-black/20" />
          OR
          <div className="h-px flex-1 bg-black/20" />
        </div>

        <GoogleSignIn />

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
