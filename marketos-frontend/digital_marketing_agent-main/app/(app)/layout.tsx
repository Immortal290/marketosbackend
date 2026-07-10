import type { Metadata } from "next";
import "@/app/globals.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NeoToaster } from "@/components/ui/NeoToaster";
import { NeoCommandPalette } from "@/components/ui/NeoCommandPalette";
import { AIGuidancePopup } from "@/components/ui/AIGuidancePopup";

export const metadata: Metadata = {
  title: "Dashboard | MarketOS",
  description: "Mission Control for Intelligent Marketing",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-neo-bg font-display">
        <AppSidebar />
        <main className="theme-pastel bg-neo-bg flex-1 w-full flex-col min-w-0 overflow-x-hidden">
          {children}
        </main>
        <NeoToaster position="bottom-right" />
        <NeoCommandPalette />
        <AIGuidancePopup />
      </body>
    </html>
  );
}
