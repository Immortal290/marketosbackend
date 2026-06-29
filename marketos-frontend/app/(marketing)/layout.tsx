import type { Metadata } from "next";
import "@/app/globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { AnnouncementBar } from "@/components/marketing/AnnouncementBar";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "MarketOS — The Execution Platform for Intelligent Marketing",
  description:
    "Put AI agents to work for marketing. One click, a marketing team that never sleeps.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-display">
        <AnnouncementBar />
        <TopNav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
