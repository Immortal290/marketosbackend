import * as React from "react";

export interface HScrollProps {
  children: React.ReactNode;
}

export function HScroll({ children }: HScrollProps) {
  return <div className="flex gap-4 overflow-x-auto pb-4">{children}</div>;
}
