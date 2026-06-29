"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const NeoToaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-[3px] group-[.toaster]:border-black group-[.toaster]:shadow-[4px_4px_0_0_#000] group-[.toaster]:rounded-none group-[.toaster]:font-display group-[.toaster]:text-base",
          title: "group-[.toast]:font-black",
          description: "group-[.toast]:text-black/80 group-[.toast]:font-mono group-[.toast]:text-xs group-[.toast]:font-bold",
          actionButton:
            "group-[.toast]:bg-neo-cyan group-[.toast]:text-black group-[.toast]:border-[2px] group-[.toast]:border-black group-[.toast]:font-bold group-[.toast]:rounded-none group-[.toast]:shadow-[2px_2px_0_0_#000]",
          cancelButton:
            "group-[.toast]:bg-neo-surface group-[.toast]:text-black group-[.toast]:border-[2px] group-[.toast]:border-black group-[.toast]:font-bold group-[.toast]:rounded-none",
          success: "group-[.toaster]:bg-neo-lime",
          error: "group-[.toaster]:bg-neo-pink group-[.toaster]:text-black",
          warning: "group-[.toaster]:bg-neo-yellow",
          info: "group-[.toaster]:bg-neo-cyan",
        },
      }}
      {...props}
    />
  );
};

export { NeoToaster };
