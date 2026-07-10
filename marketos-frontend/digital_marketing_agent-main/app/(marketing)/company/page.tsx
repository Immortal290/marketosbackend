import Link from "next/link";
import { NeoButton } from "@/components/ui/NeoButton";
import { StatBlock } from "@/components/marketing/StatBlock";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { companyStats } from "@/lib/marketing";

const leaders = [
  { name: "Jordan Avery", title: "Chief Executive Officer" },
  { name: "Priya Nair", title: "Chief Product Officer" },
  { name: "Marcus Cole", title: "Chief Technology Officer" },
  { name: "Lena Fischer", title: "Chief Marketing Officer" },
];

export default function CompanyPage() {
  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-4xl px-4 pt-12 text-center">
        <h1 className="font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          Elevate all marketing and all marketers with the power of AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-medium text-black/70 md:text-lg">
          At MarketOS, we are closing the gap between idea and impact —
          transforming the future of marketing one idea, one story, one brand at
          a time.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="grid gap-4 md:grid-cols-3">
          {companyStats.map((s) => (
            <StatBlock
              key={s.value}
              value={s.value}
              description={s.description}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Team"
          title="Leading the way to marketing excellence"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {leaders.map((leader, i) => {
            const accents = [
              "bg-neo-yellow",
              "bg-neo-pink",
              "bg-neo-cyan",
              "bg-neo-lime",
            ];
            return (
              <div
                key={leader.name}
                className="border-[3px] border-black bg-neo-surface shadow-[6px_6px_0_0_#000]"
              >
                <div
                  className={`h-32 border-b-[3px] border-black ${accents[i % accents.length]}`}
                />
                <div className="p-4">
                  <div className="font-display text-lg font-black">
                    {leader.name}
                  </div>
                  <div className="font-mono text-xs uppercase text-black/60">
                    {leader.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <div className="border-[3px] border-black bg-neo-cyan p-8 text-center shadow-[8px_8px_0_0_#000] md:p-12">
          <h2 className="font-display text-3xl font-black uppercase tracking-tight md:text-5xl">
            Join the fastest growing AI platform for marketing
          </h2>
          <div className="mt-6">
            <Link href="/demo">
              <NeoButton variant="primary" size="lg">
                Explore Careers
              </NeoButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
