import Link from "next/link";
import { footerColumns } from "@/lib/marketing";
import { NeoButton } from "@/components/ui/NeoButton";

export function Footer() {
  return (
    <footer className="mt-20 border-t-[3px] border-black bg-neo-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-6 border-b-[3px] border-white/30 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-display text-3xl font-black uppercase tracking-tight text-neo-yellow">
              MarketOS
            </div>
            <p className="mt-2 max-w-md font-medium text-white/70">
              The execution platform for intelligent marketing. One click, a
              marketing team that never sleeps.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo">
              <NeoButton variant="primary" size="md">
                Get a Demo
              </NeoButton>
            </Link>
            <Link href="/demo">
              <NeoButton variant="secondary" size="md">
                Start Free Trial
              </NeoButton>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 py-8 md:grid-cols-5">
          {footerColumns.map((col) => (
            <div key={col.heading}>
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neo-cyan">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="cursor-pointer font-medium text-white/70 hover:text-neo-yellow">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t-[3px] border-white/30 pt-6 font-mono text-xs uppercase text-white/60 md:flex-row md:items-center md:justify-between">
          <span>© 2026 MarketOS, Inc.</span>
          <span className="flex gap-4">
            <span className="cursor-pointer hover:text-neo-yellow">
              Privacy
            </span>
            <span className="cursor-pointer hover:text-neo-yellow">Terms</span>
            <span className="cursor-pointer hover:text-neo-yellow">
              Security
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
