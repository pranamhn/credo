"use client";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit";
import { companiesApi, CompanySummary } from "@/lib/api";
import { formatIDR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowUpDown, Building2, Check, ChevronDown, Search, X } from "lucide-react";

const MAX_COMPARE = 3;

export default function ComparePage() {
  const [allCompanies, setAllCompanies] = useState<CompanySummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    companiesApi.list().then(({ data }) => setAllCompanies(data))
      .catch(() => toast.error("Gagal memuat perusahaan"));
  }, []);

  const toggleCompany = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
    setSearchOpen(false);
  };

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return allCompanies;
    const q = search.toLowerCase();
    return allCompanies.filter((c) => c.company.name.toLowerCase().includes(q));
  }, [allCompanies, search]);

  const columns = useMemo(() => {
    return selectedIds.map((id) => allCompanies.find((c) => c.company.id === id)).filter(Boolean) as CompanySummary[];
  }, [selectedIds, allCompanies]);

  const rows = useMemo(() => {
    return columns.map((c) => {
      const netFlow = Number(c.total_credit) - Number(c.total_debit);
      const failRate = c.document_count > 0 ? Math.round((c.failed_uploads / c.document_count) * 100) : 0;
      return {
        company: c.company,
        totalDocs: c.document_count,
        failedDocs: c.failed_uploads,
        failRate,
        totalTxns: c.total_transactions,
        netFlow,
        bankStmt: c.bank_statement_count,
        pnl: c.profit_loss_count,
        bs: c.balance_sheet_count,
        cf: c.cash_flow_count,
        slik: c.other_document_count,
        lastStatus: c.latest_status,
      };
    });
  }, [columns]);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Analisis"
          title="Bandingkan Perusahaan"
          description={`Pilih hingga ${MAX_COMPARE} perusahaan untuk perbandingan side-by-side`}
        />

        {/* Company selector */}
        <div className="relative">
          <button onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:border-violet-300 transition-colors w-full max-w-lg">
            <Search className="h-4 w-4 text-slate-400" />
            {selectedIds.length === 0
              ? "Cari dan pilih perusahaan..."
              : `${selectedIds.length} perusahaan terpilih`}
            <ChevronDown className={cn("h-4 w-4 ml-auto text-slate-400 transition-transform", searchOpen && "rotate-180")} />
          </button>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedIds.map((id) => {
                const comp = allCompanies.find((c) => c.company.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    <Building2 className="h-3 w-3" />
                    {comp?.company.name ?? id}
                    <button onClick={() => toggleCompany(id)} className="ml-0.5 hover:text-red-500"><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
            </div>
          )}

          {searchOpen && (
            <div className="absolute left-0 top-full z-40 mt-1 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto">
              {filteredCompanies.map((c) => {
                const sel = selectedIds.includes(c.company.id);
                return (
                  <button key={c.company.id} onClick={() => toggleCompany(c.company.id)}
                    className={cn("flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors",
                      sel && "bg-violet-50 text-violet-700")}>
                    <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="flex-1 truncate">{c.company.name}</span>
                    {sel && <Check className="h-4 w-4 text-violet-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Comparison table */}
        {selectedIds.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowUpDown className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Pilih perusahaan untuk mulai membandingkan</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-10 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-200 w-44">
                    Metrik
                  </th>
                  {rows.map((r) => (
                    <th key={r.company.id} className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-200 min-w-[170px]">
                      <p className="text-slate-800 text-xs font-bold normal-case tracking-normal truncate max-w-[150px] mx-auto">{r.company.name}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Status */}
                <tr className="bg-slate-50/50">
                  <td colSpan={rows.length + 1} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status Umum</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Total Dokumen</td>
                  {rows.map((r) => <td key={r.company.id} className="px-4 py-2.5 text-center text-slate-700 font-semibold">{r.totalDocs}</td>)}
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Gagal Parse</td>
                  {rows.map((r) => (
                    <td key={r.company.id} className="px-4 py-2.5 text-center">
                      <span className={r.failedDocs > 0 ? "text-red-600 font-semibold" : "text-slate-400"}>{r.failedDocs}</span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Success Rate</td>
                  {rows.map((r) => (
                    <td key={r.company.id} className="px-4 py-2.5 text-center">
                      <span className={cn("font-semibold", r.failRate > 30 ? "text-red-600" : r.failRate > 0 ? "text-amber-600" : "text-emerald-600")}>
                        {100 - r.failRate}%
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Total Transaksi</td>
                  {rows.map((r) => <td key={r.company.id} className="px-4 py-2.5 text-center text-slate-700">{r.totalTxns.toLocaleString("id-ID")}</td>)}
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Net Flow</td>
                  {rows.map((r) => (
                    <td key={r.company.id} className="px-4 py-2.5 text-center">
                      <span className={cn("font-semibold", r.netFlow >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {r.netFlow >= 0 ? "+" : "−"}{formatIDR(Math.abs(r.netFlow))}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 font-medium border-r border-slate-100">Status Terakhir</td>
                  {rows.map((r) => (
                    <td key={r.company.id} className="px-4 py-2.5 text-center">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                        r.lastStatus === "done" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : r.lastStatus === "failed" ? "bg-red-50 text-red-600 ring-red-200"
                            : "bg-slate-100 text-slate-500 ring-slate-200")}>
                        {r.lastStatus === "done" ? "Selesai" : r.lastStatus === "failed" ? "Gagal" : r.lastStatus ?? "—"}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Document coverage */}
                <tr className="bg-slate-50/50">
                  <td colSpan={rows.length + 1} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Kelengkapan Dokumen</td>
                </tr>
                {([
                  { label: "Bank Statement", key: "bankStmt" as const },
                  { label: "Profit & Loss", key: "pnl" as const },
                  { label: "Balance Sheet", key: "bs" as const },
                  { label: "Cash Flow", key: "cf" as const },
                  { label: "SLIK / IDEB", key: "slik" as const },
                ]).map(({ label, key }) => (
                  <tr key={key} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-slate-600 border-r border-slate-100">{label}</td>
                    {rows.map((r) => (
                      <td key={r.company.id} className="px-4 py-2.5 text-center">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          r[key] > 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-300 ring-1 ring-slate-200")}>
                          {r[key] > 0 ? `✓ ${r[key]}` : "✗"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
