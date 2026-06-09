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
  FileText, ShieldCheck, Timer, TrendingUp, X,
} from "lucide-react";

export default function HomePage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies]   = useState<CompanySummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    Promise.all([statementsApi.list(), companiesApi.list()])
      .then(([s, c]) => { setStatements(s.data); setCompanies(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const needsAction   = statements.filter((s) => s.status === "failed" || s.status === "needs_review");
  const processing    = statements.filter((s) => s.status === "queued"  || s.status === "parsing");
  const done          = statements.filter((s) => s.status === "done");
  const recent        = [...statements].slice(0, 5);
  const showAlert     = !alertDismissed && needsAction.length > 0;

  const totalCredit = companies.reduce((a, c) => a + Number(c.total_credit), 0);
  const totalDebit  = companies.reduce((a, c) => a + Number(c.total_debit),  0);

  return (
    <AppShell>
      <div className="space-y-6">

        {/* Alert banner — failed / needs_review */}
        {showAlert && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{needsAction.length} statement</span> membutuhkan perhatian —{" "}
              {needsAction.filter((s) => s.status === "failed").length} gagal parse,{" "}
              {needsAction.filter((s) => s.status === "needs_review").length} perlu review.{" "}
              <Link href="/statements?status=needs_action" className="underline underline-offset-2 font-medium hover:text-amber-900">
                Lihat sekarang →
              </Link>
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
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatCard icon={<Building2 className="h-4 w-4" />}    value={companies.length}    label="Total Perusahaan"  color="cyan" />
              <StatCard icon={<FileText className="h-4 w-4" />}     value={statements.length}   label="Total Dokumen"     color="indigo" />
              <StatCard icon={<ShieldCheck className="h-4 w-4" />}  value={done.length}         label="Selesai Dianalisis" color="emerald" />
              <StatCard
                icon={<Timer className="h-4 w-4" />}
                value={needsAction.length + processing.length}
                label="Butuh Perhatian"
                color={needsAction.length > 0 ? "red" : "amber"}
                trend={processing.length > 0 ? `${processing.length} sedang diproses` : undefined}
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
                {[0,1,2].map((i) => <Skeleton key={i} className="h-6 rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Total Kredit Portofolio",  value: formatIDR(totalCredit), color: "text-emerald-700", bar: "bg-emerald-400" },
                  { label: "Total Debit Portofolio",   value: formatIDR(totalDebit),  color: "text-red-600",     bar: "bg-red-400" },
                  { label: "Net Flow Keseluruhan",     value: formatIDR(totalCredit - totalDebit), color: totalCredit >= totalDebit ? "text-emerald-700" : "text-red-600", bar: totalCredit >= totalDebit ? "bg-emerald-400" : "bg-red-400" },
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
                    <span>{companies.length} perusahaan · {statements.length} dokumen</span>
                    <Link href="/analytics" className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                      Lihat Analytics <ArrowRight className="h-3 w-3" />
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
              <GlowButton variant="secondary" icon={<FileText className="h-4 w-4" />} href="/statements" className="w-full justify-center">
                Semua Statement
              </GlowButton>
              <GlowButton variant="secondary" icon={<TrendingUp className="h-4 w-4" />} href="/analytics" className="w-full justify-center">
                Analytics
              </GlowButton>
            </div>
          </DataCard>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Aktivitas Terakhir</p>
            <Link href="/statements" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DataCard padding="flush">
            {loading ? (
              <div className="p-4 space-y-2">
                {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                Belum ada dokumen. <Link href="/upload" className="text-blue-600 underline">Upload sekarang →</Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Dokumen / Bank", "Nasabah", "Periode", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">{s.bank_name || s.bank_code || "—"}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{s.original_filename}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{s.account_holder || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(s.period_start)} – {formatDate(s.period_end)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/statements/${s.id}`}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-opacity"
                        >
                          Detail <ArrowRight className="h-3 w-3" />
                        </Link>
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
