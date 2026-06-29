import {
  Bot,
  Workflow,
  BrainCircuit,
  GitBranch,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { Marquee } from "@/components/marketing/Marquee";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { trustLogos, platformPillars, lifecycleSteps } from "@/lib/marketing";

const pillarIcons = { Bot, Workflow, BrainCircuit } as const;

export default function PlatformPage() {
  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-5xl px-4 pt-12 text-center">
        <span className="inline-flex border-[2px] border-black bg-neo-yellow px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]">
          Platform
        </span>
        <h1 className="mt-5 font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          One intelligent workspace for your whole marketing operation
        </h1>
        <p className="mx-auto mt-4 max-w-2xl font-medium text-black/70">
          MarketOS connects your team, brand, content, workflows, agents,
          knowledge, and rules — all in one place built to execute marketing end
          to end.
        </p>
      </section>

      <Marquee items={trustLogos} />

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Built to execute"
          title="AI built to run marketing end to end"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {platformPillars.map((p) => {
            const Icon = pillarIcons[p.icon as keyof typeof pillarIcons];
            return (
              <NeoCard key={p.title} title={p.title} accent={p.accent}>
                {Icon ? <Icon className="mb-2" /> : null}
                <p className="font-medium text-black/70">{p.description}</p>
              </NeoCard>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Content Pipelines"
          title="Structured systems for repeatable execution"
          subtitle="A single brief flows through every stage automatically."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {lifecycleSteps.map((step) => (
            <div
              key={step.number}
              className="border-[3px] border-black bg-neo-surface p-4 shadow-[6px_6px_0_0_#000]"
            >
              <div className="font-display text-3xl font-black text-neo-pink">
                {step.number}
              </div>
              <h3 className="mt-1 font-display text-lg font-black uppercase">
                {step.title}
              </h3>
              <p className="mt-1 font-medium text-black/70">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Governance"
          title="Governance, context, and control — built in"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <NeoCard title="Brand IQ" accent="cyan">
            <Boxes className="mb-2" />
            <p className="font-medium text-black/70">
              Centralize brand voice, guidelines, and knowledge every agent
              uses.
            </p>
          </NeoCard>
          <NeoCard title="No-Code Builder" accent="yellow">
            <GitBranch className="mb-2" />
            <p className="font-medium text-black/70">
              Compose custom agents and workflows without engineering.
            </p>
          </NeoCard>
          <NeoCard title="Compliance" accent="lime">
            <ShieldCheck className="mb-2" />
            <p className="font-medium text-black/70">
              Approvals, audit logs, and policy controls for regulated teams.
            </p>
          </NeoCard>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner
          title="From system to impact"
          subtitle="See how MarketOS turns structure into measurable results."
        />
      </section>
    </div>
  );
}
