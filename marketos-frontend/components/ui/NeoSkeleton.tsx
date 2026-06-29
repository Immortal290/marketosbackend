import { cn } from "@/lib/cn";

interface NeoSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: "yellow" | "pink" | "cyan" | "lime" | "white" | "surface";
}

const bgColors = {
  yellow: "bg-neo-yellow",
  pink: "bg-neo-pink",
  cyan: "bg-neo-cyan",
  lime: "bg-neo-lime",
  white: "bg-white",
  surface: "bg-neo-surface",
};

export function NeoSkeleton({ className, accent = "white", ...props }: NeoSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-none border-[3px] border-black shadow-[4px_4px_0_0_#000]",
        bgColors[accent],
        className
      )}
      {...props}
    />
  );
}
