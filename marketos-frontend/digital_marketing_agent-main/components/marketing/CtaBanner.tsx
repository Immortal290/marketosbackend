import Link from "next/link";
import { NeoButton } from "@/components/ui/NeoButton";

export interface CtaBannerProps {
  title: string;
  subtitle?: string;
}

export function CtaBanner({ title, subtitle }: CtaBannerProps) {
  return (
    <section className="border-[3px] border-black bg-neo-yellow p-8 shadow-[8px_8px_0_0_#000] md:p-12">
      <div className="flex flex-col items-center gap-5 text-center">
        <h2 className="max-w-3xl font-display text-3xl font-black uppercase tracking-tight md:text-5xl">
          {title}
        </h2>
        {subtitle ? <p className="max-w-2xl font-medium">{subtitle}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/demo">
            <NeoButton variant="primary" size="lg">
              Start Free Trial
            </NeoButton>
          </Link>
          <Link href="/demo">
            <NeoButton variant="ghost" size="lg">
              Get a Demo
            </NeoButton>
          </Link>
        </div>
      </div>
    </section>
  );
}
