"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { formatIDR } from "@/lib/utils";
import { localData, LoanFacility, CKPN_RATES } from "@/lib/localData";
import { Plus, Search, TrendingDown, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

const KOLK_META: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  1: { label: "Lancar",           color: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-200", dot: "bg-emerald-500" },
  2: { label: "Dalam Perhatian",  color: "text-amber-700",   bg: "bg-amber-50 ring-amber-200",     dot: "bg-amber-400"  },
  3: { label: "Kurang Lancar",    color: "text-orange-700",  bg: "bg-orange-50 ring-orange-200",   dot: "bg-orange-500" },
  4: { label: "Diragukan",        color: "text-red-700",     bg: "bg-red-50 ring-red-200",         dot: "bg-red-500"    },
  5: { label: "Macet",            color: "text-red-900",     bg: "bg-red-100 ring-red-300",        dot: "bg-red-700"    },
};

const FACILITY_FILTERS = ["Semua", "KMK", "KI", "KPR", "KUK", "Kredit Sindikasi", "Lainnya"];
const KOLK_FILTERS     = ["Semua", "1", "2", "3", "4", "5"];

export default function LoansPage() {
  const [loans, setLoans] = useState<LoanFacility[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Semua");
  const [filterKolk, setFilterKolk] = useState("Semua");

  useEffect(() => { setLoans(localData.getLoans()); }, []);

  const filtered = useMemo(() => loans.filter((l) => {
    const matchSearch = !search || l.companyName.toLowerCase().includes(search.toLowerCase()) || l.facilityName.toLowerCase().includes(search.toLowerCase());
    const matchType  = filterType === "Semua" || l.facilityType === filterType;
    const matchKolk  = filterKolk === "Semua" || String(l.kolektibilitas) === filterKolk;
    return matchSearch && matchType && matchKolk;
  }), [loans, search, filterType, filterKolk]);

  // Portfolio stats
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
  const totalPlafon      = loans.reduce((s, l) => s + l.plafon, 0);
  const nplLoans         = loans.filter((l) => l.kolektibilitas >= 3);
  const nplAmount        = nplLoans.reduce((s, l) => s + l.outstanding, 0);
  const nplRatio         = totalOutstanding > 0 ? (nplAmount / totalOutstanding) * 100 : 0;
  const totalCKPN        = loans.reduce((s, l) => s + l.outstanding * CKPN_RATES[l.kolektibilitas], 0);

  const addDemoLoan = () => {
    const demo: LoanFacility = {
      id: crypto.randomUUID(),
      companyId: "demo",
      companyName: "PT Demo Kredit",
      facilityName: "KMK-2024-001",
      facilityType: "KMK",
      plafon: 5_000_000_000,
      outstanding: 3_200_000_000,
      interestRate: 10.5,
      startDate: "2024-01-15",
      maturityDate: "2025-01-15",
      kolektibilitas: 1,
      lastPaymentDate: "2025-05-15",
      dpd: 0,
      covenants: [],
      installments: [],
    };
    const updated = [...loans, demo];
    setLoans(updated);
    localData.saveLoans(updated);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Monitoring</p>
            <h1 className="text-xl font-bold text-slate-900">Fasilitas Kredit</h1>
          </div>
          <button onClick={addDemoLoan}
            className="flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-600 transition-all">
            <Plus className="h-3.5 w-3.5" /> Demo Pinjaman
          </button>
        </div>

        {/* Portfolio KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Outstanding",   v: formatIDR(totalOutstanding),    icon: TrendingDown, color: "text-slate-700" },
            { label: "Total Plafon",        v: formatIDR(totalPlafon),         icon: CheckCircle2, color: "text-violet-700"  },
            { label: "NPL Ratio",           v: `${nplRatio.toFixed(2)}%`,      icon: AlertTriangle, color: nplRatio > 5 ? "text-red-600" : nplRatio > 2 ? "text-amber-600" : "text-emerald-700" },
            { label: "CKPN Provisi",        v: formatIDR(totalCKPN),           icon: XCircle,      color: "text-amber-700" },
          ].map(({ label, v, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <Icon className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <p className={`text-base font-bold ${color}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Kolektibilitas breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Distribusi Kolektibilitas</p>
          <div className="flex items-end gap-3 h-20">
            {[1, 2, 3, 4, 5].map((k) => {
              const amount = loans.filter((l) => l.kolektibilitas === k).reduce((s, l) => s + l.outstanding, 0);
              const pct = totalOutstanding > 0 ? (amount / totalOutstanding) * 100 : 0;
              const meta = KOLK_META[k];
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[9px] text-slate-400">{pct.toFixed(0)}%</p>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(pct * 0.6, pct > 0 ? 4 : 0)}px`, backgroundColor: k === 1 ? "#10b981" : k === 2 ? "#f59e0b" : k === 3 ? "#f97316" : k === 4 ? "#ef4444" : "#7f1d1d" }} />
                  <p className={`text-[9px] font-bold ${meta.color}`}>Kol {k}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari perusahaan atau fasilitas…"
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400">
            {FACILITY_FILTERS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select value={filterKolk} onChange={(e) => setFilterKolk(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400">
            {KOLK_FILTERS.map((f) => <option key={f}>{f === "Semua" ? "Semua Kol." : `Kol. ${f}`}</option>)}
          </select>
        </div>

        {/* Loans table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Perusahaan / Fasilitas","Jenis","Plafon","Outstanding","Suku Bunga","DPD","Kolektibilitas","CKPN","Jatuh Tempo",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Belum ada fasilitas kredit. Klik "Demo Pinjaman" untuk uji coba.</td></tr>
                ) : filtered.map((l) => {
                  const meta = KOLK_META[l.kolektibilitas];
                  const ckpn = l.outstanding * CKPN_RATES[l.kolektibilitas];
                  const daysToMaturity = Math.ceil((new Date(l.maturityDate).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700">{l.companyName}</p>
                        <p className="text-slate-400">{l.facilityName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.facilityType}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{formatIDR(l.plafon)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-700">{formatIDR(l.outstanding)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{l.interestRate}%</td>
                      <td className={`px-4 py-3 font-bold tabular-nums ${l.dpd > 90 ? "text-red-600" : l.dpd > 30 ? "text-amber-600" : l.dpd > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                        {l.dpd}h
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 ${meta.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          <span className={meta.color}>{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-amber-700">{formatIDR(ckpn)}</td>
                      <td className={`px-4 py-3 text-[11px] ${daysToMaturity < 30 ? "text-red-600 font-semibold" : daysToMaturity < 90 ? "text-amber-600" : "text-slate-500"}`}>
                        {l.maturityDate}
                        {daysToMaturity < 90 && <p className="text-[9px]">{daysToMaturity < 0 ? "Lewat jatuh tempo" : `${daysToMaturity}h lagi`}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/loans/${l.id}`} className="text-violet-600 hover:text-violet-700 font-semibold text-[11px] hover:underline">Detail →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
