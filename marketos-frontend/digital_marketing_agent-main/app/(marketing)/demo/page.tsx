import { Check } from "lucide-react";
import { Marquee } from "@/components/marketing/Marquee";
import { DemoForm } from "@/components/marketing/DemoForm";
import { trustLogos } from "@/lib/marketing";

const bullets = [
  "Deliver context-rich, on-brand content consistently and at scale",
  "Increase campaign velocity and impact across your team",
  "Scale an AI marketing program that delivers real ROI",
];

export default function DemoPage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="mx-auto w-full max-w-6xl px-4 pt-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-5xl">
              Get a demo of the AI platform built for marketing teams
            </h1>
            <ul className="flex flex-col gap-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 font-medium">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-black bg-neo-lime">
                    <Check size={12} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <DemoForm />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="flex h-64 items-center justify-center border-[3px] border-black bg-neo-bg shadow-[8px_8px_0_0_#000]">
          <span className="font-mono text-sm font-bold uppercase tracking-widest text-black/50">
            Product preview
          </span>
        </div>
      </section>

      <Marquee items={trustLogos} />
    </div>
  );
}
