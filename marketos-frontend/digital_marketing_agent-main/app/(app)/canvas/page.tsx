import { CtaBanner } from "@/components/marketing/CtaBanner";

const stickySections = [
  {
    heading:
      "Use AI-powered agents in Canvas to set every project up for success",
    body: "Bring agents directly into your workspace so every brief starts grounded in brand and data.",
    accent: "bg-neo-yellow",
  },
  {
    heading: "Optimize with data-grounded campaign insights",
    body: "The Optimization Agent surfaces what is working and reshapes campaigns in real time.",
    accent: "bg-neo-pink",
  },
  {
    heading: "Transform once, scale everywhere",
    body: "Rephrase, rewrite, and translate instantly — then export to your preferred platform.",
    accent: "bg-neo-cyan",
  },
];

export default function CanvasPage() {
  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-5xl px-4 pt-12 text-center">
        <span className="inline-flex border-[2px] border-black bg-neo-lime px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]">
          Canvas
        </span>
        <h1 className="mt-5 font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          Unlimited space for limitless marketing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl font-medium text-black/70">
          A collaborative canvas where agents, content, and brand context come
          together.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            {stickySections.map((s) => (
              <div
                key={s.heading}
                className="border-[3px] border-black bg-neo-surface p-6 shadow-[6px_6px_0_0_#000]"
              >
                <h2 className="font-display text-2xl font-black uppercase tracking-tight">
                  {s.heading}
                </h2>
                <p className="mt-2 font-medium text-black/70">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <div className="sticky top-28 flex h-[28rem] flex-col gap-4">
              {stickySections.map((s) => (
                <div
                  key={s.heading}
                  className={`flex-1 border-[3px] border-black ${s.accent} shadow-[6px_6px_0_0_#000]`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner
          title="Create, edit, and collaborate in real time"
          subtitle="See Canvas in action with a live demo."
        />
      </section>
    </div>
  );
}
