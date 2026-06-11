import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PageProgress } from "@/components/layout/PageProgress";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CREDO Risk Analyst Intelligent",
  description: "Automated bank statement parsing & credit risk analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground" style={{ backgroundColor: "#EEF2F7" }}>
        <Suspense><PageProgress /></Suspense>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
