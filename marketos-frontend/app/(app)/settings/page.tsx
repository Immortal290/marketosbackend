import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { settingsNav } from "@/lib/settingsNav";

const accents = ["yellow", "pink", "cyan", "lime"] as const;

export default function SettingsIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Settings
      </h1>
      <div className="grid gap-4 md:grid-cols-2">
        {settingsNav.map((item, i) => (
          <Link key={item.id} href={item.href}>
            <NeoCard title={item.label} accent={accents[i % accents.length]}>
              <p className="font-medium">{item.description}</p>
            </NeoCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
