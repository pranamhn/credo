import { StatementStatus } from "@/lib/api";

const cfg: Record<StatementStatus, { label: string; cls: string }> = {
  queued:       { label: "Queued",       cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-300" },
  parsing:      { label: "Parsing…",    cls: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300" },
  done:         { label: "Done",         cls: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" },
  needs_review: { label: "Review",       cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-300" },
  failed:       { label: "Failed",       cls: "bg-red-100 text-red-700 ring-1 ring-red-300" },
};

export function StatusBadge({ status }: { status: StatementStatus }) {
  const { label, cls } = cfg[status] ?? cfg.queued;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
