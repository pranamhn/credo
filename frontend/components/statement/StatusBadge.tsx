import { StatementStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const cfg: Record<StatementStatus, {
  label: string;
  cls: string;
}> = {
  done: { label: "Selesai", cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
  needs_review: { label: "Perlu Review", cls: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" },
  failed: { label: "Gagal", cls: "bg-red-50 text-red-500 ring-1 ring-red-200" },
  parsing: { label: "Parsing", cls: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200" },
  queued: { label: "Queued", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
};

export function StatusBadge({ status }: { status: StatementStatus }) {
  const { label, cls } = cfg[status] ?? cfg.queued;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}
