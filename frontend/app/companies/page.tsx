"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DataCard, EmptyState, GlowButton, PageHeader, Pagination } from "@/components/ui-kit";
import { companiesApi, CompanySummary } from "@/lib/api";
import { formatDate, formatIDR } from "@/lib/utils";
import { Building2, Check, ChevronDown, Download, FileText, Filter, LayoutGrid, List, Plus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 9;

type RiskTier = "High" | "Medium" | "Low";

function getRiskTier(item: CompanySummary): RiskTier {
  const failRate = item.document_count > 0 ? item.failed_uploads / item.document_count : 0;
  const netFlow  = Number(item.total_credit) - Number(item.total_debit);
  if (item.failed_uploads > 1 || failRate > 0.4 || item.latest_status === "failed") return "High";
  if (item.failed_uploads > 0 || item.latest_status === "needs_review" || netFlow < 0) return "Medium";
  return "Low";
}

function formatCompactIDR(value: number) {
  const absolute = Math.abs(value);
  const formatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: absolute >= 1_000_000_000 ? 1 : 0,
  });

  if (absolute >= 1_000_000_000) return `Rp ${formatter.format(value / 1_000_000_000)} M`;
  if (absolute >= 1_000_000) return `Rp ${formatter.format(value / 1_000_000)} Jt`;
  return formatIDR(value);
}

function getNetFlowMeta(netFlow: number) {
  if (netFlow > 0) {
    return {
      label: "Surplus",
      prefix: "+",
      text: "text-emerald-700",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  }

  if (netFlow < 0) {
    return {
      label: "Defisit",
      prefix: "-",
      text: "text-red-700",
      badge: "bg-red-50 text-red-700 ring-red-200",
    };
  }

  return {
    label: "Netral",
    prefix: "",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
  };
}

const STATUS_LABELS: Record<string, string> = {
  done: "Selesai",
  needs_review: "Perlu Review",
  failed: "Gagal",
  parsing: "Parsing",
  queued: "Antrian",
};

const RISK_CARD_STYLE: Record<RiskTier, { border: string; icon: string; accent: string; soft: string; value: string }> = {
  High: {
    border: "border-l-red-500",
    icon: "bg-red-50 text-red-600",
    accent: "bg-red-500",
    soft: "bg-red-50 text-red-700 ring-red-200",
    value: "text-red-600",
  },
  Medium: {
    border: "border-l-amber-500",
    icon: "bg-amber-50 text-amber-600",
    accent: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 ring-amber-200",
    value: "text-amber-600",
  },
  Low: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-50 text-emerald-600",
    accent: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    value: "text-emerald-600",
  },
};

