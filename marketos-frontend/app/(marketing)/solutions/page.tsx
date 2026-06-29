import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { Tabs } from "@/components/marketing/Tabs";
import {
  solutionsByUseCase,
  solutionsByRole,
  solutionsByIndustry,
} from "@/lib/marketing";

function CardGrid({ items }: { items: typeof solutionsByUseCase }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((s) => (
        <NeoCard key={s.title} title={s.title} accent={s.accent}>
          <p className="font-medium text-black/70">{s.description}</p>
          <Link
            href="/demo"
            className="mt-3 inline-block font-mono text-xs font-black uppercase underline underline-offset-2"
          >
            Get started
          </Link>
        </NeoCard>
      ))}
    </div>
  );
}

const solutionTabs = [
  {
    id: "use-case",
    label: "By Use Case",
    content: <CardGrid items={solutionsByUseCase} />,
  },
  {
    id: "role",
    label: "By Role",
    content: (
      <div className="flex flex-wrap gap-3">
        {solutionsByRole.map((role) => (
          <NeoBadge key={role} tone="warning">
            {role}
          </NeoBadge>
        ))}
      </div>
    ),
  },
  {
    id: "industry",
    label: "By Industry",
    content: <CardGrid items={solutionsByIndustry} />,
  },
];

export default function SolutionsPage() {
  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-5xl px-4 pt-12 text-center">
        <span className="inline-flex border-[2px] border-black bg-neo-pink px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]">
          Solutions
        </span>
        <h1 className="mt-5 font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          AI solutions for every marketer and use case
        </h1>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Explore"
          title="Find the right solution"
          align="left"
        />
        <div className="mt-8">
          <Tabs tabs={solutionTabs} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner title="Start creating with MarketOS today" />
      </section>
    </div>
  );
}
