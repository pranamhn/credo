"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard, GlowButton, DataCard, HealthScoreCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { formatDate, formatIDR } from "@/lib/utils";
import {
  AlertTriangle, ArrowRight, Building2, CloudUpload,
  FileText, ShieldCheck, Timer, TrendingUp, X, AlertCircle,
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

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const bankStatements = statements.filter((s) => s.document_type === "bank_statement");
  const failedList = statements.filter((s) => s.status === "failed");
  const needsReview = statements.filter((s) => s.status === "needs_review");
  const done = statements.filter((s) => s.status === "done");
  const recent = useMemo(() =>
    [...statements].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [statements]
  );
  const todoStatements = useMemo(() =>
    statements
      .filter((s) => s.status === "failed" || s.status === "needs_review")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 4),
    [statements]
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
    { name: "High",   value: tierCounts.High,   fill: TIER_COLORS.High },
    { name: "Medium", value: tierCounts.Medium, fill: TIER_COLORS.Medium },
    { name: "Low",    value: tierCounts.Low,    fill: TIER_COLORS.Low },
  ].filter((d) => d.value > 0);

  const maxFlow = Math.max(totalCredit, totalDebit) || 1;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-1 select-none">Insights</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Insights</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cashflow agregat, distribusi risiko, dan peringkat perusahaan</p>
        </div>

        {/* KPI Strip */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Briefing Hari Ini</p>
          {loading ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
        </div>

        {/* Health Score + Risk Distribution + Financial Summary */}
        <div className="grid gap-4 lg:grid-cols-3">

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
                  { label: "Total Kredit", value: totalCredit,  color: "bg-emerald-500", text: "text-emerald-700" },
                  { label: "Total Debit",  value: totalDebit,   color: "bg-red-400",     text: "text-red-600"   },
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

                <div className="flex gap-2 pt-1">
                  <GlowButton variant="primary" icon={<CloudUpload className="h-3.5 w-3.5" />} href="/upload" className="flex-1 justify-center text-xs h-8">
                    Upload
                  </GlowButton>
                  <GlowButton variant="secondary" icon={<TrendingUp className="h-3.5 w-3.5" />} href="/analytics" className="flex-1 justify-center text-xs h-8">
                    Analytics
                  </GlowButton>
                </div>
              </div>
            )}
          </DataCard>
        </div>

        {/* Things To Do */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Things To Do Today</p>
              <p className="mt-0.5 text-xs text-slate-500">Pending sebelumnya yang perlu dibereskan dulu</p>
            </div>
            <Link href="/statements" className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
              Kelola semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[0,1,2].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}
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
                            href="/statements"
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
                      ? `/statements/${s.id}`
                      : "/statements";
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
              </div>
            )}
          </DataCard>
        </div>

        {/* Activity Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Aktivitas Terakhir</p>
            <Link href="/statements" className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}
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
                  const href = canOpen ? `/statements/${s.id}` : s.company_id ? `/companies/${s.company_id}` : "#";
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
        </div>

      </div>
    </AppShell>
  );
}
