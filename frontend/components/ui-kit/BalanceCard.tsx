import { MoreVertical, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  label?: string;
  amount: string;
  subtitle?: string;
  walletLabel?: string;
  onWalletClick?: () => void;
  className?: string;
}

export function BalanceCard({
  label = "Balance",
  amount,
  subtitle,
  walletLabel = "Main Wallet",
  onWalletClick,
  className,
}: BalanceCardProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl p-6 text-white", className)}
      style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)" }}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-2 bottom-4 h-24 w-24 rounded-full bg-white/5" />

      {/* Three-dot menu */}
      <button className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Content */}
      <p className="text-sm font-medium text-white/70 mb-2">{label}</p>
      <p className="text-3xl font-bold tracking-tight mb-1">{amount}</p>
      {subtitle && (
        <p className="text-xs text-white/50 mb-4">{subtitle}</p>
      )}

      <button
        onClick={onWalletClick}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-300 transition-colors mt-2"
      >
        <Wallet className="h-3.5 w-3.5" />
        {walletLabel}
      </button>
    </div>
  );
}
