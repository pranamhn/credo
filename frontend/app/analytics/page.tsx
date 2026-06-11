"use client";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, DataCard, StatCard } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { localData } from "@/lib/localData";
import { formatIDR } from "@/lib/utils";
import { BarChart2, Building2, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
};
const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };
const GRID = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

type RiskTier = "High" | "Medium" | "Low";
function getRiskTier(item: CompanySummary): RiskTier {
  const failRate = item.document_count > 0 ? item.failed_uploads / item.document_count : 0;
  const netFlow = Number(item.total_credit) - Number(item.total_debit);
  if (item.failed_uploads > 1 || failRate > 0.4 || item.latest_status === "failed") return "High";
  if (item.failed_uploads > 0 || item.latest_status === "needs_review" || netFlow < 0) return "Medium";
  return "Low";
}

const TIER_COLORS: Record<RiskTier, string> = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };

function formatCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}Jt`;
  return formatIDR(value);
}

// Custom tick for long names — wrap via title attribute via XAxis
function CustomYTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const name = payload?.value ?? "";
  const short = name.replace(/^PT\s+/, "").slice(0, 18);
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#94a3b8" fontSize={10}>
      {short}
    </text>
  );
}

export default function AnalyticsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<3 | 6 | 12 | 0>(0);

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const activeStatements = useMemo(() => {
    if (period === 0) return statements;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - period);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return statements.filter((s) => !s.period_end || s.period_end.slice(0, 10) >= cutoffStr);
  }, [statements, period]);

  const activeCompanyIds = useMemo(() => new Set(activeStatements.map((s) => s.company_id).filter(Boolean)), [activeStatements]);
  const activeCompanies = useMemo(() => companies.filter((c) => activeCompanyIds.has(c.company.id)), [companies, activeCompanyIds]);

  // Risk tier distribution
  const tierData = useMemo(() => {
    const counts: Record<RiskTier, number> = { High: 0, Medium: 0, Low: 0 };
    for (const c of activeCompanies) counts[getRiskTier(c)]++;
    return (["High", "Medium", "Low"] as RiskTier[]).map((tier) => ({ name: tier, value: counts[tier], fill: TIER_COLORS[tier] }));
  }, [activeCompanies]);

  // Top companies sorted by risk
  const topRiskCompanies = useMemo(() => {
    const TIER_ORDER: Record<RiskTier, number> = { High: 0, Medium: 1, Low: 2 };
    return [...activeCompanies]
      .sort((a, b) => {
        const ta = TIER_ORDER[getRiskTier(a)], tb = TIER_ORDER[getRiskTier(b)];
        if (ta !== tb) return ta - tb;
        return b.failed_uploads - a.failed_uploads;
      })
      .slice(0, 10);
  }, [activeCompanies]);

  // Status breakdown
  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of activeStatements) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [activeStatements]);

  // Summary stats
  const totalCredit = activeCompanies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit = activeCompanies.reduce((a, c) => a + Number(c.total_debit), 0);

  // Tren upload per bulan (NEW)
  const uploadTrendData = useMemo(() => {
    const map: Record<string, { month: string; uploaded: number; done: number; failed: number }> = {};
    activeStatements.forEach((s) => {
      const month = s.created_at.slice(0, 7); // "2026-01"
      if (!map[month]) map[month] = { month, uploaded: 0, done: 0, failed: 0 };
      map[month].uploaded++;
      if (s.status === "done") map[month].done++;
      if (s.status === "failed") map[month].failed++;
    });
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        ...d,
        month: new Date(d.month + "-01").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      }));
  }, [activeStatements]);

  // Net flow per company — horizontal bar (NEW)
  const netFlowBarData = useMemo(() => {
    return [...activeCompanies]
      .map((c) => ({
        name: c.company.name.replace(/^PT\s+/, ""),
        net: (Number(c.total_credit) - Number(c.total_debit)) / 1e6,
      }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 12);
  }, [activeCompanies]);

  // Vintage & obligor data
  const vintageData = useMemo(() => {
    const loans = localData.getLoans();
    if (loans.length === 0) return null;
    const cohorts: Record<string, { total: number; npl: number; outstanding: number }> = {};
    loans.forEach((l) => {
      const year = l.startDate.slice(0, 4);
      if (!cohorts[year]) cohorts[year] = { total: 0, npl: 0, outstanding: 0 };
      cohorts[year].total++;
      cohorts[year].outstanding += l.outstanding;
      if (l.kolektibilitas >= 3) cohorts[year].npl++;
    });
    return Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b)).map(([year, c]) => ({
      year, total: c.total, npl: c.npl,
      nplRate: c.total > 0 ? (c.npl / c.total) * 100 : 0,
      outstanding: c.outstanding,
    }));
  }, []);

  const obligorData = useMemo(() => {
    const loans = localData.getLoans();
    if (loans.length === 0) return null;
    const map: Record<string, { name: string; totalOutstanding: number; count: number }> = {};
    loans.forEach((l) => {
      if (!map[l.companyName]) map[l.companyName] = { name: l.companyName, totalOutstanding: 0, count: 0 };
      map[l.companyName].totalOutstanding += l.outstanding;
      map[l.companyName].count++;
    });
    const MODAL_BANK = 100_000_000_000;
    return Object.values(map).map((g) => ({ ...g, pctModal: (g.totalOutstanding / MODAL_BANK) * 100 })).sort((a, b) => b.pctModal - a.pctModal).slice(0, 10);
  }, []);

  const stressTestData = useMemo(() => {
    const loans = localData.getLoans();
    if (loans.length === 0) return null;
    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
    const currentNpl = loans.filter((l) => l.kolektibilitas >= 3).reduce((s, l) => s + l.outstanding, 0);
    return [
      { label: "Base Case", shock: 0 },
      { label: "Mild Stress (-10%)", shock: 0.10 },
      { label: "Moderate Stress (-20%)", shock: 0.20 },
      { label: "Severe Stress (-30%)", shock: 0.30 },
    ].map((sc) => {
      const migratedNpl = loans.reduce((s, l) => {
        if (l.kolektibilitas >= 3) return s + l.outstanding;
        const migrateProb = l.kolektibilitas === 1 ? sc.shock * 0.3 : sc.shock * 0.6;
        return s + l.outstanding * migrateProb;
      }, 0);
      const newNpl = currentNpl + migratedNpl;
      const nplRatio = totalOutstanding > 0 ? (newNpl / totalOutstanding) * 100 : 0;
      const estimatedCkpn = newNpl * 0.5 + (totalOutstanding - newNpl) * 0.01;
      return { ...sc, nplRatio, newNpl, estimatedCkpn };
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="Insights"
          description="Cashflow agregat, distribusi risiko, dan peringkat perusahaan"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {([{ label: "Semua", value: 0 }, { label: "3B", value: 3 }, { label: "6B", value: 6 }, { label: "12B", value: 12 }] as { label: string; value: 0|3|6|12 }[]).map(({ label, value }) => (
                  <button key={value} onClick={() => setPeriod(value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            <Skeleton className="h-64 rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatCard
                icon={<Building2 className="h-4 w-4" />}
                value={activeCompanies.length}
                label="Total Perusahaan"
                color="cyan"
                subtitle="High / Medium / Low"
                subtitleValue={`${tierData.find(d=>d.name==="High")?.value??0} · ${tierData.find(d=>d.name==="Medium")?.value??0} · ${tierData.find(d=>d.name==="Low")?.value??0}`}
              />
              <StatCard
                icon={<BarChart2 className="h-4 w-4" />}
                value={activeStatements.length}
                label="Total Statement"
                color="indigo"
                subtitle="Selesai diparse"
                subtitleValue={statusChart.find(s=>s.status==="done")?.count ?? 0}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                value={formatCompact(totalCredit)}
                label="Total Kredit"
                color="emerald"
                subtitle="Total Debit"
                subtitleValue={formatCompact(totalDebit)}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                value={formatCompact(totalCredit - totalDebit)}
                label="Net Flow"
                color={totalCredit >= totalDebit ? "emerald" : "red"}
                subtitle="Status portofolio"
                subtitleValue={totalCredit >= totalDebit ? "Surplus" : "Defisit"}
              />
            </div>

            {/* Tren Upload & Parsing — NEW */}
            {uploadTrendData.length > 1 && (
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Tren Upload & Parsing</p>
                <p className="text-xs text-slate-400 mb-4">Jumlah dokumen per bulan berdasarkan tanggal upload</p>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={uploadTrendData} barCategoryGap="35%">
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                    <Bar dataKey="uploaded" name="Diupload" fill="#7c3aed" radius={[3,3,0,0]} />
                    <Bar dataKey="done"     name="Selesai"  fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="failed"   name="Gagal"    fill="#ef4444" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DataCard>
            )}


            {/* Net Flow Ranking — Horizontal Bar (replaces area chart) */}
            {netFlowBarData.length > 0 && (
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Net Flow Ranking</p>
                <p className="text-xs text-slate-400 mb-4">Kredit − Debit per perusahaan (juta Rp) · hijau = surplus · merah = defisit</p>
                <ResponsiveContainer width="100%" height={netFlowBarData.length * 32 + 20}>
                  <BarChart data={netFlowBarData} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid {...GRID} horizontal={false} />
                    <XAxis type="number" tick={AXIS_TICK} tickLine={false} unit="M" />
                    <YAxis type="category" dataKey="name" width={120} tick={<CustomYTick />} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`Rp ${Number(v).toFixed(1)}M`, "Net Flow"]} />
                    <Bar dataKey="net" name="Net Flow" radius={[0,4,4,0]}
                      label={{ position: "right", fontSize: 10, fill: "#94a3b8", formatter: (v: unknown) => { const n = Number(v); return n >= 0 ? `+${n.toFixed(1)}M` : `${n.toFixed(1)}M`; } }}
                    >
                      {netFlowBarData.map((d, i) => (
                        <Cell key={i} fill={d.net >= 0 ? "#10b981" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </DataCard>
            )}

            {/* Top risk companies table */}
            <DataCard padding="flush">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Top Perusahaan by Risk Tier</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["#", "Perusahaan", "Risk", "Dok", "Gagal", "Kredit", "Debit", "Net Flow"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topRiskCompanies.map((c, i) => {
                      const tier = getRiskTier(c);
                      const netFlow = Number(c.total_credit) - Number(c.total_debit);
                      return (
                        <tr key={c.company.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-b-0">
                          <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[180px] truncate">{c.company.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ${
                              tier === "High" ? "bg-red-100 text-red-700 ring-red-200"
                              : tier === "Medium" ? "bg-amber-100 text-amber-700 ring-amber-200"
                              : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                            }`}>{tier}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{c.document_count}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={c.failed_uploads > 0 ? "text-red-600 font-semibold" : "text-slate-400"}>{c.failed_uploads}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-emerald-700 whitespace-nowrap">{formatCompact(Number(c.total_credit))}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-red-600 whitespace-nowrap">{formatCompact(Number(c.total_debit))}</td>
                          <td className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${netFlow >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {netFlow >= 0 ? "+" : "−"}{formatCompact(Math.abs(netFlow))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataCard>

            {/* Distribusi portofolio + status parsing */}
            <div className="grid gap-4 lg:grid-cols-2">
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Distribusi Portofolio — Risk Tier</p>
                <div className="space-y-3">
                  {tierData.map((d) => {
                    const total = tierData.reduce((s, t) => s + t.value, 0);
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (
                      <div key={d.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-600">{d.name} Risk</span>
                          <span className="text-slate-500">{d.value} perusahaan ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "NPL Ratio", tier: "High" as RiskTier, color: "text-red-600" },
                      { label: "Watch List", tier: "Medium" as RiskTier, color: "text-amber-600" },
                      { label: "Healthy", tier: "Low" as RiskTier, color: "text-emerald-600" },
                    ].map(({ label, tier, color }) => {
                      const val = tierData.find((d) => d.name === tier)?.value ?? 0;
                      const total = tierData.reduce((s, t) => s + t.value, 0);
                      return (
                        <div key={label} className="rounded-lg bg-slate-50 p-2">
                          <p className={`text-lg font-black ${color}`}>{val}</p>
                          <p className="text-[10px] text-slate-400">{label}</p>
                          <p className="text-[9px] text-slate-300">{total > 0 ? ((val / total) * 100).toFixed(0) : 0}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </DataCard>

              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Status Parsing — Distribusi</p>
                {statusChart.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>
                ) : (
                  <div className="space-y-2">
                    {statusChart.map((s) => {
                      const total = statusChart.reduce((sum, sc) => sum + sc.count, 0);
                      const pct = total > 0 ? (s.count / total) * 100 : 0;
                      const color = s.status === "done" ? "#10b981" : s.status === "failed" ? "#ef4444" : s.status === "needs_review" ? "#f59e0b" : s.status === "parsing" ? "#6366f1" : "#94a3b8";
                      return (
                        <div key={s.status}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500 capitalize">{s.status.replace("_", " ")}</span>
                            <span className="font-semibold text-slate-700">{s.count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DataCard>
            </div>

            {/* ── Analisis Portofolio Perbankan ── */}
            {(obligorData || vintageData || stressTestData) && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 shrink-0">Analisis Portofolio Perbankan</p>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {(obligorData || vintageData) && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {obligorData && (
                      <DataCard padding="flush">
                        <div className="px-5 py-3.5 border-b border-slate-100">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Single Obligor Limit (Top 10)</p>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-100 bg-slate-50">
                            <tr>{["Perusahaan", "Outstanding", "Fasilitas", "% Modal", ""].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {obligorData.map((g) => (
                              <tr key={g.name} className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0">
                                <td className="px-4 py-3 text-xs font-medium text-slate-700 max-w-[140px] truncate">{g.name}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">{formatIDR(g.totalOutstanding)}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{g.count}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                                      <div className={`h-full rounded-full ${g.pctModal > 25 ? "bg-red-500" : g.pctModal > 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${Math.min(g.pctModal, 100)}%` }} />
                                    </div>
                                    <span className={`text-[10px] font-bold ${g.pctModal > 25 ? "text-red-600" : "text-slate-500"}`}>{g.pctModal.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {g.pctModal > 25 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">BMPK</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </DataCard>
                    )}

                    {vintageData && (
                      <DataCard>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Vintage Analysis — NPL by Cohort Year</p>
                        {vintageData.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Belum ada data pinjaman</p> : (
                          <div className="space-y-3">
                            {vintageData.map((v) => (
                              <div key={v.year}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-semibold text-slate-600">Cohort {v.year}</span>
                                  <span className="text-slate-500">{v.total} fasilitas · {formatIDR(v.outstanding)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(v.nplRate, 100)}%` }} />
                                  </div>
                                  <span className={`text-[10px] font-bold w-10 text-right ${v.nplRate > 20 ? "text-red-600" : v.nplRate > 5 ? "text-amber-600" : "text-emerald-600"}`}>{v.nplRate.toFixed(0)}%</span>
                                  <span className="text-[10px] text-slate-400 w-12 text-right">{v.npl}/{v.total} NPL</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </DataCard>
                    )}
                  </div>
                )}

                {stressTestData && (
                  <DataCard>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Stress Testing — Dampak ke NPL & CKPN</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                          <tr>{["Scenario", "NPL Ratio", "NPL Amount", "Estimasi CKPN", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {stressTestData.map((sc) => (
                            <tr key={sc.label} className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0">
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700">{sc.label}</td>
                              <td className={`px-4 py-3 text-xs font-bold ${sc.nplRatio > 10 ? "text-red-600" : sc.nplRatio > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                                {sc.nplRatio.toFixed(1)}%
                                <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden mt-1">
                                  <div className={`h-full rounded-full ${sc.nplRatio > 10 ? "bg-red-400" : sc.nplRatio > 5 ? "bg-amber-400" : "bg-emerald-400"}`}
                                    style={{ width: `${Math.min(sc.nplRatio * 3, 100)}%` }} />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatIDR(sc.newNpl)}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-amber-700 whitespace-nowrap">{formatIDR(sc.estimatedCkpn)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${sc.nplRatio > 10 ? "bg-red-50 text-red-700 ring-red-200" : sc.nplRatio > 5 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                                  {sc.nplRatio > 10 ? "Critical" : sc.nplRatio > 5 ? "Warning" : "Stable"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataCard>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
