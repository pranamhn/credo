import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PageProgress } from "@/components/layout/PageProgress";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CREDO Risk Analyst Intelligent",
  description: "Automated bank statement parsing & credit risk analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <Suspense><PageProgress /></Suspense>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
