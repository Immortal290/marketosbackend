import Link from "next/link";
import {
  Bot,
  Workflow,
  BrainCircuit,
  Zap,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { Marquee } from "@/components/marketing/Marquee";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { Tabs } from "@/components/marketing/Tabs";
import {
  trustLogos,
  platformPillars,
  solutionsByUseCase,
  customerStories,
} from "@/lib/marketing";

const pillarIcons = { Bot, Workflow, BrainCircuit } as const;

const whyTabs = [
  {
    id: "speed",
    label: "Speed",
    content: (
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-2xl font-black uppercase">
          Campaigns in hours, not weeks
        </h3>
        <p className="font-medium text-black/70">
          Agents take a single brief and produce a full, channel-ready campaign
          while your team sleeps. Review and ship the same day.
        </p>
      </div>
    ),
  },
  {
    id: "scale",
    label: "Scale",
    content: (
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-2xl font-black uppercase">
          Thousands of on-brand variants
        </h3>
        <p className="font-medium text-black/70">
          Personalize across audiences, locales, and channels without adding
          headcount — every asset stays on-brand by construction.
        </p>
      </div>
    ),
  },
  {
    id: "control",
    label: "Control",
    content: (
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-2xl font-black uppercase">
          Governance built in
        </h3>
        <p className="font-medium text-black/70">
          Brand voice, approvals, and audit trails are part of the platform, so
          autonomy never means losing oversight.
        </p>
      </div>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          {/* Left Column */}
          <div className="flex max-w-2xl flex-col gap-6">
            <span className="inline-flex w-fit border-[2px] border-black bg-neo-cyan px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]">
              Agents, Pipelines, and MarketOS IQ
            </span>
            <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight md:text-7xl">
              Put AI agents to work for marketing
            </h1>
            <p className="font-medium text-black/70 md:text-lg">
              MarketOS is the execution platform for intelligent marketing.
              Define one goal and an autonomous team plans, creates, ships, and
              optimizes — around the clock.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup">
                <NeoButton variant="primary" size="lg">
                  Start Free Trial
                </NeoButton>
              </Link>
              <Link href="/login">
                <NeoButton variant="secondary" size="lg">
                  Login
                </NeoButton>
              </Link>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="flex w-full flex-col gap-4 md:w-auto md:min-w-[320px]">
            <NeoCard accent="yellow" className="shadow-neo-lg">
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8" />
                <div>
                  <p className="font-display text-sm font-black uppercase">
                    17 Agents
                  </p>
                  <p className="font-mono text-xs text-black/60">Online Now</p>
                </div>
              </div>
            </NeoCard>
            <NeoCard accent="pink" className="shadow-neo-lg">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8" />
                <div>
                  <p className="font-display text-sm font-black uppercase">
                    24/7 Execution
                  </p>
                  <p className="font-mono text-xs text-black/60">
                    Autonomous Ops
                  </p>
                </div>
              </div>
            </NeoCard>
            <NeoCard accent="cyan" className="shadow-neo-lg">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                <div>
                  <p className="font-display text-sm font-black uppercase">
                    900+ Teams
                  </p>
                  <p className="font-mono text-xs text-black/60">Trust MarketOS</p>
                </div>
              </div>
            </NeoCard>
          </div>
        </div>
      </section>

      <Marquee
        heading="World-class marketing teams trust MarketOS"
        items={trustLogos}
      />

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Platform"
          title="The execution platform for intelligent marketing"
          subtitle="Three connected systems that turn intent into shipped, optimized marketing."
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
          eyebrow="Why MarketOS"
          title="Why modern marketing teams choose MarketOS"
          align="left"
        />
        <div className="mt-8">
          <Tabs tabs={whyTabs} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Solutions"
          title="Solutions for every marketer"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {solutionsByUseCase.map((s) => (
            <NeoCard key={s.title} title={s.title} accent={s.accent}>
              <p className="font-medium text-black/70">{s.description}</p>
              <Link
                href="/solutions"
                className="mt-3 inline-block font-mono text-xs font-black uppercase underline underline-offset-2"
              >
                Explore
              </Link>
            </NeoCard>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Customer Stories"
          title="Proven strategies, real results"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {customerStories.map((s) => (
            <NeoCard key={s.title} accent={s.accent}>
              <NeoBadge tone="info">{s.kind}</NeoBadge>
              <h3 className="mt-3 font-display text-xl font-black">
                {s.title}
              </h3>
              <p className="mt-2 font-medium text-black/70">
                Read how leading teams operationalize AI marketing with
                MarketOS.
              </p>
            </NeoCard>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Trust"
          title="Enterprise-grade security, quality outputs"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <NeoCard title="Secure by design" accent="cyan">
            <ShieldCheck className="mb-2" />
            <p className="font-medium text-black/70">
              SOC 2, SSO, and granular permissions keep enterprise data safe.
            </p>
          </NeoCard>
          <NeoCard title="Governed output" accent="yellow">
            <Zap className="mb-2" />
            <p className="font-medium text-black/70">
              Brand voice and approvals ensure every asset is on-message.
            </p>
          </NeoCard>
          <NeoCard title="Fully observable" accent="lime">
            <BarChart3 className="mb-2" />
            <p className="font-medium text-black/70">
              Every AI decision is logged, attributable, and explainable.
            </p>
          </NeoCard>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner
          title="Your AI success starts here"
          subtitle="Join 900+ teams running marketing as an autonomous system."
        />
      </section>
    </div>
  );
}
