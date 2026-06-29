import { NeoSkeleton } from "@/components/ui/NeoSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 py-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <NeoSkeleton className="h-10 w-64" accent="yellow" />
          <NeoSkeleton className="h-4 w-96" accent="surface" />
        </div>
        <NeoSkeleton className="h-10 w-32" accent="cyan" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <NeoSkeleton 
            key={i} 
            className="h-32 w-full" 
            accent={["pink", "lime", "yellow", "cyan"][i % 4] as any} 
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NeoSkeleton className="h-96 w-full md:col-span-2" accent="white" />
        <NeoSkeleton className="h-96 w-full" accent="surface" />
      </div>
    </div>
  );
}
