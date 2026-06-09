"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard, GlowButton, DataCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { statementsApi, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { formatDate, formatIDR } from "@/lib/utils";
import {
  AlertTriangle, ArrowRight, Building2, CloudUpload,
  FileText, ShieldCheck, Timer, TrendingUp, X, AlertCircle, Lock,
} from "lucide-react";

const DOC_TYPE_LABEL: Record<string, string> = {
  bank_statement: "Bank Statement",
  profit_loss: "P&L",
  cash_flow: "Cash Flow",
  balance_sheet: "Neraca",
  other: "Lainnya",
};

export default function HomePage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const bankStatements = statements.filter((s) => s.document_type === "bank_statement");
  const failedList = statements.filter((s) => s.status === "failed");
  const needsReview = statements.filter((s) => s.status === "needs_review");
  const processing = statements.filter((s) => s.status === "queued" || s.status === "parsing");
  const done = statements.filter((s) => s.status === "done");
  const recent = [...statements].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const showAlert = !alertDismissed && (failedList.length > 0 || needsReview.length > 0);

  const totalCredit = companies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit = companies.reduce((a, c) => a + Number(c.total_debit), 0);

  // Today's uploads
  const today = new Date().toISOString().slice(0, 10);
  const todayUploads = statements.filter((s) => s.created_at.slice(0, 10) === today);

  return (
    <AppShell>
      <div className="space-y-6">

        {/* Alert banner — failed / needs_review */}
        {showAlert && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800">
                {failedList.length + needsReview.length} dokumen butuh perhatian
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {failedList.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                    <AlertCircle className="h-3 w-3" /> {failedList.length} gagal parse
                  </span>
                )}
                {needsReview.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    <AlertTriangle className="h-3 w-3" /> {needsReview.length} perlu review
                  </span>
                )}
                <Link href="/statements?status=needs_action" className="text-[11px] text-amber-700 underline underline-offset-2 font-medium hover:text-amber-900 ml-1">
                  Lihat sekarang →
                </Link>
              </div>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="p-0.5 rounded hover:bg-amber-200 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Daily briefing */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Briefing Hari Ini</p>
          {loading ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              <StatCard icon={<Building2 className="h-4 w-4" />} value={companies.length} label="Total Perusahaan" color="cyan" />
              <StatCard icon={<FileText className="h-4 w-4" />} value={bankStatements.length} label="Bank Statement" color="indigo" />
              <StatCard icon={<ShieldCheck className="h-4 w-4" />} value={done.length} label="Selesai" color="emerald" />
              <StatCard
                icon={<Timer className="h-4 w-4" />}
                value={failedList.length + needsReview.length}
                label="Butuh Perhatian"
                color={(failedList.length + needsReview.length) > 0 ? "red" : "amber"}
                trend={processing.length > 0 ? `${processing.length} diproses` : undefined}
              />
              <StatCard
                icon={<CloudUpload className="h-4 w-4" />}
                value={todayUploads.length}
                label="Upload Hari Ini"
                color={todayUploads.length > 0 ? "violet" : "default"}
              />
            </div>
          )}
        </div>

        {/* Portfolio snapshot + Quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <DataCard className="lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-4">Snapshot Portofolio</p>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Total Kredit Portofolio", value: formatIDR(totalCredit), color: "text-emerald-700", bar: "bg-emerald-400" },
                  { label: "Total Debit Portofolio", value: formatIDR(totalDebit), color: "text-red-600", bar: "bg-red-400" },
                  { label: "Net Flow Keseluruhan", value: formatIDR(totalCredit - totalDebit), color: totalCredit >= totalDebit ? "text-emerald-700" : "text-red-600", bar: totalCredit >= totalDebit ? "bg-emerald-400" : "bg-red-400" },
                ].map(({ label, value, color, bar }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-3 w-1 rounded-full shrink-0 ${bar}`} />
                      <span className="text-sm text-slate-500 truncate">{label}</span>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{companies.length} perusahaan · {bankStatements.length} bank statement · {statements.length} total dokumen</span>
                    <Link href="/analytics" className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium">
                      Analytics <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </DataCard>

          <DataCard>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-4">Quick Actions</p>
            <div className="space-y-2">
              <GlowButton variant="primary" icon={<CloudUpload className="h-4 w-4" />} href="/upload" className="w-full justify-center">
                Upload Dokumen
              </GlowButton>
              <GlowButton variant="secondary" icon={<Building2 className="h-4 w-4" />} href="/companies" className="w-full justify-center">
                Daftar Perusahaan
              </GlowButton>
              <GlowButton variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} href="/watchlist" className="w-full justify-center">
                Watch List
              </GlowButton>
              <GlowButton variant="secondary" icon={<Lock className="h-4 w-4" />} href="/idebt-parser" className="w-full justify-center">
                iDeb Parser
              </GlowButton>
              <GlowButton variant="ghost" icon={<TrendingUp className="h-4 w-4" />} href="/analytics" className="w-full justify-center">
                Analytics
              </GlowButton>
            </div>
          </DataCard>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Aktivitas Terakhir</p>
            <Link href="/statements" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Belum ada dokumen</p>
                <Link href="/upload" className="mt-2 inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
                  <CloudUpload className="h-4 w-4" /> Upload sekarang
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Dokumen / Bank", "Tipe", "Nasabah / Perusahaan", "Periode", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">
                          {s.bank_name || s.bank_code || (s.document_type === "bank_statement" ? "—" : DOC_TYPE_LABEL[s.document_type] || "—")}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{s.original_filename}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.document_type === "bank_statement" ? "bg-blue-50 text-blue-700 ring-blue-200" :
                            s.document_type === "profit_loss" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                              s.document_type === "balance_sheet" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" :
                                s.document_type === "cash_flow" ? "bg-amber-50 text-amber-700 ring-amber-200" :
                                  "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}>
                          {DOC_TYPE_LABEL[s.document_type] || s.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {s.account_holder || companies.find((c) => c.company.id === s.company_id)?.company.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {s.period_start ? `${formatDate(s.period_start)} – ${formatDate(s.period_end)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        {s.document_type === "bank_statement" && (s.status === "done" || s.status === "needs_review") ? (
                          <Link
                            href={`/statements/${s.id}`}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-opacity"
                          >
                            Analisis <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : s.document_type !== "bank_statement" ? (
                          <Link
                            href={`/companies/${s.company_id}`}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-opacity"
                          >
                            Company <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
        </div>

      </div>
    </AppShell>
  );
}
