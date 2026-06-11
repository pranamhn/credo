"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { DataCard } from "@/components/ui-kit/DataCard";
import { companiesApi, CompanySummary } from "@/lib/api";
import { localData, CreditMemo } from "@/lib/localData";
import { formatIDR } from "@/lib/utils";
import {
  FileText, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Search, SlidersHorizontal,
} from "lucide-react";

type MemoStatus = CreditMemo["status"];

const STATUS_META: Record<MemoStatus, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-slate-100 text-slate-600" },
  diajukan:  { label: "Diajukan",  color: "bg-blue-100 text-blue-700" },
  review:    { label: "Review",    color: "bg-amber-100 text-amber-700" },
  komite:    { label: "Komite",    color: "bg-purple-100 text-purple-700" },
  disetujui: { label: "Disetujui", color: "bg-emerald-100 text-emerald-700" },
  ditolak:   { label: "Ditolak",   color: "bg-red-100 text-red-700" },
};

const STATUS_FILTER_OPTS: Array<{ value: MemoStatus | "semua"; label: string }> = [
  { value: "semua",    label: "Semua Status" },
  { value: "draft",    label: "Draft" },
  { value: "diajukan", label: "Diajukan" },
  { value: "review",   label: "Review" },
  { value: "komite",   label: "Komite" },
  { value: "disetujui",label: "Disetujui" },
  { value: "ditolak",  label: "Ditolak" },
];

interface MemoRow {
  company: CompanySummary["company"];
  memo: CreditMemo;
}

function StatusBadge({ status }: { status: MemoStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.color}`}>
      {status === "disetujui"
        ? <CheckCircle2 className="h-3 w-3" />
        : status === "ditolak"
        ? <AlertTriangle className="h-3 w-3" />
        : <Clock className="h-3 w-3" />}
      {m.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? "bg-emerald-400" : score >= 3 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{score.toFixed(1)}</span>
    </div>
  );
}

export default function MemoPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemoStatus | "semua">("semua");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    companiesApi.list()
      .then(({ data }) => { setCompanies(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const memoRows = useMemo<MemoRow[]>(() => {
    return companies
      .map((cs) => ({ company: cs.company, memo: localData.getMemo(cs.company.id) }))
      .filter((r): r is MemoRow => r.memo !== null);
  }, [companies]);

  const filtered = useMemo(() => {
    return memoRows.filter((r) => {
      const matchStatus = statusFilter === "semua" || r.memo.status === statusFilter;
      const matchSearch = search === "" ||
        r.company.name.toLowerCase().includes(search.toLowerCase()) ||
        r.memo.analystName.toLowerCase().includes(search.toLowerCase()) ||
        r.memo.facilityType.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [memoRows, statusFilter, search]);

  const counts = useMemo(() => ({
    total:     memoRows.length,
    disetujui: memoRows.filter((r) => r.memo.status === "disetujui").length,
    ditolak:   memoRows.filter((r) => r.memo.status === "ditolak").length,
    pending:   memoRows.filter((r) => ["draft","diajukan","review","komite"].includes(r.memo.status)).length,
  }), [memoRows]);

  const avgScore = useMemo(() => {
    if (!memoRows.length) return 0;
    const sum = memoRows.reduce((acc, r) => {
      const m = r.memo;
      return acc + (m.characterScore + m.capacityScore + m.capitalScore + m.collateralScore + m.conditionScore) / 5;
    }, 0);
    return sum / memoRows.length;
  }, [memoRows]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Debitur"
          title="Credit Memo"
          description="Agregasi semua memorandum kredit — review, tracking status, dan rekomendasi komite"
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Memo", value: counts.total, sub: "Semua perusahaan", color: "text-violet-600", bg: "bg-violet-50" },
            { label: "Disetujui", value: counts.disetujui, sub: "Kredit disetujui", color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Ditolak",  value: counts.ditolak, sub: "Kredit ditolak", color: "text-red-600", bg: "bg-red-50" },
            { label: "Avg 5C Score", value: avgScore ? avgScore.toFixed(1) + " / 5" : "—", sub: `${counts.pending} memo pending`, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 relative overflow-hidden">
              <div className={`absolute inset-x-0 top-0 h-[3px] ${item.bg.replace("bg-", "bg-").replace("50", "400")}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <DataCard>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-4 w-4 text-violet-500 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-800">Daftar Credit Memo</h2>
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari perusahaan..."
                  className="h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-300 w-44"
                />
              </div>
              {/* Status Filter */}
              <div className="relative">
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {statusFilter === "semua" ? "Filter Status" : STATUS_META[statusFilter].label}
                </button>
                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                    <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden py-1">
                      {STATUS_FILTER_OPTS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setStatusFilter(opt.value); setFilterOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${statusFilter === opt.value ? "text-violet-700 font-semibold" : "text-gray-700"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table body */}
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {memoRows.length === 0
                  ? "Belum ada credit memo yang dibuat. Buat memo dari halaman detail perusahaan."
                  : "Tidak ada memo yang sesuai filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {["Perusahaan", "Fasilitas", "Plafon", "Analis", "5C Score", "Status", "Update"].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(({ company, memo }) => {
                    const avg5C = (memo.characterScore + memo.capacityScore + memo.capitalScore + memo.collateralScore + memo.conditionScore) / 5;
                    const updatedAt = memo.updatedAt
                      ? new Date(memo.updatedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                      : "—";
                    return (
                      <tr key={company.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 text-xs leading-snug max-w-[160px] truncate">{company.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{memo.loanPurpose || "—"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-block rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                            {memo.facilityType}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700 whitespace-nowrap">
                          {memo.loanAmount ? formatIDR(memo.loanAmount) : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">
                          {memo.analystName || "—"}
                          {memo.analystDate && (
                            <p className="text-[11px] text-gray-400">
                              {new Date(memo.analystDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <ScoreBar score={avg5C} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={memo.status} />
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-400 whitespace-nowrap">{updatedAt}</td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/companies/${company.id}/memo`}
                            className="flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors opacity-0 group-hover:opacity-100"
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
