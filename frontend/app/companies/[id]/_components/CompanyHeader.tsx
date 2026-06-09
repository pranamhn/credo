import { Building2, CalendarDays, BarChart3, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Rating } from "../_lib/company-detail-types";

interface Props {
  company: { name: string; created_at: string; notes?: string | null };
  totalTransactions: number;
  documentCount: number;
  rating: Rating;
  ratingMeta: { label: string; color: string };
}

export function CompanyHeader({ company, totalTransactions, documentCount, rating, ratingMeta }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Profil Perusahaan</p>
            <h1 className="mt-1 truncate text-xl font-bold leading-tight text-slate-950">{company.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                Dibuat {formatDate(company.created_at)}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{documentCount} dokumen</span>
            </div>
            {company.notes && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{company.notes}</p>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 lg:w-[320px]">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <BarChart3 className="h-3.5 w-3.5" />
              Transaksi
            </div>
            <p className="mt-1 text-lg font-bold leading-none text-slate-900">
              {totalTransactions.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="border-l border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Rating
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-lg font-black leading-none ${ratingMeta.color}`}>{rating}</span>
              <span className="truncate text-[11px] font-semibold text-slate-500">{ratingMeta.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
