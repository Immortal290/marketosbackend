"use client";

import { useState } from "react";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="border-[3px] border-black bg-neo-lime p-8 shadow-[8px_8px_0_0_#000]">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight md:text-3xl">
        Stay ahead with exclusive AI tips
      </h2>
      <p className="mt-2 font-medium">Subscribe to the MarketOS newsletter.</p>
      {submitted ? (
        <p className="mt-4 font-mono text-sm font-bold uppercase">
          Thanks — you are subscribed!
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <NeoInput
              label="Work email"
              name="newsletter"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <NeoButton
            variant="primary"
            onClick={() => email.trim() && setSubmitted(true)}
          >
            Subscribe
          </NeoButton>
        </div>
      )}
    </div>
  );
}
