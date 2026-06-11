"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState, GlowButton, DataCard, Pagination, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  AlertTriangle, Building2, CheckCircle2, Download,
  ExternalLink, FileCheck, FileStack, FileText,
  Plus, RefreshCw, ScrollText, TrendingUp, Scale, Banknote,
  Search, ShieldCheck, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

type DocTab = "bank_statement" | "profit_loss" | "balance_sheet" | "cash_flow" | "nib" | "ahu" | "akta" | "other";
const DOC_TABS: { key: DocTab; label: string; icon: React.ReactNode }[] = [
  { key: "bank_statement", label: "Bank Statement", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "profit_loss", label: "Laba Rugi", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "balance_sheet", label: "Neraca", icon: <Scale className="h-3.5 w-3.5" /> },
  { key: "cash_flow", label: "Arus Kas", icon: <Banknote className="h-3.5 w-3.5" /> },
  { key: "nib", label: "NIB", icon: <ScrollText className="h-3.5 w-3.5" /> },
  { key: "ahu", label: "AHU", icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: "akta", label: "Akta", icon: <FileCheck className="h-3.5 w-3.5" /> },
  { key: "other", label: "Lainnya", icon: <FileStack className="h-3.5 w-3.5" /> },
];

const FINANCIAL_TABS = new Set<DocTab>(["profit_loss", "balance_sheet", "cash_flow"]);
const NAMED_TABS = new Set<string>(["bank_statement", "profit_loss", "balance_sheet", "cash_flow", "nib", "ahu", "akta"]);

