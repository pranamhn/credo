"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState, GlowButton, DataCard, Pagination } from "@/components/ui-kit";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, Statement } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  AlertTriangle, CalendarRange, CheckCircle2, ExternalLink,
  Download, FileStack, FileText, Funnel, MoreHorizontal, Plus, RefreshCw,
  Search, ShieldCheck, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

type SummaryTone = "slate" | "amber" | "emerald" | "rose";
const summaryTone: Record<SummaryTone, { box: string; icon: string; value: string }> = {
  slate: { box: "bg-slate-100 text-slate-600", icon: "text-slate-700", value: "text-slate-900" },
  amber: { box: "bg-amber-100 text-amber-700", icon: "text-amber-700", value: "text-amber-800" },
  emerald: { box: "bg-emerald-100 text-emerald-700", icon: "text-emerald-700", value: "text-emerald-800" },
  rose: { box: "bg-red-100 text-red-600", icon: "text-red-700", value: "text-red-700" },
};

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: SummaryTone;
}) {
  const p = summaryTone[tone];
  return (
    <div className="group relative flex min-h-[128px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-teal-300 hover:shadow-md">
      <div className="absolute left-6 right-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-current/20 transition-colors group-hover:bg-teal-100 ${p.box}`}>
            <span className={p.icon}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-teal-700">{label}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">total keseluruhan</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200">Live</span>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3">
        <p className={`truncate text-xl font-bold leading-none ${p.value}`} title={String(value)}>{value}</p>
      </div>
    </div>
  );
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

type StatusFilter = "Semua" | "done" | "needs_review" | "failed" | "queued" | "parsing";
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "Semua", label: "Semua" },
  { key: "done", label: "Done" },
  { key: "needs_review", label: "Needs Review" },
  { key: "failed", label: "Failed" },
  { key: "queued", label: "Queued" },
  { key: "parsing", label: "Parsing" },
];

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [bankFilter, setBankFilter] = useState("Semua");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reparsing, setReparsing] = useState<Set<string>>(new Set());
  const [reparseProgress, setReparseProgress] = useState<Record<string, number>>({});
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [openToolbarPanel, setOpenToolbarPanel] = useState<"filter" | "date" | null>(null);
  const [page, setPage] = useState(1);

  const updateStatement = useCallback((next: Statement) => {
    setStatements((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
  }, []);

  const load = useCallback((showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);
    statementsApi.list()
      .then(({ data }) => setStatements(data))
      .catch(() => toast.error("Gagal memuat daftar statement"))
      .finally(() => {
        if (showSkeleton) setLoading(false);
        else setRefreshing(false);
      });
  }, []);
  useEffect(load, []);

  const uniqueBanks = useMemo(() => {
    const banks = [...new Set(statements.map((s) => s.bank_name || s.bank_code).filter(Boolean))] as string[];
    return ["Semua", ...banks];
  }, [statements]);

  const filtered = useMemo(() => {
    let list = statements;
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((s) => [
        s.original_filename,
        s.bank_name,
        s.bank_code,
        s.account_holder,
        s.account_no_masked,
        s.status,
      ].some((value) => String(value ?? "").toLowerCase().includes(query)));
    }
    if (statusFilter !== "Semua") list = list.filter((s) => s.status === statusFilter);
    if (bankFilter !== "Semua") list = list.filter((s) => (s.bank_name || s.bank_code) === bankFilter);
    if (dateFrom) list = list.filter((s) => (s.period_end ?? "") >= dateFrom);
    if (dateTo) list = list.filter((s) => (s.period_start ?? "") <= dateTo);
    return list;
  }, [statements, search, statusFilter, bankFilter, dateFrom, dateTo]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: statements.length };
    for (const { key } of STATUS_TABS) {
      if (key !== "Semua") counts[key] = statements.filter((s) => s.status === key).length;
    }
    return counts;
  }, [statements]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPagesParsed = statements.reduce((sum, s) => {
    if (s.status !== "done" && s.status !== "needs_review") return sum;
    return sum + Number(s.page_count ?? 0);
  }, 0);
  const totalAnomalies = statements.reduce((sum, s) => sum + (s.anomaly_count ?? 0), 0);
  const averageConfidence = useMemo(() => {
    const values = statements
      .map((s) => s.statement_confidence)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return "—";
    return `${Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100)}%`;
  }, [statements]);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setBankFilter("Semua");
    setPage(1);
  };
  const hasFilters = search || dateFrom || dateTo || bankFilter !== "Semua";

  const allPageSelected = paginated.length > 0 && paginated.every((s) => selected.has(s.id));
  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => { const next = new Set(prev); paginated.forEach((s) => next.delete(s.id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); paginated.forEach((s) => next.add(s.id)); return next; });
    }
  };
  const toggleRow = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const bulkReconcile = async () => {
    if (selected.size === 0) return;
    setReconciling(true);
    try {
      await Promise.all([...selected].map((id) => statementsApi.reconcile(id)));
      toast.success(`${selected.size} statement direkonsiliasi`);
      setSelected(new Set());
      load();
    } catch { toast.error("Gagal merekonsiliasi beberapa statement"); }
    finally { setReconciling(false); }
  };

  // S5 — Batch delete
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selected].map((id) => statementsApi.delete(id)));
      toast.success(`${selected.size} statement dihapus`);
      setSelected(new Set());
      setConfirmBulkDelete(false);
      load();
    } catch { toast.error("Gagal menghapus beberapa statement"); }
    finally { setBulkDeleting(false); }
  };

  const exportStatements = () => {
    const headers = ["Bank", "File", "Nasabah", "Periode Awal", "Periode Akhir", "Saldo Akhir", "Confidence", "Flag Anomali", "Status"];
    const rows = filtered.map((s) => [
      s.bank_name || s.bank_code || "",
      `"${(s.original_filename ?? "").replace(/"/g, '""')}"`,
      `"${(s.account_holder ?? "").replace(/"/g, '""')}"`,
      s.period_start ?? "",
      s.period_end ?? "",
      s.closing_balance ?? "",
      s.statement_confidence != null ? Math.round(s.statement_confidence * 100) + "%" : "",
      s.anomaly_count ?? 0,
      s.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statements.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pollReparse = useCallback(async (id: string) => {
    const maxAttempts = 80;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const progress = Math.min(92, 18 + Math.round((attempt / maxAttempts) * 74));
      setReparseProgress((prev) => ({ ...prev, [id]: progress }));

      const { data } = await statementsApi.get(id);
      updateStatement(data);

      if (data.status !== "queued" && data.status !== "parsing") {
        setReparseProgress((prev) => ({ ...prev, [id]: 100 }));
        setTimeout(() => {
          setReparsing((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setReparseProgress((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 700);
        return data;
      }
    }
    throw new Error("Timeout menunggu parsing selesai");
  }, [updateStatement]);

  const handleReparse = async (id: string) => {
    setReparsing((prev) => new Set(prev).add(id));
    setReparseProgress((prev) => ({ ...prev, [id]: 8 }));
    try {
      const { data } = await statementsApi.reparse(id);
      updateStatement(data);
      setReparseProgress((prev) => ({ ...prev, [id]: data.status === "queued" ? 12 : 24 }));
      toast.success("Re-parsing dimulai");
      await pollReparse(id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Gagal";
      toast.error(msg);
      setReparsing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setReparseProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Library"
          title="Semua Statement"
          description="Parsing, rekonsiliasi, dan status review"
          actions={
            <GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} href="/upload">
              Upload Baru
            </GlowButton>
          }
        />

        {/* Stats */}
        {!loading && statements.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<FileText className="h-[22px] w-[22px]" />} value={statements.length} label="Total Upload" tone="slate" />
            <SummaryCard icon={<FileStack className="h-[22px] w-[22px]" />} value={totalPagesParsed} label="Total Page Pharsed" tone="amber" />
            <SummaryCard icon={<AlertTriangle className="h-[22px] w-[22px]" />} value={totalAnomalies} label="Total Flag Anomali" tone="rose" />
            <SummaryCard icon={<ShieldCheck className="h-[22px] w-[22px]" />} value={averageConfidence} label="Average Confident" tone="emerald" />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : statements.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Belum ada statement"
            description="Upload file pertama untuk mulai analisis."
            action={<GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} href="/upload">Upload sekarang</GlowButton>}
          />
        ) : (
          <div>
            <DataCard padding="flush" className="overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-3 sm:px-5">
                <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">Statement List</h2>
                    {(hasFilters || statusFilter !== "Semua") && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                        {filtered.length} dari {statements.length}
                      </span>
                    )}
                  </div>
                  <div className="relative z-30 flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="relative group w-full">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-indigo-500" />
                      </div>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search here..."
                        className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-64"
                      />
                    </div>
                    <div className="relative flex justify-end">
                      <div className="flex items-center gap-1 rounded-xl bg-gray-50 p-1">
                        <button
                          type="button"
                          onClick={() => setOpenToolbarPanel((prev) => (prev === "filter" ? null : "filter"))}
                          className={`rounded-lg p-2.5 transition-all duration-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm ${openToolbarPanel === "filter" || hasFilters || statusFilter !== "Semua"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-600"
                            }`}
                          title="Filter"
                        >
                          <Funnel className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenToolbarPanel((prev) => (prev === "date" ? null : "date"))}
                          className={`rounded-lg p-2.5 transition-all duration-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm ${openToolbarPanel === "date" || dateFrom || dateTo
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-600"
                            }`}
                          title="Date Range"
                        >
                          <CalendarRange className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenToolbarPanel(null); load(false); }}
                          disabled={refreshing}
                          className="rounded-lg p-2.5 text-gray-600 transition-all duration-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                          title="Refresh"
                        >
                          <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={exportStatements}
                          className="rounded-lg p-2.5 text-gray-600 transition-all duration-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                          title="Export Statements"
                        >
                          <Download className="h-[18px] w-[18px]" />
                        </button>
                      </div>

                      {openToolbarPanel === "filter" && (
                        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="flex flex-col gap-2">
                            <select
                              value={statusFilter}
                              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); setSelected(new Set()); }}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none focus:border-blue-400"
                            >
                              {STATUS_TABS.map(({ key, label }) => (
                                <option key={key} value={key}>{label} ({tabCounts[key] ?? 0})</option>
                              ))}
                            </select>
                            <select
                              value={bankFilter}
                              onChange={(e) => { setBankFilter(e.target.value); setPage(1); }}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none focus:border-blue-400"
                            >
                              {uniqueBanks.map((b) => <option key={b}>{b}</option>)}
                            </select>

                            {hasFilters && (
                              <button
                                onClick={clearFilters}
                                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500 shadow-sm hover:bg-slate-50"
                              >
                                <X className="h-3 w-3" /> Reset
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {openToolbarPanel === "date" && (
                        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                              <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                className="w-28 bg-transparent text-xs text-slate-700 outline-none"
                              />
                              <span className="text-xs text-slate-300">—</span>
                              <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                className="w-28 bg-transparent text-xs text-slate-700 outline-none"
                              />
                            </div>
                            {(dateFrom || dateTo) && (
                              <button
                                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                                className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500 shadow-sm hover:bg-slate-50"
                              >
                                <X className="h-3 w-3" /> Reset Date
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selected.size > 0 && (
                  <div className="mt-3 flex justify-end gap-2">
                    {confirmBulkDelete ? (
                      <>
                        <span className="text-xs text-red-500 self-center">Hapus {selected.size} statement?</span>
                        <GlowButton variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />}
                          loading={bulkDeleting} onClick={bulkDelete} size="sm">
                          Ya, Hapus
                        </GlowButton>
                        <GlowButton variant="secondary" onClick={() => setConfirmBulkDelete(false)} size="sm">
                          Batal
                        </GlowButton>
                      </>
                    ) : (
                      <>
                        <GlowButton variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          loading={reconciling} onClick={bulkReconcile} size="sm">
                          Rekonsiliasi {selected.size} terpilih
                        </GlowButton>
                        <GlowButton variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => setConfirmBulkDelete(true)} size="sm">
                          Hapus {selected.size} terpilih
                        </GlowButton>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="pl-4 py-3 w-8">
                        <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                          className="rounded border-slate-300 accent-teal-600" />
                      </th>
                      {["Bank / File", "Nasabah", "Periode", "Saldo Akhir", "Confidence", "Flag Anomali", "Status", "Analis"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
                      ))}
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                          Tidak ada statement yang sesuai filter.
                        </td>
                      </tr>
                    ) : paginated.map((s) => (
                      <tr key={s.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 group transition-colors ${selected.has(s.id) ? "bg-blue-50/40" : ""}`}>
                        <td className="pl-4 py-3.5">
                          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)}
                            className="rounded border-slate-300 accent-teal-500" />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-xs text-slate-900 leading-tight truncate max-w-[160px]">{s.bank_name || s.bank_code || "—"}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">{s.original_filename}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-slate-700 text-xs truncate max-w-[140px]">{s.account_holder || "—"}</p>
                          <p className="text-[11px] text-slate-400">{s.account_no_masked}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(s.period_start)} – {formatDate(s.period_end)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap text-xs">
                          {formatIDR(s.closing_balance)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${(s.statement_confidence ?? 0) >= 0.95
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : (s.statement_confidence ?? 0) >= 0.85
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : "bg-red-50 text-red-700 ring-red-200"
                            }`}>
                            {pct(s.statement_confidence)}
                          </span>
                          {(s.low_confidence_count ?? 0) > 0 && (
                            <p className="mt-1 text-[10px] text-amber-600">{s.low_confidence_count} row perlu review</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {(s.anomaly_count ?? 0) > 0 ? (
                            <Link
                              href={`/statements/${s.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200 transition-all hover:bg-orange-100 hover:text-orange-800 hover:ring-orange-300"
                              title="Buka detail flag anomali"
                            >
                              <AlertTriangle className="h-3 w-3" /> {s.anomaly_count}
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={s.status} />
                              {reparsing.has(s.id) && (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                              )}
                            </div>
                            {reparsing.has(s.id) && (
                              <div className="w-28">
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                    style={{ width: `${reparseProgress[s.id] ?? 8}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-[10px] font-medium text-indigo-600">
                                  Parsing {reparseProgress[s.id] ?? 8}%
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-slate-500">Rachmad M.</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() => setOpenActionId(openActionId === s.id ? null : s.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              title="Action"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openActionId === s.id && (
                              <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                <Link
                                  href={`/statements/${s.id}`}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  onClick={() => setOpenActionId(null)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Detail
                                </Link>
                                {s.document_type === "bank_statement" && s.status !== "queued" && s.status !== "parsing" && (
                                  <button
                                    type="button"
                                    onClick={() => { setOpenActionId(null); handleReparse(s.id); }}
                                    disabled={reparsing.has(s.id)}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 ${reparsing.has(s.id) ? "animate-spin" : ""}`} />
                                    Re-parse
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <Pagination page={page} totalPages={totalPages} totalItems={filtered.length}
                    pageSize={PAGE_SIZE} onPageChange={(p) => { setPage(p); setSelected(new Set()); }} />
                </div>
              )}
            </DataCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}
