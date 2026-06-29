import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { lifecycleSteps, marketingAgents } from "@/lib/marketing";

export default function AgentsPage() {
  return (
    <div className="theme-pastel flex flex-col gap-20">
      <section className="border-b-neo border-neo-ink bg-neo-lime">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <span className="inline-flex border-neo border-neo-ink bg-neo-surface px-3 py-1 font-mono text-xs font-bold uppercase shadow-neo-sm">
            Agents
          </span>
          <h1 className="mt-5 font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
            AI agents that execute marketing end to end
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-medium">
            A different approach to agentic marketing — autonomous specialists
            that run your marketing as a system, not a series of one-off
            prompts.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Lifecycle"
          title="Built to run marketing as a system"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {lifecycleSteps.map((step) => (
            <div
              key={step.number}
              className="border-neo border-neo-ink bg-neo-surface p-4 shadow-neo"
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
          eyebrow="Agent library"
          title="How MarketOS marketing agents work"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {marketingAgents.map((a) => (
            <NeoCard key={a.name} title={a.name} accent={a.accent}>
              <NeoBadge tone="info">{a.role}</NeoBadge>
              <p className="mt-3 font-medium text-black/70">{a.description}</p>
            </NeoCard>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner
          title="Execution, not experimentation"
          subtitle="Deploy a team of marketing agents that delivers real business outcomes."
        />
      </section>
    </div>
  );
}
