"use client";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, DataCard, StatCard } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { localData } from "@/lib/localData";
import { formatIDR } from "@/lib/utils";
import { BarChart2, Building2, TrendingUp, Download, CalendarDays } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
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

const TIER_COLORS: Record<RiskTier, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#10b981",
};

export default function AnalyticsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  // AN5 — Period filter
  const [period, setPeriod] = useState<3 | 6 | 12 | 0>(0); // 0 = all

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  // AN5 — Filter data by period
  const activeStatements = useMemo(() => {
    if (period === 0) return statements;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - period);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return statements.filter((s) => !s.period_end || s.period_end.slice(0, 10) >= cutoffStr);
  }, [statements, period]);

  const activeCompanyIds = useMemo(() => new Set(activeStatements.map((s) => s.company_id).filter(Boolean)), [activeStatements]);
  const activeCompanies = useMemo(() => companies.filter((c) => activeCompanyIds.has(c.company.id)), [companies, activeCompanyIds]);

  // AN2 — Risk tier distribution
  const tierData = useMemo(() => {
    const counts: Record<RiskTier, number> = { High: 0, Medium: 0, Low: 0 };
    for (const c of activeCompanies) counts[getRiskTier(c)]++;
    return (["High", "Medium", "Low"] as RiskTier[]).map((tier) => ({ name: tier, value: counts[tier], fill: TIER_COLORS[tier] }));
  }, [activeCompanies]);

  // AN3 — Top companies sorted by risk (High first, then failed_uploads desc)
  const topRiskCompanies = useMemo(() => {
    const TIER_ORDER: Record<RiskTier, number> = { High: 0, Medium: 1, Low: 2 };
    return [...activeCompanies]
      .sort((a, b) => {
        const ta = TIER_ORDER[getRiskTier(a)], tb = TIER_ORDER[getRiskTier(b)];
        if (ta !== tb) return ta - tb;
        return b.failed_uploads - a.failed_uploads;
      })
      .slice(0, 10);
  }, [companies]);

  // Statement status breakdown for bar chart
  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of activeStatements) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [activeStatements]);

  // Summary stats
  const totalCredit = activeCompanies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit = activeCompanies.reduce((a, c) => a + Number(c.total_debit), 0);

  // PF5 — Vintage analysis (cohort by year)
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

  // PF4 — Single obligor limit
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

  // Stress testing — scenario impact on portfolio
  const stressTestData = useMemo(() => {
    const loans = localData.getLoans();
    if (loans.length === 0) return null;
    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
    const currentNpl = loans.filter((l) => l.kolektibilitas >= 3).reduce((s, l) => s + l.outstanding, 0);
    const scenarios = [
      { label: "Base Case", shock: 0 },
      { label: "Mild Stress (-10%)", shock: 0.10 },
      { label: "Moderate Stress (-20%)", shock: 0.20 },
      { label: "Severe Stress (-30%)", shock: 0.30 },
    ];
    return scenarios.map((sc) => {
      const migratedNpl = loans.reduce((s, l) => {
        if (l.kolektibilitas >= 3) return s + l.outstanding;
        // Probability of migration based on shock
        const migrateProb = l.kolektibilitas === 1 ? sc.shock * 0.3 : sc.shock * 0.6;
        return s + l.outstanding * migrateProb;
      }, 0);
      const newNpl = currentNpl + migratedNpl;
      const nplRatio = totalOutstanding > 0 ? (newNpl / totalOutstanding) * 100 : 0;
      const estimatedCkpn = newNpl * 0.5 + (totalOutstanding - newNpl) * 0.01;
      return { ...sc, nplRatio, newNpl, estimatedCkpn };
    });
  }, []);


  // AN6 — Export analytics CSV
  const exportAnalytics = () => {
    const rows = [
      ["Metrik", "Nilai"],
      ["Total Perusahaan", String(activeCompanies.length)],
      ["Total Statement", String(activeStatements.length)],
      ["Total Kredit", formatIDR(totalCredit)],
      ["Total Debit", formatIDR(totalDebit)],
      ["Net Flow", formatIDR(totalCredit - totalDebit)],
      ["High Risk", String(tierData.find((d) => d.name === "High")?.value ?? 0)],
      ["Medium Risk", String(tierData.find((d) => d.name === "Medium")?.value ?? 0)],
      ["Low Risk", String(tierData.find((d) => d.name === "Low")?.value ?? 0)],
      ...statusChart.map((s) => [`Status: ${s.status}`, String(s.count)]),
      ["", ""],
      ["Top Risky Companies", ""],
      ["Perusahaan", "Risk Tier"],
      ...topRiskCompanies.map((c) => [c.company.name, getRiskTier(c)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="Analytics Portofolio"
          description="Cashflow agregat, distribusi risiko, dan peringkat perusahaan"
          actions={
            <div className="flex items-center gap-2">
              {/* AN5 — Period filter */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {[
                  { label: "Semua", value: 0 as const },
                  { label: "3B", value: 3 as const },
                  { label: "6B", value: 6 as const },
                  { label: "12B", value: 12 as const },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* AN6 — Export */}
              <button
                onClick={exportAnalytics}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatCard icon={<Building2 className="h-4 w-4" />} value={activeCompanies.length} label="Total Perusahaan" color="cyan" />
              <StatCard icon={<BarChart2 className="h-4 w-4" />} value={activeStatements.length} label="Total Statement" color="indigo" />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} value={formatIDR(totalCredit)} label="Total Kredit" color="emerald" />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} value={formatIDR(totalCredit - totalDebit)} label="Net Flow" color={totalCredit >= totalDebit ? "emerald" : "red"} />
            </div>

            {/* AN1 — Status breakdown */}
            {statusChart.length > 0 && (
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Status Parsing Statement</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusChart} barCategoryGap="40%">
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="status" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]}
                      fill="#6366f1"
                      label={{ position: "top", fontSize: 11, fill: "#64748b" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </DataCard>
            )}

            {/* AN1 + AN2 side by side */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Kredit vs Debit total per perusahaan */}
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Top 8 Perusahaan — Kredit vs Debit</p>
                {activeCompanies.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[...activeCompanies]
                        .sort((a, b) => Number(b.total_credit) - Number(a.total_credit))
                        .slice(0, 8)
                        .map((c) => ({
                          name: c.company.name.slice(0, 12),
                          Kredit: Number(c.total_credit) / 1e6,
                          Debit: Number(c.total_debit) / 1e6,
                        }))}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} />
                      <YAxis tick={AXIS_TICK} tickLine={false} unit="M" />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `Rp ${Number(v).toFixed(1)}M`} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                      <Bar dataKey="Kredit" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Debit" fill="#f87171" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </DataCard>

              {/* AN2 — Risk tier pie */}
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Distribusi Risk Tier</p>
                {tierData.every((d) => d.value === 0) ? (
                  <p className="text-sm text-slate-400 text-center py-8">Belum ada data perusahaan</p>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          innerRadius={50} outerRadius={75} paddingAngle={3}>
                          {tierData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [`${v} perusahaan`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3 flex-1">
                      {tierData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                            <span className="text-sm text-slate-600">{d.name} Risk</span>
                          </div>
                          <span className="text-sm font-bold text-slate-800">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DataCard>
            </div>

            {/* Portfolio cashflow area chart */}
            {topRiskCompanies.length > 0 && (
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Net Flow per Perusahaan</p>
                <p className="text-xs text-slate-400 mb-4">Kredit − Debit (dalam jutaan Rp)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={[...activeCompanies]
                      .sort((a, b) => {
                        const na = Number(a.total_credit) - Number(a.total_debit);
                        const nb = Number(b.total_credit) - Number(b.total_debit);
                        return nb - na;
                      })
                      .slice(0, 12)
                      .map((c) => ({
                        name: c.company.name.slice(0, 14),
                        net: (Number(c.total_credit) - Number(c.total_debit)) / 1e6,
                      }))}
                  >
                    <defs>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} unit="M" />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `Rp ${Number(v).toFixed(1)}M`} />
                    <Area type="monotone" dataKey="net" stroke="#14b8a6" fill="url(#netGrad)" strokeWidth={2} name="Net Flow" />
                  </AreaChart>
                </ResponsiveContainer>
              </DataCard>
            )}

            {/* AN3 — Top risk companies table */}
            <DataCard padding="flush">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Top Perusahaan by Risk Tier</p>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["#", "Perusahaan", "Risk Tier", "Dokumen", "Gagal", "Net Flow"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topRiskCompanies.map((c, i) => {
                    const tier = getRiskTier(c);
                    const netFlow = Number(c.total_credit) - Number(c.total_debit);
                    return (
                      <tr key={c.company.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.company.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ${tier === "High" ? "bg-red-100 text-red-700 ring-red-200"
                            : tier === "Medium" ? "bg-amber-100 text-amber-700 ring-amber-200"
                              : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                            }`}>{tier}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.document_count}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={c.failed_uploads > 0 ? "text-red-600 font-semibold" : "text-slate-400"}>{c.failed_uploads}</span>
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${netFlow >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {netFlow >= 0 ? "+" : "−"}{formatIDR(Math.abs(netFlow))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataCard>

            {/* PF + AN4 — Portfolio Risk & SLIK Aggregate */}
            <div className="grid gap-4 lg:grid-cols-2">
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Distribusi Portofolio — Risk Tier</p>
                <div className="space-y-3">
                  {tierData.map((d) => {
                    const total = tierData.reduce((s, t) => s + t.value, 0);
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (<div key={d.name}><div className="flex justify-between text-xs mb-1"><span className="font-semibold text-slate-600">{d.name} Risk</span><span className="text-slate-500">{d.value} perusahaan ({pct.toFixed(0)}%)</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.fill }} /></div></div>);
                  })}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "NPL Ratio", value: tierData.find((d) => d.name === "High")?.value ?? 0, total: tierData.reduce((s, t) => s + t.value, 0), color: "text-red-600" },
                      { label: "Watch List", value: tierData.find((d) => d.name === "Medium")?.value ?? 0, total: tierData.reduce((s, t) => s + t.value, 0), color: "text-amber-600" },
                      { label: "Healthy", value: tierData.find((d) => d.name === "Low")?.value ?? 0, total: tierData.reduce((s, t) => s + t.value, 0), color: "text-emerald-600" },
                    ].map(({ label, value, total, color }) => (<div key={label} className="rounded-lg bg-slate-50 p-2"><p className={`text-lg font-black ${color}`}>{value}</p><p className="text-[10px] text-slate-400">{label}</p><p className="text-[9px] text-slate-300">{total > 0 ? ((value / total) * 100).toFixed(0) : 0}%</p></div>))}
                  </div>
                </div>
              </DataCard>
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Status Parsing — Distribusi</p>
                {statusChart.length === 0 ? (<p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>) : (
                  <div className="space-y-2">
                    {statusChart.map((s) => {
                      const total = statusChart.reduce((sum, sc) => sum + sc.count, 0);
                      const pct = total > 0 ? (s.count / total) * 100 : 0;
                      const color = s.status === "done" ? "#10b981" : s.status === "failed" ? "#ef4444" : s.status === "needs_review" ? "#f59e0b" : s.status === "parsing" ? "#6366f1" : "#94a3b8";
                      return (<div key={s.status}><div className="flex justify-between text-xs mb-1"><span className="text-slate-500 capitalize">{s.status.replace("_", " ")}</span><span className="font-semibold text-slate-700">{s.count} ({pct.toFixed(0)}%)</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} /></div></div>);
                    })}
                  </div>
                )}
              </DataCard>
            </div>

            {/* PF4 + PF5 — Single Obligor Limit & Vintage Analysis */}
            {(obligorData || vintageData) && (
              <div className="grid gap-4 lg:grid-cols-2">
                {obligorData && (
                  <DataCard padding="flush">
                    <div className="px-5 py-3.5 border-b border-slate-100"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Single Obligor Limit (Top 10)</p></div>
                    <table className="w-full text-sm"><thead className="border-b border-slate-100 bg-slate-50"><tr>{["Perusahaan", "Outstanding", "Fasilitas", "% Modal", ""].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>)}</tr></thead>
                      <tbody>{obligorData.map((g) => (<tr key={g.name} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-xs font-medium text-slate-700">{g.name}</td><td className="px-4 py-3 text-xs font-semibold text-slate-800">{formatIDR(g.totalOutstanding)}</td><td className="px-4 py-3 text-xs text-slate-500">{g.count}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${g.pctModal > 25 ? "bg-red-500" : g.pctModal > 20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(g.pctModal, 100)}%` }} /></div><span className={`text-[10px] font-bold ${g.pctModal > 25 ? "text-red-600" : "text-slate-500"}`}>{g.pctModal.toFixed(1)}%</span></div></td><td className="px-4 py-3">{g.pctModal > 25 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">BMPK</span>}</td></tr>))}</tbody></table>
                  </DataCard>
                )}
                {vintageData && (
                  <DataCard>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Vintage Analysis — NPL by Cohort Year</p>
                    {vintageData.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Belum ada data pinjaman</p> : (
                      <div className="space-y-3">{vintageData.map((v) => (<div key={v.year}><div className="flex justify-between text-xs mb-1"><span className="font-semibold text-slate-600">Cohort {v.year}</span><span className="text-slate-500">{v.total} fasilitas · {formatIDR(v.outstanding)}</span></div><div className="flex items-center gap-2"><div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(v.nplRate, 100)}%` }} /></div><span className={`text-[10px] font-bold w-10 text-right ${v.nplRate > 20 ? "text-red-600" : v.nplRate > 5 ? "text-amber-600" : "text-emerald-600"}`}>{v.nplRate.toFixed(0)}%</span><span className="text-[10px] text-slate-400 w-12 text-right">{v.npl}/{v.total} NPL</span></div></div>))}</div>)}
                  </DataCard>
                )}
              </div>
            )}

            {/* Stress Testing */}
            {stressTestData && (
              <DataCard>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Stress Testing — Dampak ke NPL & CKPN</p>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-100 bg-slate-50"><tr>{["Scenario", "NPL Ratio", "NPL Amount", "Estimasi CKPN", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>)}</tr></thead>
                  <tbody>{stressTestData.map((sc) => (<tr key={sc.label} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-xs font-semibold text-slate-700">{sc.label}</td><td className={`px-4 py-3 text-xs font-bold ${sc.nplRatio > 10 ? "text-red-600" : sc.nplRatio > 5 ? "text-amber-600" : "text-emerald-600"}`}>{sc.nplRatio.toFixed(1)}%<div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={`h-full rounded-full ${sc.nplRatio > 10 ? "bg-red-400" : sc.nplRatio > 5 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(sc.nplRatio * 3, 100)}%` }} /></div></td><td className="px-4 py-3 text-xs font-semibold text-slate-700">{formatIDR(sc.newNpl)}</td><td className="px-4 py-3 text-xs font-semibold text-amber-700">{formatIDR(sc.estimatedCkpn)}</td><td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${sc.nplRatio > 10 ? "bg-red-50 text-red-700 ring-red-200" : sc.nplRatio > 5 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>{sc.nplRatio > 10 ? "Critical" : sc.nplRatio > 5 ? "Warning" : "Stable"}</span></td></tr>))}</tbody></table></div>
              </DataCard>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
