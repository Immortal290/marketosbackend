import type { Metadata } from "next";
import "@/app/globals.css";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Authentication | MarketOS",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-neo-yellow font-display">
        <AuthProvider>
          <div className="absolute left-6 top-6">
            <Link href="/" className="flex items-center gap-2 font-bold hover:underline">
              <ArrowLeft size={16} /> Back to Website
            </Link>
          </div>
          <main className="flex w-full flex-col items-center justify-center p-4">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
