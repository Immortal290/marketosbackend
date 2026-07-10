"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

export default function SignupPage() {
  const router = useRouter();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">MarketOS</h1>
        <p className="mt-2 font-medium text-black/70">Create your account to start your free trial.</p>
      </div>

      <NeoCard accent="pink" className="p-8">
        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          <NeoInput label="Full Name" type="text" placeholder="Jane Doe" required />
          <NeoInput label="Work Email" type="email" placeholder="jane@company.com" required />
          <NeoInput label="Company Name" type="text" placeholder="Acme Corp" required />
          <NeoInput label="Password" type="password" placeholder="••••••••" required />
          
          <NeoButton variant="primary" type="submit" className="mt-4 w-full justify-center">
            Create Account
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
