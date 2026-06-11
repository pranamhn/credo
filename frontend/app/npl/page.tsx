"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { DataCard } from "@/components/ui-kit/DataCard";
import { localData, LoanFacility } from "@/lib/localData";
import { formatIDR } from "@/lib/utils";
import { TrendingDown, AlertTriangle, ChevronRight, Building2 } from "lucide-react";

const KOLK_META: Record<number, { label: string; desc: string; color: string; bg: string; bar: string }> = {
  1: { label: "Kolk 1", desc: "Lancar",     color: "text-emerald-700", bg: "bg-emerald-50",  bar: "bg-emerald-400" },
  2: { label: "Kolk 2", desc: "DPK",        color: "text-amber-700",   bg: "bg-amber-50",    bar: "bg-amber-400" },
  3: { label: "Kolk 3", desc: "Kurang Lancar", color: "text-orange-700", bg: "bg-orange-50", bar: "bg-orange-400" },
  4: { label: "Kolk 4", desc: "Diragukan",  color: "text-red-600",     bg: "bg-red-50",      bar: "bg-red-400" },
  5: { label: "Kolk 5", desc: "Macet",      color: "text-red-800",     bg: "bg-red-100",     bar: "bg-red-600" },
};

function KolkBadge({ k }: { k: number }) {
  const m = KOLK_META[k] ?? KOLK_META[1];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.bg} ${m.color}`}>
      {k >= 3 && <AlertTriangle className="h-3 w-3" />}
      {m.label} — {m.desc}
    </span>
  );
}

export default function NplPage() {
  const [loans, setLoans] = useState<LoanFacility[]>([]);

  useEffect(() => {
    setLoans(localData.getLoans());
  }, []);

  const stats = useMemo(() => {
    const npl = loans.filter((l) => l.kolektibilitas >= 3);
    const dpk = loans.filter((l) => l.kolektibilitas === 2);
    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
    const nplOutstanding = npl.reduce((s, l) => s + l.outstanding, 0);
    const nplRatio = totalOutstanding > 0 ? (nplOutstanding / totalOutstanding) * 100 : 0;
    const ckpnRequired = npl.reduce((s, l) => {
      const pct = l.kolektibilitas === 3 ? 0.15 : l.kolektibilitas === 4 ? 0.50 : 1.0;
      return s + l.outstanding * pct;
    }, 0);
    return { npl, dpk, totalOutstanding, nplOutstanding, nplRatio, ckpnRequired };
  }, [loans]);

  const kolkGroups = useMemo(() => {
    return [1, 2, 3, 4, 5].map((k) => {
      const items = loans.filter((l) => l.kolektibilitas === k);
      return {
        k,
        count: items.length,
        outstanding: items.reduce((s, l) => s + l.outstanding, 0),
      };
    });
  }, [loans]);

  const maxOutstanding = useMemo(
    () => Math.max(...kolkGroups.map((g) => g.outstanding), 1),
    [kolkGroups]
  );

  const nplTableRows = useMemo(() => {
    return loans
      .filter((l) => l.kolektibilitas >= 3)
      .sort((a, b) => b.kolektibilitas - a.kolektibilitas || b.outstanding - a.outstanding);
  }, [loans]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Monitoring"
          title="NPL Tracker"
          description="Monitoring Non-Performing Loan — distribusi kolektibilitas, rasio NPL, dan estimasi CKPN"
        />

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "NPL Ratio",
              value: `${stats.nplRatio.toFixed(2)}%`,
              sub: stats.nplRatio > 5 ? "Di atas threshold 5%" : "Dalam batas wajar",
              color: stats.nplRatio > 5 ? "text-red-600" : "text-emerald-600",
              accent: stats.nplRatio > 5 ? "bg-red-400" : "bg-emerald-400",
            },
            {
              label: "Total NPL",
              value: formatIDR(stats.nplOutstanding),
              sub: `${stats.npl.length} fasilitas (Kolk 3–5)`,
              color: "text-red-600",
              accent: "bg-red-400",
            },
            {
              label: "CKPN Required",
              value: formatIDR(stats.ckpnRequired),
              sub: "Est. cadangan kerugian",
              color: "text-orange-600",
              accent: "bg-orange-400",
            },
            {
              label: "DPK (Kolk 2)",
              value: stats.dpk.length.toString(),
              sub: "Debitur perhatian khusus",
              color: "text-amber-600",
              accent: "bg-amber-400",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 relative overflow-hidden">
              <div className={`absolute inset-x-0 top-0 h-[3px] ${item.accent}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Distribusi Kolektibilitas */}
        <DataCard>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-800">Distribusi Kolektibilitas</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {kolkGroups.map(({ k, count, outstanding }) => {
              const m = KOLK_META[k];
              const pct = maxOutstanding > 0 ? (outstanding / maxOutstanding) * 100 : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <span className={`text-xs font-semibold ${m.color}`}>{m.label}</span>
                    <span className="ml-1.5 text-[11px] text-gray-400">— {m.desc}</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${m.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-32 shrink-0 text-right">
                    <span className="text-xs text-gray-700 font-medium">{count} fasilitas</span>
                    {outstanding > 0 && (
                      <span className="ml-2 text-[11px] text-gray-400">— {formatIDR(outstanding)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {loans.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Belum ada data fasilitas kredit.</p>
            )}
          </div>
        </DataCard>

        {/* Tabel NPL Debitur */}
        <DataCard>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-800">Debitur NPL</h2>
            <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
              Kolk 3–5
            </span>
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              {nplTableRows.length}
            </span>
          </div>

          {nplTableRows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <TrendingDown className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Tidak ada debitur dengan NPL (Kolk 3–5).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {["Perusahaan", "Fasilitas", "Outstanding", "DPD", "Kolektibilitas", "CKPN Est."].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {nplTableRows.map((loan) => {
                    const ckpnPct = loan.kolektibilitas === 3 ? 0.15 : loan.kolektibilitas === 4 ? 0.50 : 1.0;
                    const ckpn = loan.outstanding * ckpnPct;
                    return (
                      <tr key={loan.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-900 max-w-[140px] truncate">{loan.companyName}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-gray-700">{loan.facilityName}</p>
                          <p className="text-[11px] text-gray-400">{loan.facilityType}</p>
                        </td>
                        <td className="px-5 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">
                          {formatIDR(loan.outstanding)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold ${loan.dpd > 90 ? "text-red-600" : loan.dpd > 30 ? "text-orange-600" : "text-amber-600"}`}>
                            {loan.dpd} hari
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <KolkBadge k={loan.kolektibilitas} />
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700 whitespace-nowrap">
                          {formatIDR(ckpn)}
                          <span className="ml-1 text-[11px] text-gray-400">({(ckpnPct * 100).toFixed(0)}%)</span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/loans/${loan.id}`}
                            className="flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </div>
    </AppShell>
  );
}
