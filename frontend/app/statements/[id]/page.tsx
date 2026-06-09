"use client";
import { Fragment, useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/statement/MetricCard";
import { FlagCard } from "@/components/risk/FlagCard";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, Statement, Transaction, RiskResult, FlagDetail } from "@/lib/api";
import { formatIDR, formatDate, formatPct } from "@/lib/utils";
import {
  ArrowDownCircle, ArrowUpCircle, Scale, TrendingUp,
  Download, RefreshCw, CheckCircle2, AlertTriangle, Filter, FileDown, Pencil, X, Save, Check, MoreHorizontal, ArrowLeft,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import { toast } from "sonner";

const CHART_TOOLTIP = {
  contentStyle: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
  cursor: { fill: "rgba(20,184,166,0.04)" },
};
const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };
const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#f1f5f9" };
const CATEGORY_OPTIONS = [
  "income_salary",
  "income_transfer",
  "income_other",
  "transfer_out",
  "cash_withdrawal",
  "admin_fee",
  "bank_fee",
  "loan_repayment",
  "loan_disbursement",
  "vendor_payment",
  "payroll",
  "operational_expense",
  "rent",
  "transport",
  "retail_purchase",
  "ewallet_topup",
  "investment",
  "tax",
  "insurance",
  "utility",
  "unknown",
];
const FLAG_REASONS: Record<string, string> = {
  judol: "Deskripsi mengandung keyword indikasi judi online.",
  pinjol: "Deskripsi mengandung keyword pinjaman online/cicilan.",
  passthrough: "Dana masuk lalu keluar lagi dalam waktu pendek.",
  rejected: "Transaksi terindikasi gagal/ditolak/insufficient fund.",
  negative_balance: "Saldo transaksi berada di bawah nol.",
  large_inflow: "Kredit jauh lebih besar dari pola pendapatan normal.",
  recurring: "Pola transaksi berulang terdeteksi.",
  low_confidence: "Parser/rule memberi confidence rendah untuk row ini.",
};

