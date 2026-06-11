"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard, GlowButton, DataCard, HealthScoreCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { formatDate, formatIDR } from "@/lib/utils";
import { computeEWSTier, localData, LoanFacility } from "@/lib/localData";
import {
  AlertTriangle, ArrowRight, Building2, CloudUpload,
  FileText, ShieldCheck, Timer, X, AlertCircle, Bell, Settings2, Eye, EyeOff,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

const DOC_TYPE_LABEL: Record<string, string> = {
  bank_statement: "Bank Statement",
  profit_loss: "P&L",
  cash_flow: "Cash Flow",
  balance_sheet: "Neraca",
  other: "Lainnya",
};

const WIDGETS = [
  { id: "kpi",      label: "Briefing Hari Ini" },
  { id: "health",   label: "Health Score & Distribusi Risiko" },
  { id: "ews",      label: "Early Warning System" },
  { id: "todo",     label: "Things To Do" },
  { id: "activity", label: "Aktivitas Terakhir" },
] as const;

type WidgetId = (typeof WIDGETS)[number]["id"];

function loadWidgetVisibility(): Record<WidgetId, boolean> {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("dashboard_widgets") : null;
    if (stored) return { ...Object.fromEntries(WIDGETS.map(w => [w.id, true])), ...JSON.parse(stored) } as Record<WidgetId, boolean>;
  } catch { /* ignore */ }
  return Object.fromEntries(WIDGETS.map(w => [w.id, true])) as Record<WidgetId, boolean>;
}

type RiskTier = "High" | "Medium" | "Low";
function getRiskTier(item: CompanySummary): RiskTier {
  const failRate = item.document_count > 0 ? item.failed_uploads / item.document_count : 0;
  const netFlow = Number(item.total_credit) - Number(item.total_debit);
  if (item.failed_uploads > 1 || failRate > 0.4 || item.latest_status === "failed") return "High";
  if (item.failed_uploads > 0 || item.latest_status === "needs_review" || netFlow < 0) return "Medium";
  return "Low";
}

const TIER_COLORS: Record<RiskTier, string> = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
};

function formatCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} Jt`;
  return formatIDR(value);
}

export default function HomePage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<3 | 6 | 12 | 0>(0);
  const [widgetVisible, setWidgetVisible] = useState<Record<WidgetId, boolean>>(loadWidgetVisibility);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);

  const toggleWidget = (id: WidgetId) => {
    setWidgetVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("dashboard_widgets", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const filteredStatements = useMemo(() => {
    if (!periodFilter) return statements;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - periodFilter);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return statements.filter((s) => (s.period_end ?? s.period_start ?? s.created_at) >= cutoffStr);
  }, [statements, periodFilter]);

  const bankStatements = filteredStatements.filter((s) => s.document_type === "bank_statement");
  const failedList = filteredStatements.filter((s) => s.status === "failed");
  const needsReview = filteredStatements.filter((s) => s.status === "needs_review");
  const done = filteredStatements.filter((s) => s.status === "done");
  const recent = useMemo(() =>
    [...filteredStatements].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [filteredStatements]
  );
  const todoStatements = useMemo(() =>
    filteredStatements
      .filter((s) => s.status === "failed" || s.status === "needs_review")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 4),
    [filteredStatements]
  );
  const showAlert = !alertDismissed && (failedList.length > 0 || needsReview.length > 0);

  const totalCredit = companies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit = companies.reduce((a, c) => a + Number(c.total_debit), 0);
  const netFlow = totalCredit - totalDebit;

  // Health score & risk distribution
  const tierCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    companies.forEach((c) => counts[getRiskTier(c)]++);
    return counts;
  }, [companies]);

  const healthScore = useMemo(() => {
    const totalFailed = companies.reduce((a, c) => a + c.failed_uploads, 0);
    return Math.max(0, 100 - tierCounts.High * 30 - tierCounts.Medium * 10 - totalFailed * 5);
  }, [companies, tierCounts]);

  const tierData = [
    { name: "High", value: tierCounts.High, fill: TIER_COLORS.High },
    { name: "Medium", value: tierCounts.Medium, fill: TIER_COLORS.Medium },
    { name: "Low", value: tierCounts.Low, fill: TIER_COLORS.Low },
  ].filter((d) => d.value > 0);

  const maxFlow = Math.max(totalCredit, totalDebit) || 1;

  const overdueWatchlist = useMemo(() => {
    if (typeof window === "undefined") return [];
    const today = new Date().toISOString().slice(0, 10);
    return localData.getWatchlist().filter((w) => w.targetDate && w.targetDate < today && w.actionPlan);
  }, []);

  const dscrAlerts = useMemo(() => companies.filter((c) => {
    const cr = Number(c.total_credit);
    const db = Number(c.total_debit);
    return cr > 0 && db / cr > 0.7 && c.bank_statement_count > 0;
  }), [companies]);

  const covenantBreachLoans = useMemo<LoanFacility[]>(() => {
    if (typeof window === "undefined") return [];
    return localData.getLoans().filter((l) => l.covenants.some((c) => c.status === "breach"));
  }, []);

  const ewsCompanies = useMemo(() => {
    return companies
      .map((c) => ({
        id: c.company.id,
        name: c.company.name,
        tier: computeEWSTier(c.failed_uploads, c.document_count, Number(c.total_credit), Number(c.total_debit), c.latest_status ?? undefined),
        reason: c.failed_uploads > 0 ? `${c.failed_uploads} dokumen gagal parse`
          : (Number(c.total_credit) - Number(c.total_debit)) < 0 ? "Net flow negatif"
          : c.latest_status === "needs_review" ? "Butuh review"
          : "Monitoring",
      }))
      .filter((c) => c.tier !== "hijau")
      .sort((a, b) => (a.tier === "merah" ? -1 : 1) - (b.tier === "merah" ? -1 : 1));
  }, [companies]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-1 select-none">Insights</p>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Insights</h1>
              <p className="text-sm text-slate-500 mt-0.5">Cashflow agregat, distribusi risiko, dan peringkat perusahaan</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                {([0, 3, 6, 12] as const).map((m) => (
                  <button key={m} onClick={() => setPeriodFilter(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${periodFilter === m ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {m === 0 ? "Semua" : `${m}B`}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button onClick={() => setShowWidgetPanel((p) => !p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${showWidgetPanel ? "border-violet-300 bg-violet-50 text-violet-600" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
                  title="Sesuaikan widget">
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                {showWidgetPanel && (
                  <div className="absolute right-0 top-9 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-black/5">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tampilkan Widget</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {WIDGETS.map((w) => {
                        const on = widgetVisible[w.id];
                        return (
                          <button key={w.id} onClick={() => toggleWidget(w.id)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50">
                            <span className={on ? "text-slate-700 font-medium" : "text-slate-400"}>{w.label}</span>
                            {on ? <Eye className="h-3.5 w-3.5 text-violet-500" /> : <EyeOff className="h-3.5 w-3.5 text-slate-300" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        {widgetVisible.kpi && <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Briefing Hari Ini</p>
          {loading ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatCard
                icon={<Building2 className="h-4 w-4" />}
                value={companies.length}
                label="Total Perusahaan"
                color="violet"
                subtitle="High / Medium / Low"
                subtitleValue={`${tierCounts.High} · ${tierCounts.Medium} · ${tierCounts.Low}`}
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                value={bankStatements.length}
                label="Bank Statement"
                color="amber"
                subtitle="Total semua dokumen"
                subtitleValue={statements.length}
              />
              <StatCard
                icon={<ShieldCheck className="h-4 w-4" />}
                value={done.length}
                label="Selesai"
                color="emerald"
                subtitle="Dari total statement"
                subtitleValue={bankStatements.length > 0 ? `${Math.round((done.length / bankStatements.length) * 100)}%` : "0%"}
              />
              <StatCard
                icon={<Timer className="h-4 w-4" />}
                value={failedList.length + needsReview.length}
                label="Butuh Perhatian"
                color={(failedList.length + needsReview.length) > 0 ? "red" : "default"}
                subtitle={`${failedList.length} gagal · ${needsReview.length} review`}
              />
            </div>
          )}
        </div>}

        {/* Health Score + Risk Distribution + Financial Summary */}
        {widgetVisible.health && <div className="grid gap-4 lg:grid-cols-3">

          {/* Health Score */}
          <DataCard className="flex flex-col items-center justify-center">
            {loading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : (
              <HealthScoreCard score={healthScore} />
            )}
          </DataCard>

          {/* Risk Distribution */}
          <DataCard>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Distribusi Risiko</p>
            {loading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : tierData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={140}>
                  <PieChart>
                    <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={38} outerRadius={58} paddingAngle={3}>
                      {tierData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [`${v} perusahaan`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {(["High", "Medium", "Low"] as RiskTier[]).map((tier) => {
                    const count = tierCounts[tier];
                    const total = companies.length || 1;
                    return (
                      <div key={tier}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[tier] }} />
                            {tier}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(count / total) * 100}%`, backgroundColor: TIER_COLORS[tier] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DataCard>

          {/* Financial Summary */}
          <DataCard>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Ringkasan Finansial</p>
            {loading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Total Kredit", value: totalCredit, color: "bg-emerald-500", text: "text-emerald-700" },
                  { label: "Total Debit", value: totalDebit, color: "bg-red-400", text: "text-red-600" },
                ].map(({ label, value, color, text }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-semibold ${text}`}>{formatCompact(value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / maxFlow) * 100}%` }} />
                    </div>
                  </div>
                ))}

                <div className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2.5 ${netFlow >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className="text-xs text-slate-500">Net Flow</span>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${netFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {netFlow >= 0 ? "+" : "−"} {formatCompact(Math.abs(netFlow))}
                    </p>
                    <p className={`text-[10px] font-semibold ${netFlow >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {netFlow >= 0 ? "Surplus" : "Defisit"}
                    </p>
                  </div>
                </div>

              </div>
            )}
          </DataCard>
        </div>}

        {/* EWS Risk Alert Widget */}
        {widgetVisible.ews && ewsCompanies.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Early Warning System</p>
                <p className="mt-0.5 text-xs text-slate-500">{ewsCompanies.filter(c => c.tier === "merah").length} merah · {ewsCompanies.filter(c => c.tier === "kuning").length} kuning</p>
              </div>
              <Link href="/watchlist" className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                Lihat Watchlist <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ewsCompanies.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/companies/${c.id}`}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:shadow-sm ${c.tier === "merah" ? "border-red-200 bg-red-50/60 hover:bg-red-50" : "border-amber-200 bg-amber-50/60 hover:bg-amber-50"}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.tier === "merah" ? "bg-red-100" : "bg-amber-100"}`}>
                    <Bell className={`h-4 w-4 ${c.tier === "merah" ? "text-red-600" : "text-amber-600"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{c.name}</p>
                    <p className={`text-[11px] ${c.tier === "merah" ? "text-red-600" : "text-amber-600"}`}>{c.reason}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${c.tier === "merah" ? "bg-red-100 text-red-700 ring-red-200" : "bg-amber-100 text-amber-700 ring-amber-200"}`}>
                    {c.tier.toUpperCase()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Things To Do */}
        {widgetVisible.todo && <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Things To Do Today</p>
              <p className="mt-0.5 text-xs text-slate-500">Pending sebelumnya yang perlu dibereskan dulu</p>
            </div>
            <Link href="/documents" className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
              Kelola semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {showAlert && (
                  <div className="p-3">
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm shadow-sm shadow-amber-100/50">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-amber-500 ring-1 ring-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-amber-900">
                              {failedList.length + needsReview.length} dokumen butuh perhatian
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {failedList.length > 0 && (
                                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                                  <AlertCircle className="h-3 w-3" /> {failedList.length} gagal parse
                                </span>
                              )}
                              {needsReview.length > 0 && (
                                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                  <AlertTriangle className="h-3 w-3" /> {needsReview.length} perlu review
                                </span>
                              )}
                            </div>
                          </div>
                          <Link
                            href="/documents"
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
                          >
                            Lihat sekarang
                          </Link>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlertDismissed(true)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-100"
                        aria-label="Tutup alert"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {todoStatements.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Tidak ada pending prioritas</p>
                      <p className="text-xs text-slate-500">Semua dokumen kritis sudah aman untuk saat ini.</p>
                    </div>
                  </div>
                ) : (
                  todoStatements.map((s) => {
                    const company = companies.find((c) => c.company.id === s.company_id);
                    const href = s.document_type === "bank_statement" && s.status === "needs_review"
                      ? `/documents/${s.id}`
                      : "/documents";
                    const isFailed = s.status === "failed";
                    return (
                      <Link
                        key={s.id}
                        href={href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${isFailed ? "bg-red-50 text-red-600 ring-red-100" : "bg-amber-50 text-amber-600 ring-amber-100"}`}>
                          {isFailed ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {company?.company.name ?? s.account_holder ?? "Dokumen tanpa nama"}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {isFailed ? "Perlu upload ulang / cek file" : "Perlu review hasil parsing"}
                            {s.bank_name ? ` · ${s.bank_name}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={s.status} />
                          <span className="hidden text-[11px] text-slate-300 sm:inline">{formatDate(s.created_at)}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                      </Link>
                    );
                  })
                )}
                {overdueWatchlist.length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-red-50/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">⏰ Watchlist — Action Plan Terlambat</p>
                    </div>
                    {overdueWatchlist.slice(0, 3).map((w) => (
                      <Link key={w.id} href="/watchlist"
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-50/40">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                          <Timer className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">{w.companyName}</p>
                          <p className="truncate text-[11px] text-red-600">Target: {w.targetDate} — {w.actionPlan}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">OVERDUE</span>
                      </Link>
                    ))}
                  </div>
                )}
                {dscrAlerts.length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-orange-50/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">⚠ DSCR Alert — DSR &gt; 70%</p>
                    </div>
                    {dscrAlerts.slice(0, 3).map((c) => {
                      const dsr = Number(c.total_debit) / Number(c.total_credit);
                      return (
                        <Link key={c.company.id} href={`/companies/${c.company.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-orange-50/40">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">{c.company.name}</p>
                            <p className="text-[11px] text-orange-600">DSR proxy {(dsr * 100).toFixed(0)}% — arus keluar sangat tinggi</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                )}
                {covenantBreachLoans.length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-rose-50/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">🔴 Covenant Breach Terdeteksi</p>
                    </div>
                    {covenantBreachLoans.slice(0, 3).map((l) => {
                      const breached = l.covenants.filter((c) => c.status === "breach");
                      return (
                        <Link key={l.id} href={`/loans/${l.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-rose-50/40">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">{l.companyName} — {l.facilityName}</p>
                            <p className="text-[11px] text-rose-600">{breached.length} covenant breach: {breached.map(c => c.description || c.type).join(", ")}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </DataCard>
        </div>}

        {/* Activity Feed */}
        {widgetVisible.activity && <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Aktivitas Terakhir</p>
            <Link href="/documents" className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Belum ada dokumen</p>
                <Link href="/upload" className="mt-2 inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium">
                  <CloudUpload className="h-4 w-4" /> Upload sekarang
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map((s) => {
                  const company = companies.find((c) => c.company.id === s.company_id);
                  const isBank = s.document_type === "bank_statement";
                  const canOpen = isBank && (s.status === "done" || s.status === "needs_review");
                  const href = canOpen ? `/documents/${s.id}` : s.company_id ? `/companies/${s.company_id}` : "#";
                  return (
                    <Link
                      key={s.id}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-violet-700 transition-colors">
                          {company?.company.name ?? s.account_holder ?? "—"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {s.bank_name ?? DOC_TYPE_LABEL[s.document_type] ?? s.document_type}
                          {s.period_start ? ` · ${formatDate(s.period_start)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={s.status} />
                        <span className="text-[11px] text-slate-300">{formatDate(s.created_at)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </DataCard>
        </div>}

      </div>
    </AppShell>
  );
}
