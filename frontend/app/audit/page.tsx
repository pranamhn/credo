"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, DataCard, Pagination } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { auditApi, AuditLogEntry } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Activity, CheckCircle2, RefreshCw, Search, Upload, XCircle, FileText, Pencil, Download, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const ACTION_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  upload:            { label: "Upload",          color: "bg-violet-50 text-violet-700 ring-violet-200",  icon: Upload },
  parse_start:       { label: "Parse Mulai",     color: "bg-indigo-50 text-indigo-700 ring-indigo-200",  icon: Activity },
  parse_done:        { label: "Parse Selesai",   color: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  parse_failed:      { label: "Parse Gagal",     color: "bg-red-50 text-red-700 ring-red-200",           icon: XCircle },
  manual_correction: { label: "Koreksi Manual",  color: "bg-amber-50 text-amber-700 ring-amber-200",     icon: Pencil },
  export:            { label: "Export",          color: "bg-sky-50 text-sky-700 ring-sky-200",           icon: Download },
  view:              { label: "Lihat",           color: "bg-slate-100 text-slate-600 ring-slate-200",    icon: Eye },
  delete:            { label: "Hapus",           color: "bg-red-50 text-red-700 ring-red-200",           icon: Trash2 },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, color: "bg-slate-100 text-slate-600 ring-slate-200", icon: Activity };
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", meta.color)}>
      <Icon className="h-3 w-3 shrink-0" />
      {meta.label}
    </span>
  );
}

const DOC_TYPE_LABEL: Record<string, string> = {
  bank_statement: "Bank Statement", profit_loss: "P&L", balance_sheet: "Neraca",
  cash_flow: "Arus Kas", nib: "NIB", ahu: "AHU", akta: "Akta", other: "Lainnya",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true); else setRefreshing(true);
    try {
      const { data } = await auditApi.list({ limit: 500 });
      setLogs(data);
    } catch {
      toast.error("Gagal memuat audit trail");
    } finally {
      if (showSkeleton) setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = logs;
    if (actionFilter !== "all") list = list.filter((l) => l.action === actionFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) =>
      (l.original_filename ?? "").toLowerCase().includes(q) ||
      (l.action ?? "").toLowerCase().includes(q) ||
      JSON.stringify(l.detail ?? {}).toLowerCase().includes(q)
    );
    return list;
  }, [logs, actionFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    for (const l of logs) counts[l.action] = (counts[l.action] ?? 0) + 1;
    return counts;
  }, [logs]);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Admin"
          title="Audit Trail"
          description="Riwayat semua aktivitas: upload, parsing, koreksi, dan export"
        />

        {/* Action filter chips */}
        <div className="flex flex-wrap gap-2">
          {(["all", ...ALL_ACTIONS] as const).map((a) => {
            const count = actionCounts[a] ?? 0;
            const active = actionFilter === a;
            const meta = a === "all" ? null : ACTION_META[a];
            return (
              <button key={a} onClick={() => { setActionFilter(a); setPage(1); }}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  active ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}>
                {meta && <meta.icon className="h-3 w-3" />}
                {a === "all" ? "Semua" : meta?.label ?? a}
                {count > 0 && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] leading-none", active ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500")}>{count}</span>}
              </button>
            );
          })}
        </div>

        <DataCard padding="flush">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Cari file, action, detail..."
                className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-violet-400 w-56" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{filtered.length} entri</span>
              <button onClick={() => load(false)} disabled={refreshing}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Belum ada aktivitas tercatat</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["Waktu", "Action", "File", "Tipe Dok", "Detail"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">
                        {new Date(log.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.original_filename ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate text-slate-700 font-medium" title={log.original_filename}>{log.original_filename}</span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {log.document_type ? (DOC_TYPE_LABEL[log.document_type] ?? log.document_type) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        {log.detail ? (
                          <span className="truncate block text-slate-400 font-mono text-[10px]" title={JSON.stringify(log.detail)}>
                            {Object.entries(log.detail)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE}
                onPageChange={(p) => setPage(p)} />
            </div>
          )}
        </DataCard>
      </div>
    </AppShell>
  );
}
