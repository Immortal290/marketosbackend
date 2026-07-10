import * as React from "react";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

export interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function NeoModal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: NeoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex w-full max-w-lg flex-col bg-neo-surface border-neo border-neo-ink shadow-neo-lg z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-neo border-neo-ink bg-neo-yellow px-6 py-4">
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-neo-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border-neo border-neo-ink bg-neo-surface hover:bg-neo-red hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        
        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
