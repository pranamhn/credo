"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area,
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                chartPeriod === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
                  <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
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
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                    <Bar dataKey="credit" fill="#10b981" name="Kredit" radius={[2,2,0,0]} />
                    <Bar dataKey="debit"  fill="#ef4444" name="Debit"  radius={[2,2,0,0]} />
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
                    <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                    <Bar dataKey="balance" fill="#6366f1" name="Saldo Akhir" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
