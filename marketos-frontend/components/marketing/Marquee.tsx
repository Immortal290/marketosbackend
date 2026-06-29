export interface MarqueeProps {
  items: string[];
  heading?: string;
}

export function Marquee({ items, heading }: MarqueeProps) {
  const loop = [...items, ...items];
  return (
    <section className="border-y-[3px] border-black bg-neo-surface py-6">
      {heading ? (
        <p className="mb-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-black/70">
          {heading}
        </p>
      ) : null}
      <div className="neo-marquee">
        <div className="neo-marquee__track">
          {loop.map((item, i) => (
            <span
              key={item + i}
              className="mx-3 inline-flex shrink-0 items-center border-[3px] border-black bg-neo-bg px-4 py-2 font-display text-lg font-black uppercase tracking-tight shadow-[4px_4px_0_0_#000]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
