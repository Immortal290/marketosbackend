import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "API Docs | MarketOS",
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-display">
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
