"use client";

import { useState } from "react";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

const teamSizes = ["1-10", "11-50", "51-100", "101-500", "501+"];

export function DemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [teamSize, setTeamSize] = useState(teamSizes[0]);

  if (submitted) {
    return (
      <div className="border-[3px] border-black bg-neo-lime p-6 shadow-[6px_6px_0_0_#000]">
        <h3 className="font-display text-2xl font-black uppercase">Thanks!</h3>
        <p className="mt-2 font-medium">
          Our team will reach out to schedule your demo.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-4 border-[3px] border-black bg-neo-surface p-6 shadow-[6px_6px_0_0_#000]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NeoInput label="First Name" name="firstName" required />
        <NeoInput label="Last Name" name="lastName" required />
      </div>
      <NeoInput label="Work Email" name="email" type="email" required />
      <NeoInput label="Company Name" name="company" required />
      <div className="flex flex-col gap-1">
        <label
          htmlFor="teamSize"
          className="font-mono text-xs font-bold uppercase tracking-tight"
        >
          Marketing Team Size
        </label>
        <select
          id="teamSize"
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          className="border-[3px] border-black rounded-none bg-neo-surface px-3 py-2 font-medium shadow-[2px_2px_0_0_#000]"
        >
          {teamSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <NeoButton type="submit" variant="primary" size="lg" fullWidth>
        Request Demo
      </NeoButton>
    </form>
  );
}
