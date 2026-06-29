import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { HScroll } from "@/components/marketing/HScroll";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { ebooks, webinars, customerStories } from "@/lib/marketing";

function ResourceRow({ items }: { items: typeof ebooks }) {
  return (
    <HScroll>
      {items.map((r) => (
        <div key={r.title} className="w-72 shrink-0">
          <NeoCard accent={r.accent}>
            <NeoBadge tone="info">{r.kind}</NeoBadge>
            <h3 className="mt-3 font-display text-xl font-black">{r.title}</h3>
            <span className="mt-3 inline-block font-mono text-xs font-black uppercase underline underline-offset-2">
              Download
            </span>
          </NeoCard>
        </div>
      ))}
    </HScroll>
  );
}

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="border-b-[3px] border-black bg-neo-ink text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="font-display text-4xl font-black uppercase leading-tight tracking-tight text-neo-yellow md:text-6xl">
            AI marketing resources
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-medium text-white/70">
            Reports, webinars, and customer stories to upgrade your AI marketing
            program.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Ebooks & Reports"
          title="Uplevel your AI with MarketOS reports"
          align="left"
        />
        <div className="mt-8">
          <ResourceRow items={ebooks} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Webinars & Events"
          title="Learn AI with MarketOS webinars"
          align="left"
        />
        <div className="mt-8">
          <ResourceRow items={webinars} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          eyebrow="Customer Stories"
          title="MarketOS customer stories"
          align="left"
        />
        <div className="mt-8">
          <ResourceRow items={customerStories} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pb-8">
        <NewsletterForm />
      </section>
    </div>
  );
}
