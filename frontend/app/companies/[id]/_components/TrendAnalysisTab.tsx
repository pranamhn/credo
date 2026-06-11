"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area, LineChart, Line, ComposedChart,
} from "recharts";
import { CHART_TOOLTIP_STYLE, AXIS_TICK, GRID_PROPS } from "../_lib/company-detail-constants";
import type { DailyData, MonthlyData } from "../_lib/company-detail-types";

interface Props {
  chartPeriod: 3 | 6 | 12;
  setChartPeriod: (p: 3 | 6 | 12) => void;
  txLoading: boolean;
  mounted: boolean;
  filteredDaily: DailyData[];
  filteredMonthly: MonthlyData[];
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  );
}

export function TrendAnalysisTab({
  chartPeriod, setChartPeriod, txLoading, mounted, filteredDaily, filteredMonthly,
}: Props) {
  return (
    <div className="p-6 space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Menampilkan data {chartPeriod === 12 ? "12 bulan" : `${chartPeriod} bulan terakhir`}</p>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([3, 6, 12] as const).map((p) => (
            <button key={p} onClick={() => setChartPeriod(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartPeriod === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              {p}B
            </button>
          ))}
        </div>
      </div>

      {txLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : filteredDaily.length === 0 ? (
        <div className="py-16 text-center">
          <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-500">Belum ada data analitik</p>
          <p className="text-xs text-slate-400 mt-1">Upload minimal satu Bank Statement untuk melihat visualisasi.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ChartCard title="Tren Saldo Konsolidasi">
            {mounted && (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={filteredDaily}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} tickFormatter={(d) => formatDate(d)} />
                  <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} labelFormatter={(l) => formatDate(String(l))} />
                  <Area type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#balGrad)" name="Saldo" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Mutasi Bulanan (Kredit vs Debit)">
              {mounted && (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={filteredMonthly}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                    <Bar dataKey="credit" fill="#10b981" name="Kredit" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="debit" fill="#ef4444" name="Debit" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Saldo Akhir Bulanan">
              {mounted && (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={filteredMonthly}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Bar dataKey="balance" fill="#6366f1" name="Saldo Akhir" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Cash Flow Projection */}
          {filteredMonthly.length >= 3 && (
            <CashFlowProjection monthly={filteredMonthly} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Cash Flow Projection ──────────────────────────────────────────────────

function CashFlowProjection({ monthly }: { monthly: MonthlyData[] }) {
  const projection = useMemo(() => {
    const historical = monthly.slice(-12); // last 12 months for regression
    const n = historical.length;

    // Linear regression on net cash flow
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    historical.forEach((m, i) => {
      const net = m.credit - m.debit;
      sumX += i;
      sumY += net;
      sumXY += i * net;
      sumX2 += i * i;
    });

    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;
    const avgNet = sumY / n;

    // Project 12 months forward
    const lastBalance = historical.at(-1)?.balance ?? 0;
    const lastMonth = historical.at(-1)?.month ?? "";
    const [y, m] = lastMonth.split("-").map(Number);

    const projected: { month: string; net: number; balance: number; isProjection: boolean }[] = [];
    let runningBalance = lastBalance;

    for (let i = 1; i <= 12; i++) {
      const projMonth = new Date(y, m - 1 + i);
      const monthStr = `${projMonth.getFullYear()}-${String(projMonth.getMonth() + 1).padStart(2, "0")}`;

      // Use regression with dampening for far-out months
      const dampen = Math.max(0.2, 1 - i * 0.06);
      const projNet = (slope * (n + i) + intercept) * dampen;
      runningBalance += projNet;

      projected.push({
        month: monthStr,
        net: Math.round(projNet),
        balance: Math.round(runningBalance),
        isProjection: true,
      });
    }

    // Combine historical + projection for chart
    const chartData = [
      ...historical.map((m) => ({ month: m.month, net: m.credit - m.debit, balance: m.balance, isProjection: false })),
      ...projected,
    ];

    const confidence = n >= 6 ? "Tinggi" : n >= 3 ? "Menengah" : "Rendah";
    const totalProjNet = projected.reduce((s, p) => s + p.net, 0);

    return { projected, chartData, avgNet, slope, totalProjNet, confidence };
  }, [monthly]);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const formatMonth = (m: string) => {
    const parts = m.split("-");
    return `${MONTHS[parseInt(parts[1]) - 1]} ${parts[0].slice(2)}`;
  };

  return (
    <ChartCard title={`Proyeksi Arus Kas 12 Bulan (Confidence: ${projection.confidence})`}>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Avg Net/Bulan</p>
          <p className={`text-sm font-bold mt-1 ${projection.avgNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {projection.avgNet >= 0 ? "+" : "−"}{formatIDR(Math.abs(projection.avgNet))}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Proyeksi Net 12 Bulan</p>
          <p className={`text-sm font-bold mt-1 ${projection.totalProjNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {projection.totalProjNet >= 0 ? "+" : "−"}{formatIDR(Math.abs(projection.totalProjNet))}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Proyeksi Saldo Akhir</p>
          <p className="text-sm font-bold mt-1 text-slate-800">
            {formatIDR(projection.projected.at(-1)?.balance ?? 0)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Bulan</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Proyeksi Net</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Proyeksi Saldo</th>
            </tr>
          </thead>
          <tbody>
            {projection.projected.map((p) => (
              <tr key={p.month} className="border-b border-slate-50 hover:bg-indigo-50/30">
                <td className="px-3 py-2 text-slate-600 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    {formatMonth(p.month)}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${p.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {p.net >= 0 ? "+" : "−"}{formatIDR(Math.abs(p.net))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatIDR(p.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
