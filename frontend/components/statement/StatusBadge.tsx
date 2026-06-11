import { CheckCircle, MoreHorizontal, XCircle, Loader2, Clock } from "lucide-react";
import { StatementStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const cfg: Record<StatementStatus, {
  label: string;
  cls: string;
  icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
}> = {
  done:         { label: "Paid",    icon: CheckCircle,    cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
  needs_review: { label: "Pending", icon: MoreHorizontal, cls: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" },
  failed:       { label: "Unpaid",  icon: XCircle,        cls: "bg-red-50 text-red-500 ring-1 ring-red-200" },
  parsing:      { label: "Parsing", icon: Loader2,        cls: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200", spin: true },
  queued:       { label: "Queued",  icon: Clock,          cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
};

export function StatusBadge({ status }: { status: StatementStatus }) {
  const { label, cls, icon: Icon, spin } = cfg[status] ?? cfg.queued;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon className={cn("h-3 w-3 shrink-0", spin && "animate-spin")} />
      {label}
    </span>
  );
}