// Resolve NIB / AHU display fields from parse_meta
function nibField(s: Statement, key: string): string {
  const meta = s.parse_meta as Record<string, unknown> | null;
  const nib = meta?.nib as Record<string, unknown> | undefined;
  return String(nib?.[key] ?? "—");
}
function ahuField(s: Statement, key: string): string {
  const meta = s.parse_meta as Record<string, unknown> | null;
  const ahu = meta?.ahu as Record<string, unknown> | undefined;
  return String(ahu?.[key] ?? "—");
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DocTab>("bank_statement");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reparsing, setReparsing] = useState<Set<string>>(new Set());
  const [reparseProgress, setReparseProgress] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [sortKey, setSortKey] = useState<"date" | "balance" | "confidence" | "status" | "uploaded">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const updateStatement = useCallback((next: Statement) => {
    setStatements((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
  }, []);

  const load = useCallback((showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([{ data: stmts }, { data: comps }]) => { setStatements(stmts); setCompanies(comps); })
      .catch(() => toast.error("Gagal memuat data"))
      .finally(() => { if (showSkeleton) setLoading(false); else setRefreshing(false); });
  }, []);
  useEffect(load, []);

  const companyMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of companies) m[c.company.id] = c.company.name;
    return m;
  }, [companies]);

  const handleAssign = useCallback(async (statementId: string, companyId: string | null) => {
    try {
      const { data } = await statementsApi.assignCompany(statementId, companyId);
      setStatements((prev) => prev.map((s) => s.id === statementId ? { ...s, company_id: data.company_id } : s));
      toast.success(companyId ? `Assigned ke ${companyMap[companyId] ?? companyId}` : "Assignment dihapus");
    } catch { toast.error("Gagal assign perusahaan"); }
  }, [companyMap]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<DocTab, number>> = {};
    for (const { key } of DOC_TABS) {
      counts[key] = statements.filter((s) => {
        if (key === "other") return !NAMED_TABS.has(s.document_type ?? "");
        return s.document_type === key;
      }).length;
    }
    return counts;
  }, [statements]);

  const filtered = useMemo(() => {
    let list = statements.filter((s) => {
      if (activeTab === "other") return !NAMED_TABS.has(s.document_type ?? "");
      return s.document_type === activeTab;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => [
        s.original_filename, s.bank_name, s.bank_code,
        s.account_holder, s.account_no_masked,
      ].some((v) => String(v ?? "").toLowerCase().includes(q)));
    }
    if (dateFrom) list = list.filter((s) => (s.period_start ?? s.created_at ?? "") >= dateFrom);
    if (dateTo) list = list.filter((s) => (s.period_end ?? s.period_start ?? s.created_at ?? "") <= dateTo);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = (a.period_start ?? "").localeCompare(b.period_start ?? "");
      else if (sortKey === "balance") cmp = (Number(a.closing_balance) || 0) - (Number(b.closing_balance) || 0);
      else if (sortKey === "confidence") cmp = (a.statement_confidence ?? 0) - (b.statement_confidence ?? 0);
      else if (sortKey === "status") cmp = (a.status ?? "").localeCompare(b.status ?? "");
      else if (sortKey === "uploaded") cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [statements, search, activeTab, dateFrom, dateTo, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI stats (whole dataset)
  const totalPagesParsed = statements.filter((s) => s.document_type === "bank_statement")
    .reduce((sum, s) => sum + Number(s.page_count ?? 0), 0);
  const totalAnomalies = statements.reduce((sum, s) => sum + (s.anomaly_count ?? 0), 0);
  const avgConfidence = useMemo(() => {
    const vals = statements.map((s) => s.statement_confidence).filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return "—";
    return `${Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)}%`;
  }, [statements]);

  const allPageSelected = paginated.length > 0 && paginated.every((s) => selected.has(s.id));
  const toggleAll = () => {
    if (allPageSelected) setSelected((prev) => { const n = new Set(prev); paginated.forEach((s) => n.delete(s.id)); return n; });
    else setSelected((prev) => { const n = new Set(prev); paginated.forEach((s) => n.add(s.id)); return n; });
  };
  const toggleRow = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkReconcile = async () => {
    if (!selected.size) return;
    setReconciling(true);
    try { await Promise.all([...selected].map((id) => statementsApi.reconcile(id))); toast.success(`${selected.size} direkonsiliasi`); setSelected(new Set()); load(); }
    catch { toast.error("Gagal rekonsiliasi"); }
    finally { setReconciling(false); }
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    setBulkDeleting(true);
    try { await Promise.all([...selected].map((id) => statementsApi.delete(id))); toast.success(`${selected.size} dihapus`); setSelected(new Set()); setConfirmBulkDelete(false); load(); }
    catch { toast.error("Gagal hapus"); }
    finally { setBulkDeleting(false); }
  };

  const pollReparse = useCallback(async (id: string) => {
    for (let i = 1; i <= 80; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      setReparseProgress((p) => ({ ...p, [id]: Math.min(92, 18 + Math.round((i / 80) * 74)) }));
      const { data } = await statementsApi.get(id);
      updateStatement(data);
      if (data.status !== "queued" && data.status !== "parsing") {
        setReparseProgress((p) => ({ ...p, [id]: 100 }));
        setTimeout(() => { setReparsing((p) => { const n = new Set(p); n.delete(id); return n; }); setReparseProgress((p) => { const n = { ...p }; delete n[id]; return n; }); }, 700);
        return;
      }
    }
  }, [updateStatement]);

  const handleReparse = async (id: string) => {
    setReparsing((p) => new Set(p).add(id));
    setReparseProgress((p) => ({ ...p, [id]: 8 }));
    try {
      const { data } = await statementsApi.reparse(id);
      updateStatement(data);
      toast.success("Re-parse dimulai");
      await pollReparse(id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Gagal";
      toast.error(msg);
      setReparsing((p) => { const n = new Set(p); n.delete(id); return n; });
      setReparseProgress((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const switchTab = (tab: DocTab) => { setActiveTab(tab); setPage(1); setSelected(new Set()); };

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Library"
          title="Dokumen"
          description="Semua dokumen upload dan hasil parsing"
          actions={<GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} href="/upload">Upload Baru</GlowButton>}
        />

        {/* KPI strip */}
        {!loading && statements.length > 0 && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={<FileText className="h-4 w-4" />} value={statements.length} label="Total Upload" color="default" subtitle="Semua tipe dokumen" />
            <StatCard icon={<FileStack className="h-4 w-4" />} value={totalPagesParsed} label="Halaman Di-parse" color="amber" subtitle="Bank statement saja" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} value={totalAnomalies} label="Flag Anomali" color="red" subtitle="Transaksi terdeteksi" />
            <StatCard icon={<ShieldCheck className="h-4 w-4" />} value={avgConfidence} label="Rata-rata Confidence" color="emerald" subtitle="Akurasi parsing" />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : statements.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Belum ada dokumen" description="Upload file pertama untuk mulai analisis."
            action={<GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} href="/upload">Upload sekarang</GlowButton>} />
        ) : (
          <DataCard padding="flush">
            {/* Tab bar */}
            <div className="border-b border-slate-200 bg-white px-4 pt-3">
              <div className="flex flex-wrap items-end gap-0.5">
                {DOC_TABS.map(({ key, label, icon }) => {
                  const count = tabCounts[key] ?? 0;
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => switchTab(key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-violet-600 text-violet-700 bg-violet-50/60"
                          : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {icon}
                      {label}
                      {count > 0 && (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                          active ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Cari nama, file..."
                  className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-violet-400 w-48"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-violet-400 w-32" />
                <span className="text-[11px] text-slate-400">–</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-violet-400 w-32" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {(["date", "confidence", "balance", "status"] as const).map((k) => {
                  const labels: Record<string, string> = { date: "Periode", confidence: "Confidence", balance: "Saldo", status: "Status" };
                  const active = sortKey === k;
                  return (
                    <button key={k} onClick={() => { if (active) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } setPage(1); }}
                      className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
                        active ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}>
                      {labels[k]}
                      {active ? (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  confirmBulkDelete ? (
                    <>
                      <span className="text-xs text-red-500">Hapus {selected.size}?</span>
                      <GlowButton variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} loading={bulkDeleting} onClick={bulkDelete}>Ya, Hapus</GlowButton>
                      <GlowButton variant="secondary" size="sm" onClick={() => setConfirmBulkDelete(false)}>Batal</GlowButton>
                    </>
                  ) : (
                    <>
                      <GlowButton variant="secondary" size="sm" icon={<CheckCircle2 className="h-3 w-3" />} loading={reconciling} onClick={bulkReconcile}>Rekonsiliasi {selected.size}</GlowButton>
                      <GlowButton variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} onClick={() => setConfirmBulkDelete(true)}>Hapus {selected.size}</GlowButton>
                    </>
                  )
                )}
                <button onClick={() => load(false)} disabled={refreshing}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                </button>
                <button onClick={() => {
                  const csv = [["File", "Nasabah", "Status", "Periode", ...(activeTab === "nib" ? ["NIB Number"] : activeTab === "ahu" ? ["Nomor SK"] : [])].join(","),
                  ...filtered.map(s => [`"${s.original_filename}"`, `"${s.account_holder ?? ""}"`, s.status, s.period_start ?? "", ...(activeTab === "nib" ? [nibField(s, "nib_number")] : activeTab === "ahu" ? [ahuField(s, "nomor_sk")] : [])].join(","))].join("\n");
                  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `${activeTab}.csv`; a.click();
                }} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tables per tab */}
            <div>
              {activeTab === "bank_statement" && (
                <BankStatementTable rows={paginated} selected={selected} allPageSelected={allPageSelected}
                  toggleAll={toggleAll} toggleRow={toggleRow} reparsing={reparsing}
                  reparseProgress={reparseProgress} handleReparse={handleReparse}
                  companyMap={companyMap} companies={companies} onAssign={handleAssign} />
              )}
              {FINANCIAL_TABS.has(activeTab) && <FinancialDocTable rows={paginated} selected={selected} allPageSelected={allPageSelected} toggleAll={toggleAll} toggleRow={toggleRow} companyMap={companyMap} companies={companies} onAssign={handleAssign} />}
              {activeTab === "nib" && <NibTable rows={paginated} selected={selected} allPageSelected={allPageSelected} toggleAll={toggleAll} toggleRow={toggleRow} companyMap={companyMap} companies={companies} onAssign={handleAssign} />}
              {activeTab === "ahu" && <AhuTable rows={paginated} selected={selected} allPageSelected={allPageSelected} toggleAll={toggleAll} toggleRow={toggleRow} companyMap={companyMap} companies={companies} onAssign={handleAssign} />}
              {(activeTab === "akta" || activeTab === "other") && <SimpleTable rows={paginated} selected={selected} allPageSelected={allPageSelected} toggleAll={toggleAll} toggleRow={toggleRow} companyMap={companyMap} companies={companies} onAssign={handleAssign} />}
            </div>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">Belum ada dokumen di tab ini.</div>
            )}

            {filtered.length > PAGE_SIZE && (
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE}
                  onPageChange={(p) => { setPage(p); setSelected(new Set()); }} />
              </div>
            )}
          </DataCard>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────────────

type TableProps = {
  rows: Statement[];
  selected: Set<string>;
  allPageSelected: boolean;
  toggleAll: () => void;
  toggleRow: (id: string) => void;
  companyMap: Record<string, string>;
  companies: CompanySummary[];
  onAssign: (statementId: string, companyId: string | null) => void;
};

function CompanyCell({ statementId, companyId, companyMap, companies, onAssign }: {
  statementId: string; companyId: string | null;
  companyMap: Record<string, string>; companies: CompanySummary[];
  onAssign: (id: string, cid: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = companyId ? (companyMap[companyId] ?? companyId) : null;
  return (
    <td className="px-4 py-3.5">
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)}
          className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border whitespace-nowrap",
            name ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
              : "border-dashed border-slate-300 text-slate-400 hover:border-violet-300 hover:text-violet-600"
          )}>
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[120px]">{name ?? "Belum diassign"}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-1" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Assign ke perusahaan</p>
            {name && (
              <button onClick={() => { onAssign(statementId, null); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-600 hover:bg-red-50">
                <X className="h-3 w-3" /> Hapus assignment
              </button>
            )}
            <div className="max-h-48 overflow-y-auto">
              {companies.map((c) => (
                <button key={c.company.id} onClick={() => { onAssign(statementId, c.company.id); setOpen(false); }}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors",
                    c.company.id === companyId ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  )}>
                  <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{c.company.name}</span>
                  {c.company.id === companyId && <CheckCircle2 className="h-3 w-3 ml-auto text-violet-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </td>
  );
}

function CheckTh({ allPageSelected, toggleAll }: { allPageSelected: boolean; toggleAll: () => void }) {
  return (
    <th className="pl-4 py-3 w-8">
      <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="rounded border-slate-300 accent-violet-600" />
    </th>
  );
}

function ActionMenu({ id, extra }: { id: string; extra?: React.ReactNode }) {
  return (
    <td className="px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <Link href={`/documents/${id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-violet-700 transition-colors">
          <ExternalLink className="h-3 w-3" /> Detail
        </Link>
        {extra}
      </div>
    </td>
  );
}

function BankStatementTable({ rows, selected, allPageSelected, toggleAll, toggleRow, reparsing, reparseProgress, handleReparse, companyMap, companies, onAssign }: TableProps & {
  reparsing: Set<string>; reparseProgress: Record<string, number>; handleReparse: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <CheckTh allPageSelected={allPageSelected} toggleAll={toggleAll} />
            {["Bank / File", "Nasabah", "Periode", "Saldo Akhir", "Confidence", "Flag", "Perusahaan", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors", selected.has(s.id) && "bg-violet-50/40")}>
              <td className="pl-4 py-3.5"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} className="rounded border-slate-300 accent-violet-500" /></td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900 truncate max-w-[160px]">{s.bank_name || s.bank_code || "—"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">{s.original_filename}</p>
              </td>
              <td className="px-4 py-3.5">
                <p className="text-slate-700 truncate max-w-[140px]">{s.account_holder || "—"}</p>
                <p className="text-[11px] text-slate-400">{s.account_no_masked}</p>
              </td>
              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{formatDate(s.period_start)} – {formatDate(s.period_end)}</td>
              <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{formatIDR(s.closing_balance)}</td>
              <td className="px-4 py-3.5">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  (s.statement_confidence ?? 0) >= 0.95 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : (s.statement_confidence ?? 0) >= 0.85 ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-red-50 text-red-700 ring-red-200")}>
                  {pct(s.statement_confidence)}
                </span>
              </td>
              <td className="px-4 py-3.5">
                {(s.anomaly_count ?? 0) > 0
                  ? <Link href={`/documents/${s.id}`} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100">
                    <AlertTriangle className="h-3 w-3" />{s.anomaly_count}
                  </Link>
                  : <span className="text-slate-300">0</span>}
              </td>
              <CompanyCell statementId={s.id} companyId={s.company_id} companyMap={companyMap} companies={companies} onAssign={onAssign} />
              <td className="px-4 py-3.5">
                <StatusBadge status={s.status} />
                {reparsing.has(s.id) && (
                  <div className="mt-1 w-24">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${reparseProgress[s.id] ?? 8}%` }} />
                    </div>
                  </div>
                )}
              </td>
              <ActionMenu id={s.id}
                extra={s.status !== "queued" && s.status !== "parsing" && (
                  <button onClick={() => handleReparse(s.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 transition-colors whitespace-nowrap">
                    <RefreshCw className="h-3 w-3 shrink-0" /> Re-parse
                  </button>
                )} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FINANCIAL_TYPE_LABEL: Record<string, string> = {
  profit_loss: "Laba Rugi",
  balance_sheet: "Neraca",
  cash_flow: "Arus Kas",
};

function financialField(s: Statement, key: string): string {
  const meta = s.parse_meta as Record<string, unknown> | null;
  return String(meta?.[key] ?? "—");
}

const FINANCIAL_META_KEY: Record<string, string> = {
  profit_loss: "pnl",
  balance_sheet: "balance_sheet",
  cash_flow: "cash_flow",
};

function financialEntityName(s: Statement): string {
  const meta = s.parse_meta as Record<string, unknown> | null;
  const nsKey = FINANCIAL_META_KEY[s.document_type ?? ""];
  if (nsKey) {
    const ns = meta?.[nsKey] as Record<string, unknown> | undefined;
    if (ns?.company_name) return String(ns.company_name);
  }
  return String(meta?.company_name ?? "—");
}

function aktaType(s: Statement): string {
  const meta = s.parse_meta as Record<string, unknown> | null;
  const judul = String(meta?.judul ?? "").toLowerCase();
  if (judul.includes("perubahan") || judul.includes("keputusan rapat")) return "Perubahan";
  if (judul.includes("pendirian")) return "Pendirian";
  return "Akta";
}

function FinancialDocTable({ rows, selected, allPageSelected, toggleAll, toggleRow, companyMap, companies, onAssign }: TableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <CheckTh allPageSelected={allPageSelected} toggleAll={toggleAll} />
            {["Nama / File", "Tipe", "Periode", "Entitas", "Perusahaan", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors", selected.has(s.id) && "bg-violet-50/40")}>
              <td className="pl-4 py-3.5"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} className="rounded border-slate-300 accent-violet-500" /></td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900 truncate max-w-[160px]">{s.account_holder || financialEntityName(s)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">{s.original_filename}</p>
              </td>
              <td className="px-4 py-3.5">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  s.document_type === "profit_loss" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                    s.document_type === "balance_sheet" ? "bg-sky-50 text-sky-700 ring-sky-200" :
                      "bg-amber-50 text-amber-700 ring-amber-200"
                )}>
                  {FINANCIAL_TYPE_LABEL[s.document_type ?? ""] ?? s.document_type}
                </span>
              </td>
              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                {s.period_start ? `${formatDate(s.period_start)}${s.period_end ? ` – ${formatDate(s.period_end)}` : ""}` : (financialField(s, "period") || "—")}
              </td>
              <td className="px-4 py-3.5 text-slate-600 truncate max-w-[140px]">
                {financialEntityName(s)}
              </td>
              <CompanyCell statementId={s.id} companyId={s.company_id} companyMap={companyMap} companies={companies} onAssign={onAssign} />
              <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
              <ActionMenu id={s.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NibTable({ rows, selected, allPageSelected, toggleAll, toggleRow, companyMap, companies, onAssign }: TableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <CheckTh allPageSelected={allPageSelected} toggleAll={toggleAll} />
            {["Nama Pelaku Usaha", "Nomor NIB", "Status Penanaman Modal", "Tanggal Terbit", "Perusahaan", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors", selected.has(s.id) && "bg-violet-50/40")}>
              <td className="pl-4 py-3.5"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} className="rounded border-slate-300 accent-violet-500" /></td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900">{s.account_holder || nibField(s, "nama_pelaku_usaha")}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.original_filename}</p>
              </td>
              <td className="px-4 py-3.5 font-mono font-semibold text-sky-700">{nibField(s, "nib_number")}</td>
              <td className="px-4 py-3.5">
                <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200">
                  {nibField(s, "status_penanaman_modal")}
                </span>
              </td>
              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{nibField(s, "tanggal_terbit")}</td>
              <CompanyCell statementId={s.id} companyId={s.company_id} companyMap={companyMap} companies={companies} onAssign={onAssign} />
              <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
              <ActionMenu id={s.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AhuTable({ rows, selected, allPageSelected, toggleAll, toggleRow, companyMap, companies, onAssign }: TableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <CheckTh allPageSelected={allPageSelected} toggleAll={toggleAll} />
            {["Nama Perusahaan", "Nomor SK", "Domisili", "Tanggal Penetapan", "Perusahaan", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors", selected.has(s.id) && "bg-violet-50/40")}>
              <td className="pl-4 py-3.5"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} className="rounded border-slate-300 accent-violet-500" /></td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900">{s.account_holder || ahuField(s, "nama_perusahaan")}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.original_filename}</p>
              </td>
              <td className="px-4 py-3.5 font-mono text-[11px] text-violet-700">{ahuField(s, "nomor_sk")}</td>
              <td className="px-4 py-3.5 text-slate-600">{ahuField(s, "domisili")}</td>
              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{ahuField(s, "tanggal_penetapan")}</td>
              <CompanyCell statementId={s.id} companyId={s.company_id} companyMap={companyMap} companies={companies} onAssign={onAssign} />
              <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
              <ActionMenu id={s.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ rows, selected, allPageSelected, toggleAll, toggleRow, companyMap, companies, onAssign }: TableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <CheckTh allPageSelected={allPageSelected} toggleAll={toggleAll} />
            {["Nama / File", "Tipe", "Tanggal Upload", "Perusahaan", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors", selected.has(s.id) && "bg-violet-50/40")}>
              <td className="pl-4 py-3.5"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} className="rounded border-slate-300 accent-violet-500" /></td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900">{s.account_holder || "—"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.original_filename}</p>
              </td>
              <td className="px-4 py-3.5">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                  s.document_type === "akta"
                    ? (aktaType(s) === "Pendirian" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200")
                    : "bg-slate-100 text-slate-500"
                )}>
                  {s.document_type === "akta" ? aktaType(s) : s.document_type ?? "other"}
                </span>
              </td>
              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{formatDate(s.period_start)}</td>
              <CompanyCell statementId={s.id} companyId={s.company_id} companyMap={companyMap} companies={companies} onAssign={onAssign} />
              <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
              <ActionMenu id={s.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
