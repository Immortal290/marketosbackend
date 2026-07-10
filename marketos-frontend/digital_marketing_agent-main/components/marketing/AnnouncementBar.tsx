import Link from "next/link";
import { Megaphone } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="w-full border-b-[3px] border-black bg-neo-pink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-center">
        <span className="inline-flex items-center gap-1 border-[2px] border-black bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000]">
          <Megaphone size={12} /> GEO Diagnostic
        </span>
        <span className="font-mono text-xs font-bold uppercase tracking-tight">
          Find out what AI is saying about your brand.
        </span>
        <Link
          href="/demo"
          className="font-mono text-xs font-black uppercase underline underline-offset-2"
        >
          Get your score today
        </Link>
      </div>
    </div>
  );
}