type FilterTier = "Semua" | RiskTier;
type ViewMode = "list" | "kanban";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [name, setName]     = useState("");
  const [notes, setNotes]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [riskFilter, setRiskFilter] = useState<FilterTier>("Semua");
  const [riskMenuOpen, setRiskMenuOpen] = useState(false);

  const load = () => {
    setLoading(true);
    companiesApi.list()
      .then(({ data }) => { setCompanies(data); setPage(1); })
      .catch(() => toast.error("Gagal memuat perusahaan"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const exportPortfolio = () => {
    const headers = ["Nama Perusahaan", "Risk Tier", "Total Kredit", "Total Debit", "Net Flow", "Dok Upload", "Gagal Parse", "Bank Statement", "P&L", "Cash Flow", "Neraca", "Status Terakhir"];
    const rows = companies.map((c) => {
      const netFlow = Number(c.total_credit) - Number(c.total_debit);
      const tier = getRiskTier(c);
      return [
        `"${c.company.name}"`, tier,
        Number(c.total_credit).toFixed(0), Number(c.total_debit).toFixed(0), netFlow.toFixed(0),
        c.document_count, c.failed_uploads,
        c.bank_statement_count, c.profit_loss_count, c.cash_flow_count, c.balance_sheet_count,
        c.latest_status ?? "—",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`${companies.length} perusahaan diexport`);
  };

  const create = async () => {
    if (!name.trim()) { toast.error("Nama perusahaan wajib diisi"); return; }
    setCreating(true);
    try {
      await companiesApi.create({ name, notes: notes || undefined });
      setName(""); setNotes(""); setShowForm(false);
      toast.success("Perusahaan dibuat");
      load();
    } catch { toast.error("Gagal membuat perusahaan"); }
    finally { setCreating(false); }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return companies.filter((company) => {
      const matchRisk = riskFilter === "Semua" || getRiskTier(company) === riskFilter;
      const matchSearch =
        !query ||
        company.company.name.toLowerCase().includes(query) ||
        String(company.latest_status ?? "").toLowerCase().includes(query);
      return matchRisk && matchSearch;
    });
  }, [companies, riskFilter, search]);

  const tierCounts = useMemo(() => ({
    High:   companies.filter((c) => getRiskTier(c) === "High").length,
    Medium: companies.filter((c) => getRiskTier(c) === "Medium").length,
    Low:    companies.filter((c) => getRiskTier(c) === "Low").length,
  }), [companies]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const FILTER_TABS: FilterTier[] = ["Semua", "High", "Medium", "Low"];
  const getTierCount = (tier: FilterTier) => tier === "Semua" ? companies.length : tierCounts[tier];
  const getTierClasses = (tier: FilterTier) => {
    if (tier === "High") return "bg-red-50 text-red-700 ring-red-200";
    if (tier === "Medium") return "bg-amber-50 text-amber-700 ring-amber-200";
    if (tier === "Low") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    return "bg-violet-50 text-violet-700 ring-blue-200";
  };
  const viewModeControl = (
    <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <button
        type="button"
        title="List View"
        aria-label="List View"
        aria-pressed={viewMode === "list"}
        onClick={() => setViewMode("list")}
        className={`rounded-md p-1 transition-colors ${
          viewMode === "list"
            ? "bg-white text-violet-700 shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Kanban View"
        aria-label="Kanban View"
        aria-pressed={viewMode === "kanban"}
        onClick={() => setViewMode("kanban")}
        className={`rounded-md p-1 transition-colors ${
          viewMode === "kanban"
            ? "bg-white text-violet-700 shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  const riskFilterDropdown = (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setRiskMenuOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={riskMenuOpen}
        onClick={() => setRiskMenuOpen((open) => !open)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none"
      >
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <span>Risk: {riskFilter}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${riskMenuOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        role="listbox"
        className={`absolute right-0 z-20 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 transition-all duration-200 ${
          riskMenuOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        {FILTER_TABS.map((tier) => {
          const active = riskFilter === tier;
          return (
            <button
              key={tier}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                setRiskFilter(tier);
                setPage(1);
                setRiskMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
                  tier === "High" ? "bg-red-500" : tier === "Medium" ? "bg-amber-500" : tier === "Low" ? "bg-emerald-500" : "bg-violet-500"
                }`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{tier}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {tier === "Semua" ? "Semua perusahaan" : `Perusahaan risk ${tier}`}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`min-w-7 rounded-md px-2 py-1 text-center text-[11px] font-bold leading-none ring-1 ${getTierClasses(tier)}`}>
                  {getTierCount(tier)}
                </span>
                <Check className={`h-4 w-4 text-violet-600 transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Portfolio"
          title="Daftar Perusahaan"
          description="Manajemen profil perusahaan dan monitoring risiko kredit"
          actions={
            <>
              <GlowButton variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportPortfolio}>
                Export CSV
              </GlowButton>
              <GlowButton
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowForm(true)}
              >
                Buat Perusahaan
              </GlowButton>
            </>
          }
        />

        {!loading && companies.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="relative flex-1 min-w-40 max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Cari perusahaan..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
            </label>
            {riskFilterDropdown}
            <div className="ml-auto">{viewModeControl}</div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Buat Perusahaan</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Tambahkan profil perusahaan untuk analisis dokumen.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup popup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                className="space-y-4 px-5 py-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  create();
                }}
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nama perusahaan
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: PT Duluin Digital Investama"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Catatan
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan opsional untuk analis"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <GlowButton type="submit" variant="primary" icon={<Plus className="h-4 w-4" />} loading={creating}>
                    Buat
                  </GlowButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Belum ada perusahaan"
            description='Klik tombol "Buat Perusahaan" untuk memulai.'
            action={
              <GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
                Buat Perusahaan
              </GlowButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={`Tidak ada perusahaan ${riskFilter} Risk`}
            description="Coba pilih filter lain."
          />
        ) : (
          <div className="space-y-4">
            {viewMode === "list" ? (
              <CompanyListTable items={paginated} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paginated.map((item, idx) => (
                  <CompanyCard key={item.company.id} item={item} idx={idx} />
                ))}
              </div>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CompanyListTable({ items }: { items: CompanySummary[] }) {
  return (
    <DataCard padding="flush">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              {["Perusahaan", "Dibuat", "Risk", "Dokumen", "Upload", "Kredit", "Debit", "Net Flow", "Status", ""].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const netFlow = Number(item.total_credit) - Number(item.total_debit);
              const netFlowMeta = getNetFlowMeta(netFlow);
              const tier = getRiskTier(item);
              const style = RISK_CARD_STYLE[tier];
              const latestStatus = item.latest_status ? (STATUS_LABELS[item.latest_status] ?? item.latest_status.replace("_", " ")) : "Belum ada";
              const uploadTotal = item.successful_uploads + item.failed_uploads;
              const successRate = uploadTotal > 0 ? Math.round((item.successful_uploads / uploadTotal) * 100) : 0;

              return (
                <tr key={item.company.id} className="group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
                  <td className="min-w-[260px] px-4 py-3">
                    <Link href={`/companies/${item.company.id}`} className="flex min-w-0 items-center gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 ${style.icon}`}>
                        <Building2 className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-violet-700">
                          {item.company.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {item.total_transactions.toLocaleString("id-ID")} transaksi
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-500">
                    {formatDate(item.company.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.soft}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.accent}`} />
                      {tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                    {item.document_count}
                  </td>
                  <td className="min-w-[150px] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{successRate}%</span>
                      <span className={item.failed_uploads > 0 ? "font-semibold text-red-600" : "text-slate-400"}>
                        {item.failed_uploads} gagal
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${successRate}%` }} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-emerald-700">
                    {formatCompactIDR(Number(item.total_credit))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-red-600">
                    {formatCompactIDR(Number(item.total_debit))}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-xs font-semibold ${netFlowMeta.text}`}>
                    {netFlowMeta.prefix && `${netFlowMeta.prefix} `}{formatCompactIDR(Math.abs(netFlow))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600 ring-1 ring-slate-200">
                      {latestStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/companies/${item.company.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition-all hover:border-violet-200 hover:text-violet-700"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function CompanyCard({ item, idx }: { item: CompanySummary; idx: number }) {
  const netFlow    = Number(item.total_credit) - Number(item.total_debit);
  const netFlowMeta = getNetFlowMeta(netFlow);
  const tier       = getRiskTier(item);
  const style      = RISK_CARD_STYLE[tier];
  const latestStatus = item.latest_status ? (STATUS_LABELS[item.latest_status] ?? item.latest_status.replace("_", " ")) : "Belum ada";
  const uploadTotal = item.successful_uploads + item.failed_uploads;
  const successRate = uploadTotal > 0 ? Math.round((item.successful_uploads / uploadTotal) * 100) : 0;
  const metricItems = [
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      label: "Transaksi",
      value: item.total_transactions.toLocaleString("id-ID"),
      title: item.total_transactions.toLocaleString("id-ID"),
      color: "text-slate-500",
    },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: "Kredit",
      value: formatCompactIDR(Number(item.total_credit)),
      title: formatIDR(Number(item.total_credit)),
      color: "text-emerald-600",
    },
    {
      icon: <TrendingDown className="h-3.5 w-3.5" />,
      label: "Debit",
      value: formatCompactIDR(Number(item.total_debit)),
      title: formatIDR(Number(item.total_debit)),
      color: "text-red-600",
    },
  ];

  return (
    <Link
      href={`/companies/${item.company.id}`}
      className={`fade-in-up group flex flex-col overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${style.border}`}
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 ${style.icon}`}>
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-violet-700">
              {item.company.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {item.document_count} dok · {formatDate(item.company.created_at)}
            </p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.soft}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.accent}`} />
          {tier}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 border-t border-slate-100">
        {metricItems.map(({ label, value, title, color }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] text-slate-400">{label}</p>
            <p className={`mt-0.5 truncate text-sm font-semibold ${color}`} title={title}>{value}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${successRate}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">
            {successRate}% berhasil
            {item.failed_uploads > 0 && <span className="ml-1.5 font-semibold text-red-500">· {item.failed_uploads} gagal</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold ${netFlowMeta.text}`}>
            {netFlowMeta.prefix}{formatCompactIDR(Math.abs(netFlow))}
          </p>
          <p className="text-[10px] text-slate-400">{netFlowMeta.label}</p>
        </div>
      </div>
    </Link>
  );
}
