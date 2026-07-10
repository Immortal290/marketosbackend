"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">MarketOS</h1>
        <p className="mt-2 font-medium text-black/70">Welcome back. Log in to your account.</p>
      </div>

      <NeoCard accent="cyan" className="p-8">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <NeoInput label="Email Address" type="email" placeholder="you@company.com" required />
          <NeoInput label="Password" type="password" placeholder="••••••••" required />
          
          <NeoButton variant="primary" type="submit" className="mt-4 w-full justify-center">
            Log In
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
