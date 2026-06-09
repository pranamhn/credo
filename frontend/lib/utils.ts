import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateStr));
}

export function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

export function severityColor(s: "high" | "medium" | "low"): string {
  return s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";
}
