"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

export default function SignupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [signupError, setSignupError] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const workspaceName = String(formData.get("workspaceName") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!fullName || !email || !workspaceName || password.length < 8) {
      setSignupError("Complete all fields and use a password of at least 8 characters.");
      return;
    }

    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    setSignupError("");
    setLoading(true);

    try {
      const response = await apiRequest<{
        success: boolean;
        data?: { accessToken?: string };
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          workspaceName,
        }),
      });

      const accessToken = response?.data?.accessToken;

      if (
        response?.success !== true ||
        typeof accessToken !== "string" ||
        accessToken.split(".").length !== 3
      ) {
        throw new Error("Registration was not confirmed");
      }

      localStorage.setItem("marketos_token", accessToken);
      router.replace("/dashboard");
    } catch {
      setSignupError("Registration failed. Check your details or try another email.");
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
          <NeoInput name="fullName" label="Full Name" type="text" placeholder="Jane Doe" required />
          <NeoInput name="email" label="Work Email" type="email" placeholder="jane@company.com" required />
          <NeoInput name="workspaceName" label="Company Name" type="text" placeholder="Acme Corp" required />
          <NeoInput name="password" label="Password" type="password" placeholder="••••••••" required />
          
          <NeoButton variant="primary" type="submit" disabled={loading} className="mt-4 w-full justify-center">
            {loading ? "Creating Account..." : "Create Account"}
          </NeoButton>
          {signupError && (
            <p role="alert" className="text-sm font-bold text-red-700">
              {signupError}
            </p>
          )}
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