function usePollStatement(id: string) {
  const [stmt, setStmt] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const { data } = await statementsApi.get(id);
      setStmt(data);
    } catch {
      toast.error("Gagal memuat statement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
    const interval = setInterval(() => {
      if (stmt?.status === "queued" || stmt?.status === "parsing") fetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetch, stmt?.status]);

  return { stmt, loading, refetch: fetch };
}

function buildContextRows(rows: number[], radius: number): Set<number> {
  const result = new Set<number>();
  for (const row of rows) {
    for (let offset = -radius; offset <= radius; offset++) {
      if (row + offset > 0) result.add(row + offset);
    }
  }
  return result;
}

function exportCSV(txns: Transaction[], filename: string) {
  const headers = ["#", "Tanggal", "Keterangan", "Debit", "Kredit", "Saldo", "Kategori", "Flag"];
  const rows = txns.map((t) => [
    t.row, t.date, `"${(t.description_raw ?? "").replace(/"/g, '""')}"`,
    t.debit ?? "", t.credit ?? "", t.balance ?? "",
    t.category ?? "", (t.flags ?? []).join("|"),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function confidencePct(txn: Transaction): number {
  return Math.round(Math.max(0, Math.min(1, txn.confidence ?? 0)) * 100);
}

function confidenceTier(txn: Transaction): string {
  const tier = txn.raw_meta?.confidence_tier;
  if (typeof tier === "string") return tier;
  const pct = confidencePct(txn);
  if (pct === 100) return "verified";
  if (pct >= 95) return "high";
  if (pct >= 85) return "medium";
  return "review";
}

function confidenceReason(txn: Transaction): string {
  const reason = txn.raw_meta?.confidence_reason;
  if (typeof reason === "string") return reason;
  const tier = confidenceTier(txn);
  if (tier === "verified") return "100% karena deterministic parser dan rekonsiliasi saldo OK.";
  if (tier === "high") return "Confidence tinggi, tapi row tidak punya bukti saldo eksplisit.";
  if (tier === "medium") return "Row terbaca, namun statement belum sepenuhnya balanced.";
  return "Perlu human review karena confidence parser rendah.";
}

function needsHumanReview(txn: Transaction): boolean {
  return txn.is_low_confidence || (txn.confidence ?? 0) < 1;
}

function amountDraft(value: number | null): string {
  return value == null ? "" : String(value);
}

function numberOrNull(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function anomalyReason(txn: Transaction, avgDebit: number, avgCredit: number): string {
  if (txn.debit != null && Number(txn.debit) > avgDebit * 3) {
    return `Nominal debit > 3x rata-rata debit (${formatIDR(avgDebit)}).`;
  }
  if (txn.credit != null && Number(txn.credit) > avgCredit * 3) {
    return `Nominal kredit > 3x rata-rata kredit (${formatIDR(avgCredit)}).`;
  }
  return "Nominal transaksi menyimpang dari pola rata-rata.";
}

export default function StatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { stmt, loading, refetch } = usePollStatement(id);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [txnLoading, setTxnLoading] = useState(false);
  const [focusedFlag, setFocusedFlag] = useState<FlagDetail | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [flagOnly, setFlagOnly] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Record<string, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { description_raw: string; debit: string; credit: string; balance: string; category: string }>>({});
  const [reconciling, setReconciling] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const handleReparse = async () => {
    if (!stmt) return;
    setReparsing(true);
    try { await statementsApi.reparse(stmt.id); await refetch(); toast.success("Re-parse dimulai"); }
    catch { toast.error("Gagal re-parse"); }
    finally { setReparsing(false); }
  };
  const handleReconcile = async () => {
    if (!stmt) return;
    setReconciling(true);
    try { await statementsApi.reconcile(stmt.id); await refetch(); toast.success("Rekonsiliasi berhasil"); }
    catch { toast.error("Gagal rekonsiliasi"); }
    finally { setReconciling(false); }
  };
  const handleExportExcel = () => {
    if (!stmt || txns.length === 0) { toast.error("Tidak ada data"); return; }
    const headers = ["Tanggal", "Deskripsi", "Kredit", "Debit", "Saldo", "Kategori", "Flag"];
    const rows = txns.map((t) => [t.date || "", `"${(t.description_raw || "").replace(/"/g, '""')}"`, t.credit || 0, t.debit || 0, t.balance || "", t.category || "", t.flags?.join("; ") || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions-${stmt.id.slice(0, 8)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${txns.length} transaksi diexport`);
  };
  useEffect(() => {
    if (stmt) {
      let cancelled = false;
      setTxnLoading(true);
      statementsApi.allTransactions(id)
        .then((data) => { if (!cancelled) setTxns(data); })
        .finally(() => { if (!cancelled) setTxnLoading(false); });
      statementsApi.risk(id).then(({ data }) => setRisk(data)).catch(() => { });
      return () => { cancelled = true; };
    }
  }, [id, stmt?.status]);

  if (loading) return (
    <AppShell>
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </AppShell>
  );

  if (!stmt) return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-card p-10 text-center">
        <p className="text-slate-500">Statement tidak ditemukan.</p>
      </div>
    </AppShell>
  );

  const isParsing = stmt.status === "queued" || stmt.status === "parsing";

  const chartData = txns
    .filter((t) => t.balance != null)
    .map((t) => ({ date: t.date, saldo: Number(t.balance) }))
    .slice(-60);

  const inOutData = txns.reduce<Record<string, { in: number; out: number }>>((acc, t) => {
    const month = t.date.slice(0, 7);
    if (!acc[month]) acc[month] = { in: 0, out: 0 };
    acc[month].in += Number(t.credit || 0);
    acc[month].out += Number(t.debit || 0);
    return acc;
  }, {});
  const barData = Object.entries(inOutData).map(([month, v]) => ({ month, ...v }));

  const flags = risk?.flags ? Object.values(risk.flags) : [];
  const focusedRows = focusedFlag ? buildContextRows(focusedFlag.supporting_rows, 3) : new Set<number>();
  const focusedTxns = focusedFlag ? txns.filter((txn) => focusedRows.has(txn.row)) : [];

  // Anomaly detection: transactions with debit or credit > 3× average
  const avgDebit = txns.filter((t) => t.debit).reduce((a, t) => a + Number(t.debit), 0) / (txns.filter((t) => t.debit).length || 1);
  const avgCredit = txns.filter((t) => t.credit).reduce((a, t) => a + Number(t.credit), 0) / (txns.filter((t) => t.credit).length || 1);
  const isAnomaly = (t: Transaction) =>
    (t.debit != null && Number(t.debit) > avgDebit * 3) ||
    (t.credit != null && Number(t.credit) > avgCredit * 3);

  // Category filter options
  const categories = ["Semua", ...Array.from(new Set([...CATEGORY_OPTIONS, ...(txns.map((t) => t.category).filter(Boolean) as string[])]))];

  // Filtered transaction list (with local category overrides for SD4)
  const txnsWithLocal = txns.map((t) => ({ ...t, category: localCategories[t.id] ?? t.category }));
  const reviewTxns = txnsWithLocal.filter(needsHumanReview);
  const reviewedTxns = txnsWithLocal.filter((t) => t.is_manually_corrected && !needsHumanReview(t));
  const filteredTxns = txnsWithLocal.filter((t) => {
    if (categoryFilter !== "Semua" && t.category !== categoryFilter) return false;
    if (flagOnly && !(t.flags?.length)) return false;
    if (reviewOnly && !needsHumanReview(t)) return false;
    return true;
  });

  // SD3 — Category breakdown
  const categoryBreakdown = (() => {
    const map: Record<string, { debit: number; credit: number; count: number }> = {};
    for (const t of txnsWithLocal) {
      const cat = t.category ?? "Lainnya";
      if (!map[cat]) map[cat] = { debit: 0, credit: 0, count: 0 };
      map[cat].debit += Number(t.debit || 0);
      map[cat].credit += Number(t.credit || 0);
      map[cat].count += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name: name.replace(/_/g, " "), debit: v.debit / 1e6, credit: v.credit / 1e6, count: v.count }))
      .sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit));
  })();

  const CAT_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#f97316", "#06b6d4"];
  const categoriesUpdated = ["Semua", ...Array.from(new Set([...CATEGORY_OPTIONS, ...(txnsWithLocal.map((t) => t.category).filter(Boolean) as string[])]))];

  const replaceTxn = (updated: Transaction) => {
    setTxns((prev) => prev.map((txn) => (txn.id === updated.id || txn.row === updated.row ? updated : txn)));
    if (updated.category) setLocalCategories((prev) => ({ ...prev, [updated.id]: updated.category ?? "" }));
  };

  const confirmTxn = async (txn: Transaction) => {
    try {
      const { data } = await statementsApi.patchTransaction(id, txn.row, {});
      replaceTxn(data);
      toast.success(`Row ${txn.row} dikonfirmasi`);
    } catch {
      toast.error(`Gagal konfirmasi row ${txn.row}`);
    }
  };

  const startRevision = (txn: Transaction) => {
    setEditingReviewId(txn.id);
    setReviewDrafts((prev) => ({
      ...prev,
      [txn.id]: {
        description_raw: txn.description_raw,
        debit: amountDraft(txn.debit),
        credit: amountDraft(txn.credit),
        balance: amountDraft(txn.balance),
        category: txn.category ?? "",
      },
    }));
  };

  const saveRevision = async (txn: Transaction) => {
    const draft = reviewDrafts[txn.id];
    if (!draft) return;
    try {
      const { data } = await statementsApi.patchTransaction(id, txn.row, {
        description_raw: draft.description_raw,
        debit: numberOrNull(draft.debit),
        credit: numberOrNull(draft.credit),
        balance: numberOrNull(draft.balance),
        category: draft.category || null,
      });
      replaceTxn(data);
      setEditingReviewId(null);
      toast.success(`Row ${txn.row} direvisi dan dikonfirmasi`);
    } catch {
      toast.error(`Gagal menyimpan revisi row ${txn.row}`);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back navigation */}
        <Link href="/statements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Statements
        </Link>
        {/* Header card */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-card p-6 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {stmt.bank_name || stmt.bank_code || "Unknown Bank"}
                </h1>
                <StatusBadge status={stmt.status} />
                {stmt.is_reconciled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                    <CheckCircle2 className="w-3 h-3" /> Balanced
                  </span>
                )}
                {!stmt.is_reconciled && stmt.status === "needs_review" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-200">
                    <AlertTriangle className="w-3 h-3" /> Tidak Balance
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {stmt.account_holder} · {stmt.account_no_masked} ·{" "}
                {formatDate(stmt.period_start)} – {formatDate(stmt.period_end)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={refetch}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              {(stmt.status === "done" || stmt.status === "needs_review") && (
                <>
                  <a
                    href={statementsApi.exportUrl(id, "xlsx")}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel
                  </a>
                  <a
                    href={statementsApi.exportUrl(id, "json")}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Parsing banner */}
        {isParsing && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-600">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            Sedang mem-parsing statement… halaman diperbarui otomatis.
          </div>
        )}

        <Tabs defaultValue="ringkasan">
          <TabsList className="mb-6 bg-slate-50 border border-slate-200 p-0.5 rounded-xl">
            <TabsTrigger value="ringkasan" className="rounded-lg text-slate-500 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="transaksi" className="rounded-lg text-slate-500 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              Transaksi ({txns.length})
            </TabsTrigger>
            <TabsTrigger value="redflags" className="rounded-lg text-slate-500 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              Red Flags
              {flags.length > 0 && (
                <span className="ml-1.5 bg-red-500/80 text-slate-900 text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                  {flags.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="export" className="rounded-lg text-slate-500 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              Export
            </TabsTrigger>
          </TabsList>

          {/* ── Ringkasan ─────────────────────────── */}
          <TabsContent value="ringkasan">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <MetricCard label="Total Kredit" value={formatIDR(risk?.total_credit ?? null)} highlight="green" icon={<ArrowDownCircle className="w-4 h-4" />} />
              <MetricCard label="Total Debit" value={formatIDR(risk?.total_debit ?? null)} highlight="red" icon={<ArrowUpCircle className="w-4 h-4" />} />
              <MetricCard label="Net Flow" value={formatIDR(risk?.net_flow ?? null)} highlight={risk?.net_flow != null && risk.net_flow >= 0 ? "green" : "red"} icon={<Scale className="w-4 h-4" />} />
              <MetricCard label="Saldo Rata-rata" value={formatIDR(risk?.avg_daily_balance ?? null)} highlight="blue" icon={<TrendingUp className="w-4 h-4" />} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <MetricCard label="Saldo Awal" value={formatIDR(stmt.opening_balance)} />
              <MetricCard label="Saldo Akhir" value={formatIDR(stmt.closing_balance)} />
              <MetricCard label="Saldo Minimum" value={formatIDR(risk?.min_balance ?? null)} />
              <MetricCard label="DSR Estimasi" value={risk?.dsr != null ? formatPct(risk.dsr) : "—"} sub="Debt Service Ratio" />
            </div>

            {chartData.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-4">
                <p className="text-xs font-semibold text-slate-500 mb-3">Tren Saldo Harian</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Line type="monotone" dataKey="saldo" stroke="#14b8a6" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {barData.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-3">Kredit vs Debit per Bulan</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={barData}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Bar dataKey="in" fill="#10b981" name="Kredit" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="out" fill="#f87171" name="Debit" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* ── Transaksi ─────────────────────────── */}
          <TabsContent value="transaksi">
            {txnLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {/* SD3 — Category breakdown chart */}
                {categoryBreakdown.length > 1 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Breakdown per Kategori</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={categoryBreakdown} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} unit="M" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }}
                          formatter={(v, name) => [`Rp ${Number(v).toFixed(1)}M`, name === "debit" ? "Debit" : "Kredit"]}
                        />
                        <Bar dataKey="credit" name="Kredit" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="debit" name="Debit" fill="#f87171" radius={[3, 3, 0, 0]}>
                          {categoryBreakdown.map((_, idx) => <Cell key={idx} fill="#f87171" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Butuh human review</p>
                    <p className="mt-1 text-2xl font-bold text-amber-800">{reviewTxns.length}</p>
                    <p className="mt-1 text-xs text-amber-700">Baris dengan confidence di bawah 100%.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Sudah disentuh manusia</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-800">{reviewedTxns.length}</p>
                    <p className="mt-1 text-xs text-emerald-700">Confirm atau revisi akan menjadi 100%.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Confidence statement</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">
                      {txns.length ? `${Math.round((txns.reduce((sum, t) => sum + (t.confidence ?? 0), 0) / txns.length) * 100)}%` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Rata-rata confidence seluruh row.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-card overflow-hidden shadow-sm">
                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-teal-400 cursor-pointer"
                    >
                      {categoriesUpdated.map((c) => (
                        <option key={c} value={c}>{c === "Semua" ? "Semua Kategori" : c.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={flagOnly}
                        onChange={(e) => setFlagOnly(e.target.checked)}
                        className="rounded accent-red-500"
                      />
                      <span className="text-xs text-slate-600">Hanya transaksi bermasalah</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reviewOnly}
                        onChange={(e) => setReviewOnly(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-xs text-slate-600">Butuh review</span>
                    </label>
                    <span className="text-xs text-slate-400 ml-auto">
                      {filteredTxns.length} dari {txns.length} transaksi
                    </span>
                    <button
                      onClick={() => exportCSV(filteredTxns, `transaksi-${id}.csv`)}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-100">
                        <tr>
                          {["#", "Tanggal", "Keterangan", "Debit", "Kredit", "Saldo", "Kategori", "Confidence", "Flag", "Aksi"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTxns.length === 0 ? (
                          <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada transaksi sesuai filter.</td></tr>
                        ) : filteredTxns.map((t) => {
                          const anomaly = isAnomaly(t);
                          const needsReview = needsHumanReview(t);
                          const draft = reviewDrafts[t.id];
                          const anomalyText = anomaly ? anomalyReason(t, avgDebit, avgCredit) : "";
                          return (
                            <Fragment key={t.id}>
                              <tr
                                className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${anomaly ? "bg-orange-50/60 border-l-2 border-l-orange-400"
                                  : t.flags?.length ? "bg-red-50/40"
                                    : needsReview ? "bg-amber-50/40" : ""
                                  }`}
                              >
                                <td className="px-4 py-2.5 text-slate-700 text-xs font-mono">{t.row}</td>
                                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                <td className="px-4 py-2.5 max-w-xs truncate text-slate-600 text-xs" title={t.description_raw}>{t.description_raw}</td>
                                <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap text-xs">
                                  {t.debit ? (
                                    <span className={anomaly && t.debit != null && Number(t.debit) > avgDebit * 3 ? "text-orange-600 font-bold" : "text-red-600"}>
                                      {formatIDR(Number(t.debit))}
                                    </span>
                                  ) : ""}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap text-xs">
                                  {t.credit ? (
                                    <span className={anomaly && t.credit != null && Number(t.credit) > avgCredit * 3 ? "text-orange-600 font-bold" : "text-emerald-700"}>
                                      {formatIDR(Number(t.credit))}
                                    </span>
                                  ) : ""}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-400 whitespace-nowrap text-xs">
                                  {formatIDR(t.balance != null ? Number(t.balance) : null)}
                                </td>
                                <td className="px-4 py-2.5 group/cat">
                                  {editingCategoryId === t.id ? (
                                    <div className="flex items-center gap-1">
                                      <select
                                        autoFocus
                                        defaultValue={t.category ?? ""}
                                        onChange={(e) => {
                                          setLocalCategories((prev) => ({ ...prev, [t.id]: e.target.value }));
                                          setEditingCategoryId(null);
                                        }}
                                        className="text-[10px] rounded border border-teal-300 bg-white px-1.5 py-0.5 text-slate-700 outline-none"
                                      >
                                        {categoriesUpdated.filter((c) => c !== "Semua").map((c) => (
                                          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                                        ))}
                                      </select>
                                      <button onClick={() => setEditingCategoryId(null)}>
                                        <X className="h-3 w-3 text-slate-400" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      {t.category && (
                                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-500">
                                          {t.category.replace(/_/g, " ")}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => setEditingCategoryId(t.id)}
                                        className="opacity-0 group-hover/cat:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100"
                                        title="Edit kategori"
                                      >
                                        <Pencil className="h-3 w-3 text-slate-400" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {needsReview ? (
                                    <div title={confidenceReason(t)}>
                                      <span className="inline-flex min-w-12 justify-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                        {confidencePct(t)}%
                                      </span>
                                      <p className="mt-1 text-[10px] leading-4 text-amber-700">{confidenceTier(t)}</p>
                                    </div>
                                  ) : (
                                    <div title={confidenceReason(t)}>
                                      <span className="inline-flex min-w-12 justify-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                        {confidencePct(t)}%
                                      </span>
                                      <p className="mt-1 text-[10px] leading-4 text-emerald-700">{confidenceTier(t)}</p>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-1">
                                    {anomaly && (
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full ring-1 ring-orange-200"
                                        title={anomalyText}
                                      >
                                        anomali
                                      </span>
                                    )}
                                    {(t.flags || []).map((f) => (
                                      <span
                                        key={f}
                                        className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full ring-1 ring-red-200"
                                        title={FLAG_REASONS[f] ?? "Flag risiko dari rule parser."}
                                      >
                                        {f}
                                      </span>
                                    ))}
                                    {t.is_manually_corrected && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full ring-1 ring-emerald-200">human</span>
                                    )}
                                  </div>
                                  {anomaly && <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-orange-700">{anomalyText}</p>}
                                  {(t.flags || []).length > 0 && (
                                    <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-red-700">
                                      {(t.flags || []).map((f) => FLAG_REASONS[f] ?? "Flag risiko dari rule parser.").join(" ")}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {needsReview ? (
                                    <div className="relative inline-block">
                                      <button
                                        type="button"
                                        onClick={() => setOpenActionId(openActionId === t.id ? null : t.id)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                        title="Aksi review"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                      {openActionId === t.id && (
                                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                          <button
                                            type="button"
                                            onClick={() => { setOpenActionId(null); confirmTxn(t); }}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                            title="Konfirmasi row ini sebagai benar"
                                          >
                                            <Check className="h-3.5 w-3.5" /> Confirm
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { setOpenActionId(null); startRevision(t); }}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                            title="Revisi data row ini"
                                          >
                                            <Pencil className="h-3.5 w-3.5" /> Revisi
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                      <CheckCircle2 className="h-3 w-3" /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {editingReviewId === t.id && draft && (
                                <tr className="border-b border-amber-100 bg-amber-50/70">
                                  <td colSpan={10} className="px-4 py-3">
                                    <div className="grid gap-2 md:grid-cols-[1.7fr_0.7fr_0.7fr_0.7fr_1fr_auto] md:items-end">
                                      <label className="space-y-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Keterangan</span>
                                        <input
                                          value={draft.description_raw}
                                          onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [t.id]: { ...draft, description_raw: e.target.value } }))}
                                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Debit</span>
                                        <input
                                          value={draft.debit}
                                          onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [t.id]: { ...draft, debit: e.target.value } }))}
                                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Kredit</span>
                                        <input
                                          value={draft.credit}
                                          onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [t.id]: { ...draft, credit: e.target.value } }))}
                                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Saldo</span>
                                        <input
                                          value={draft.balance}
                                          onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [t.id]: { ...draft, balance: e.target.value } }))}
                                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Kategori</span>
                                        <select
                                          value={draft.category}
                                          onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [t.id]: { ...draft, category: e.target.value } }))}
                                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                                        >
                                          <option value="">Tanpa kategori</option>
                                          {categoriesUpdated.filter((c) => c !== "Semua").map((c) => (
                                            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => saveRevision(t)}
                                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                        >
                                          <Save className="h-3.5 w-3.5" /> Simpan
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingReviewId(null)}
                                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-600 flex items-center gap-2">
                    {stmt.is_reconciled
                      ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Rekonsiliasi saldo: OK</>
                      : <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Review · delta: {formatIDR(Number(stmt.reconciliation_delta))}</>}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Red Flags ─────────────────────────── */}
          <TabsContent value="redflags">
            {flags.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-emerald-300">Tidak ada red flag terdeteksi</p>
                <p className="text-sm text-emerald-500/70 mt-1">Statement ini melewati semua pemeriksaan risiko.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {flags
                  .sort((a, b) => (a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0))
                  .map((flag) => <FlagCard key={flag.flag_type} flag={flag} onInspect={setFocusedFlag} />)}

                {focusedFlag && (
                  <div className="rounded-xl border border-slate-200 bg-card overflow-hidden shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          Konteks: {focusedFlag.flag_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-600">±3 baris sebelum dan sesudah baris noted.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFocusedFlag(null)}
                        className="self-start rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-all md:self-auto"
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100">
                          <tr>
                            {["#", "Tanggal", "Keterangan", "Debit", "Kredit", "Saldo"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-600">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {focusedTxns.map((t) => {
                            const isNoted = focusedFlag.supporting_rows.includes(t.row);
                            return (
                              <tr key={t.id} className={`border-b border-slate-100 ${isNoted ? "bg-red-50" : ""}`}>
                                <td className="px-4 py-2.5 text-xs font-medium text-slate-500">
                                  {t.row}
                                  {isNoted && <span className="ml-2 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-400 ring-1 ring-red-500/20">noted</span>}
                                </td>
                                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                <td className="px-4 py-2.5 max-w-lg text-slate-400 text-xs" title={t.description_raw}>{t.description_raw}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-red-400 whitespace-nowrap text-xs">{t.debit ? formatIDR(Number(t.debit)) : ""}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-emerald-400 whitespace-nowrap text-xs">{t.credit ? formatIDR(Number(t.credit)) : ""}</td>
                                <td className="px-4 py-2.5 text-right text-slate-300 whitespace-nowrap text-xs">{formatIDR(t.balance != null ? Number(t.balance) : null)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Export ────────────────────────────── */}
          <TabsContent value="export">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href={statementsApi.exportUrl(id, "xlsx")}
                className="group block rounded-xl border border-emerald-500/20 bg-emerald-50 p-5 hover:border-emerald-500/40 hover:bg-emerald-500/12 transition-all"
              >
                <Download className="w-5 h-5 mb-3 text-emerald-400" />
                <p className="font-semibold text-emerald-300">Excel (.xlsx)</p>
                <p className="text-xs text-emerald-500/60 mt-1">Format tabel untuk credit memo & analisis.</p>
              </a>
              <a
                href={statementsApi.exportUrl(id, "json")}
                className="group block rounded-xl border border-slate-200 bg-slate-50 p-5 hover:border-slate-300 hover:bg-slate-100 transition-all"
              >
                <Download className="w-5 h-5 mb-3 text-slate-400" />
                <p className="font-semibold text-slate-200">JSON (API)</p>
                <p className="text-xs text-slate-600 mt-1">Format mesin untuk pipeline scoring.</p>
              </a>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 opacity-40 cursor-not-allowed">
                <Download className="w-5 h-5 mb-3 text-slate-600" />
                <p className="font-semibold text-slate-500">PDF Report</p>
                <p className="text-xs text-slate-400 mt-1">Segera hadir — Fase 2</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* R4 — Sticky action bar */}
      {stmt && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center justify-center gap-3 shadow-lg">
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {stmt.status === "failed" && (
            <button onClick={handleReparse} disabled={reparsing} className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600">
              <RefreshCw className={`h-3.5 w-3.5 ${reparsing ? "animate-spin" : ""}`} /> Re-parse
            </button>
          )}
          {!stmt.is_reconciled && (stmt.status === "done" || stmt.status === "needs_review") && (
            <button onClick={handleReconcile} disabled={reconciling} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> {reconciling ? "..." : "Rekonsiliasi"}
            </button>
          )}
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600">
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>
        </div>
      )}
    </AppShell>
  );
}
