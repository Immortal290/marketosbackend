export interface StatBlockProps {
  value: string;
  description: string;
}

export function StatBlock({ value, description }: StatBlockProps) {
  return (
    <div className="border-[3px] border-black bg-neo-surface p-6 text-center shadow-[6px_6px_0_0_#000]">
      <div className="font-display text-5xl font-black md:text-6xl">
        {value}
      </div>
      <p className="mt-2 font-mono text-xs font-bold uppercase tracking-tight text-black/70">
        {description}
      </p>
    </div>
  );
}
