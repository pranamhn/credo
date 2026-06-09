"use client";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, DataCard, StatCard } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { formatIDR } from "@/lib/utils";
import { BarChart2, Building2, TrendingUp } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
};
const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };
const GRID  = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

type RiskTier = "High" | "Medium" | "Low";
function getRiskTier(item: CompanySummary): RiskTier {
  const failRate = item.document_count > 0 ? item.failed_uploads / item.document_count : 0;
  const netFlow  = Number(item.total_credit) - Number(item.total_debit);
  if (item.failed_uploads > 1 || failRate > 0.4 || item.latest_status === "failed") return "High";
  if (item.failed_uploads > 0 || item.latest_status === "needs_review" || netFlow < 0) return "Medium";
  return "Low";
}

const TIER_COLORS: Record<RiskTier, string> = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#10b981",
};

export default function AnalyticsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies]   = useState<CompanySummary[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  // AN2 — Risk tier distribution
  const tierData = useMemo(() => {
    const counts: Record<RiskTier, number> = { High: 0, Medium: 0, Low: 0 };
    for (const c of companies) counts[getRiskTier(c)]++;
    return (["High", "Medium", "Low"] as RiskTier[]).map((tier) => ({ name: tier, value: counts[tier], fill: TIER_COLORS[tier] }));
  }, [companies]);

  // AN3 — Top companies sorted by risk (High first, then failed_uploads desc)
  const topRiskCompanies = useMemo(() => {
    const TIER_ORDER: Record<RiskTier, number> = { High: 0, Medium: 1, Low: 2 };
    return [...companies]
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
    for (const s of statements) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [statements]);

  // Summary stats
  const totalCredit = companies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit  = companies.reduce((a, c) => a + Number(c.total_debit),  0);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Insights"
          title="Analytics Portofolio"
          description="Cashflow agregat, distribusi risiko, dan peringkat perusahaan"
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
              <StatCard icon={<Building2 className="h-4 w-4" />}  value={companies.length}  label="Total Perusahaan" color="cyan" />
              <StatCard icon={<BarChart2 className="h-4 w-4" />}  value={statements.length} label="Total Statement"  color="indigo" />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} value={formatIDR(totalCredit)} label="Total Kredit"  color="emerald" />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} value={formatIDR(totalCredit - totalDebit)} label="Net Flow"  color={totalCredit >= totalDebit ? "emerald" : "red"} />
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
                    <Bar dataKey="count" name="Jumlah" radius={[4,4,0,0]}
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
                {companies.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[...companies]
                        .sort((a, b) => Number(b.total_credit) - Number(a.total_credit))
                        .slice(0, 8)
                        .map((c) => ({
                          name: c.company.name.slice(0, 12),
                          Kredit: Number(c.total_credit) / 1e6,
                          Debit:  Number(c.total_debit)  / 1e6,
                        }))}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} />
                      <YAxis tick={AXIS_TICK} tickLine={false} unit="M" />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `Rp ${Number(v).toFixed(1)}M`} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                      <Bar dataKey="Kredit" fill="#10b981" radius={[3,3,0,0]} />
                      <Bar dataKey="Debit"  fill="#f87171" radius={[3,3,0,0]} />
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
                    data={[...companies]
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
                        <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.3} />
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
                    const tier    = getRiskTier(c);
                    const netFlow = Number(c.total_credit) - Number(c.total_debit);
                    return (
                      <tr key={c.company.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.company.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ${
                            tier === "High"   ? "bg-red-100 text-red-700 ring-red-200"
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
          </>
        )}
      </div>
    </AppShell>
  );
}
