"use client";

import { Printer, PencilLine, ShieldCheck, Plus, X, Download } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/utils";
import type { CompanySummary, SlikReport, CbiReport } from "@/lib/api";
import type { CompanyProfile, CreditMemo, ScoringAspect, DebtEntry, ApproverEntry } from "@/lib/localData";
import type { Rating, CreditScoreBreakdown, MonthlyData } from "../_lib/company-detail-types";
import { RATING_META, MONTHS_ID } from "../_lib/company-detail-constants";
import { growthBadge } from "../_lib/company-detail-helpers";

type PnlComparison = {
  priorLabel: string | null;
  latestLabel: string;
  latestMo: number;
  rows: {
    key: string; label: string; isBold: boolean;
    latestTotal: number | null; priorTotal: number | null;
    annualizedTotal: number | null; estGrowthPct: number | null;
  }[];
} | null;

type BsComparison = {
  priorLabel: string | null;
  latestLabel: string;
  elapsedMonths: number | null;
  remainingMonths: number | null;
  rows: {
    key: string; label: string; isBold: boolean;
    latestValue: number | null; priorValue: number | null;
    growthPct: number | null; projectedValue: number | null; projectedGrowthPct: number | null;
  }[];
} | null;

type DerivedRatios = {
  grossMargin: number | null; ebitdaMargin: number | null;
  netMargin: number | null; der: number | null; dar: number | null;
  roe: number | null; roa: number | null; isAnnualized: boolean;
} | null;

type SlikDerived = {
  worstKol: number; totalBaki: number; jmlKreditur: number; jmlFasilitas: number;
  monthlyIncome: number; estCicilanPerBulan: number; dsr: number | null; kolLabel: string;
} | null;

interface Props {
  summary: CompanySummary;
  company: { name: string };
  profile: CompanyProfile;
  memo: Pick<CreditMemo, "loanAmount" | "tenor">;
  rating: Rating;
  ratingMeta: { label: string; color: string; desc: string; bg: string; ring: string };
  creditScore: CreditScoreBreakdown;
  ewsTier: string;
  netFlow: number;
  entityType: string;
  lamaBerdiri: string;
  slikDerived: SlikDerived;
  slikReports: SlikReport[];
  cbiReports: CbiReport[];
  pnlComparison: PnlComparison;
  bsComparison: BsComparison;
  derivedRatios: DerivedRatios;
  monthlyData: MonthlyData[];
  notes: string;
  saveNotes: (val: string) => void;
  printSummary: () => void;
  debtEntries: DebtEntry[];
  scoringAspects: ScoringAspect[];
  dscrCicilanBaru: number;
  updateDscrCicilanBaru: (val: number) => void;
  addDebtEntry: () => void;
  updateDebtEntry: (id: string, field: keyof DebtEntry, value: string | number) => void;
  removeDebtEntry: (id: string) => void;
  importDebtEntries: () => void;
  importProfile: () => void;
  approvers: ApproverEntry[];
  updateScoringAspect: (idx: number, field: "skor" | "catatan", value: string | number) => void;
}

export function CreditSummaryTab({
  summary, company, profile, memo,
  rating, ratingMeta, creditScore, ewsTier,
  netFlow, entityType, lamaBerdiri,
  slikDerived, slikReports, cbiReports,
  pnlComparison, bsComparison, derivedRatios,
  monthlyData, notes, saveNotes, printSummary,
  debtEntries, scoringAspects, dscrCicilanBaru,
  updateDscrCicilanBaru, addDebtEntry, updateDebtEntry, removeDebtEntry, importDebtEntries,
  importProfile, approvers,
  updateScoringAspect,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={printSummary}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-violet-300 hover:text-violet-700"
        >
          <Printer className="h-3.5 w-3.5" />
          Print Cremo
        </button>
      </div>

      {/* I. Identitas Debitur */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">I. Identitas Debitur</p>
          <button
            onClick={importProfile}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Download className="h-3 w-3" /> Import dari Dokumen
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: "Nama Perusahaan", val: company.name, right: entityType ? <em className="text-slate-500">{entityType}</em> : null },
                { label: "Alamat", val: profile.alamat, right: null, colSpan: true },
                { label: "Tanggal Berdiri", val: profile.tanggalBerdiri, right: lamaBerdiri ? <em className="text-slate-500">Lama berdiri: {lamaBerdiri}</em> : null },
                { label: "Jenis Usaha", val: profile.jenisUsaha, right: <em className="text-slate-500">KBLI: {profile.kbli || "—"}</em> },
                { label: "Total Karyawan", val: profile.totalKaryawan, right: null },
                { label: "Direktur / PIC", val: profile.direktur, right: profile.teleponDirektur ? <span className="text-slate-500">Telp: {profile.teleponDirektur}</span> : null },
                { label: "NPWP Perusahaan", val: profile.npwp, right: <em className="text-slate-500">Status Wajib Pajak: {profile.statusWajibPajak || "Aktif"}</em> },
                { label: "NIB / SIUP", val: profile.nibSiup, right: <em className="text-slate-500">Masa berlaku: {profile.masaBerlakuNib || "—"}</em> },
                ...(memo.loanAmount ? [{ label: "Plafon EWA Diajukan", val: <strong>{formatIDR(memo.loanAmount)}</strong>, right: <em className="text-slate-500">Tenor: {memo.tenor} bulan</em> }] : []),
              ].map(({ label, val, right, colSpan }, i) => (
                <tr key={label} className={`border-b border-slate-50 last:border-b-0 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap w-[170px]">{label}</td>
                  <td className="px-1 py-2.5 text-slate-400 w-4">:</td>
                  <td className={`px-4 py-2.5 text-slate-800 font-medium ${colSpan ? "pr-4" : ""}`} colSpan={colSpan ? 2 : 1}>
                    {val || <span className="text-slate-300">—</span>}
                  </td>
                  {!colSpan && (
                    <td className="px-4 py-2.5 text-right text-[11px] whitespace-nowrap">
                      {right ?? ""}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ringkasan Eksekutif */}
      {profile.ringkasanEksekutif && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-2">Ringkasan Eksekutif</p>
          <p className="text-justify text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{profile.ringkasanEksekutif}</p>
        </div>
      )}

      {/* Rating card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          {/* Left — letter + label */}
          <div className="flex items-center gap-4 min-w-0">
            <span className={`text-5xl font-black leading-none shrink-0 ${ratingMeta.color}`}>{rating}</span>
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-tight ${ratingMeta.color}`}>{ratingMeta.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{ratingMeta.desc}</p>
            </div>
          </div>

          {/* Right — EWS + score */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${ewsTier === "hijau" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : ewsTier === "kuning" ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-red-50 text-red-700 ring-red-200"
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ewsTier === "hijau" ? "bg-emerald-500" : ewsTier === "kuning" ? "bg-amber-500" : "bg-red-500"}`} />
              EWS {ewsTier.toUpperCase()}
            </div>
            <p className={`text-2xl font-black tabular-nums leading-none ${ratingMeta.color}`}>
              {creditScore.total}<span className="text-xs font-semibold text-slate-400"> / 100</span>
            </p>
          </div>
        </div>

        {/* Scale bar */}
        <div className="mt-4 flex items-center gap-1">
          {(["AAA", "AA", "A", "B", "C", "D", "E"] as Rating[]).map((r) => (
            <div key={r} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full ${r === rating ? RATING_META[r].ring.replace("ring-1 ring-", "bg-").replace("ring-", "bg-") : "bg-slate-100"}`} />
              <span className={`text-[9px] font-bold ${r === rating ? ratingMeta.color : "text-slate-300"}`}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Breakdown per Dimensi */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Credit Score Breakdown</p>
          <span className={`text-base font-black ${ratingMeta.color}`}>{creditScore.total} / 100</span>
        </div>
        <div className="p-4 space-y-3">
          {([
            { label: "Keuangan", score: creditScore.keuangan, max: 40, isDefault: false },
            { label: "Cashflow Bank Statement", score: creditScore.cashflow, max: 25, isDefault: false },
            { label: "Kolektibilitas SLIK", score: creditScore.slik, max: 20, isDefault: creditScore.slikDefault },
            { label: "Agunan / Collateral", score: creditScore.agunan, max: 10, isDefault: creditScore.agunanDefault },
            { label: "Karakter / Kualitatif", score: creditScore.karakter, max: 5, isDefault: false },
          ] as { label: string; score: number; max: number; isDefault: boolean }[]).map(({ label, score, max, isDefault }) => {
            const pct = Math.round((score / max) * 100);
            const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-violet-600" : pct >= 25 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{label}</span>
                  <span className="text-xs font-bold tabular-nums text-slate-700">
                    {score}/{max}
                    {isDefault && <span className="ml-1 text-[10px] font-normal text-slate-400">(estimasi)</span>}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk factors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upload Berhasil", value: `${summary.successful_uploads}/${summary.document_count}`, ok: summary.failed_uploads === 0 },
          { label: "Upload Gagal", value: summary.failed_uploads.toString(), ok: summary.failed_uploads === 0 },
          { label: "Net Flow", value: (netFlow >= 0 ? "+" : "−") + formatIDR(Math.abs(netFlow)), ok: netFlow >= 0 },
          { label: "Jumlah Transaksi", value: summary.total_transactions.toLocaleString("id-ID"), ok: true },
        ].map(({ label, value, ok }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
            <p className={`text-sm font-bold mt-1 ${ok ? "text-emerald-700" : "text-red-600"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Coverage check */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Kelengkapan Dokumen</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            ["Bank Statement", summary.bank_statement_count > 0],
            ["Profit & Loss", summary.profit_loss_count > 0],
            ["Cash Flow", summary.cash_flow_count > 0],
            ["Balance Sheet", summary.balance_sheet_count > 0],
            ["SLIK / IDEB", slikReports.length > 0],
          ].map(([label, has]) => (
            <div key={String(label)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ring-1 ${has ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"}`}>
              <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${has ? "text-emerald-500" : "text-slate-300"}`} />
              {String(label)}
            </div>
          ))}
        </div>
      </div>

      {/* V. Insight iDeb / SLIK */}
      {slikDerived && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">V. Insight iDeb / SLIK</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ${slikDerived.worstKol === 1 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : slikDerived.worstKol === 2 ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-red-50 text-red-700 ring-red-200"
              }`}>Kol {slikDerived.worstKol} — {slikDerived.kolLabel}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Kreditur", value: String(slikDerived.jmlKreditur) },
                { label: "Fasilitas", value: String(slikDerived.jmlFasilitas) },
                { label: "Total Baki Debet", value: formatIDR(slikDerived.totalBaki) },
                {
                  label: "DSR", value: slikDerived.dsr !== null
                    ? `${(slikDerived.dsr * 100).toFixed(1)}%`
                    : "—",
                  accent: slikDerived.dsr !== null
                    ? (slikDerived.dsr <= 0.35 ? "text-emerald-700" : slikDerived.dsr <= 0.5 ? "text-amber-700" : "text-red-600")
                    : "text-slate-400",
                  sub: slikDerived.dsr !== null
                    ? (slikDerived.dsr <= 0.35 ? "Aman" : slikDerived.dsr <= 0.5 ? "Perhatian" : "Tinggi")
                    : undefined,
                },
              ].map(({ label, value, accent, sub }) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className={`text-sm font-bold mt-0.5 tabular-nums ${accent ?? "text-slate-800"}`}>{value}</p>
                  {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Per-laporan table */}
            {(slikReports.length + cbiReports.length > 1 || (slikReports.length > 0 && cbiReports.length > 0)) && (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tipe</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Laporan</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kreditur</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fasilitas</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Baki Debet</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slikReports.map((r) => {
                      const fas = r.parsed_data?.fasilitas ?? [];
                      const wk = fas.reduce((w, f) => {
                        const k = parseInt(f.kualitas.replace(/\D/g, ""), 10);
                        return isNaN(k) ? w : Math.max(w, k);
                      }, 1);
                      const baki = fas.reduce((s, f) => s + (f.baki_debet ?? 0), 0);
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-2">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700">SLIK</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-[130px] truncate" title={r.original_filename}>{r.original_filename}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.tanggal_laporan ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.jumlah_kreditur ?? fas.length}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.jumlah_fasilitas ?? fas.length}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatIDR(baki)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${wk === 1 ? "bg-emerald-50 text-emerald-700"
                              : wk === 2 ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                              }`}>{wk}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {cbiReports.map((r) => {
                      const fas = r.parsed_data?.fasilitas_aktif ?? [];
                      const wk = fas.reduce((w, f) => {
                        const k = parseInt(f.kolektabilitas.replace(/\D/g, ""), 10);
                        return isNaN(k) ? w : Math.max(w, k);
                      }, 1);
                      const baki = r.parsed_data?.total_baki_debet_aktif
                        ?? fas.reduce((s, f) => s + (f.baki_debet ?? 0), 0);
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-2">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700">CBI</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-[130px] truncate" title={r.original_filename}>{r.original_filename}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.tanggal_laporan ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.jumlah_kreditur_aktif ?? fas.length}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.jumlah_fasilitas_aktif ?? fas.length}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatIDR(baki)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${wk === 1 ? "bg-emerald-50 text-emerald-700"
                              : wk === 2 ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                              }`}>{wk}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cashflow vs cicilan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. Pendapatan/Bln</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">{formatIDR(slikDerived.monthlyIncome)}</p>
                <p className="text-[10px] text-slate-400">dari bank statement</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. Cicilan Existing/Bln</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">{formatIDR(slikDerived.estCicilanPerBulan)}</p>
                <p className="text-[10px] text-slate-400">baki debet ÷ 36 bln</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* III-A: Laporan Laba Rugi */}
      {pnlComparison ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">III-A. Laporan Laba Rugi</p>
            <span className="text-[10px] text-slate-400">Year-over-Year Comparison</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[35%]">Pos</th>
                  {pnlComparison.priorLabel && <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{pnlComparison.priorLabel}</th>}
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{pnlComparison.latestLabel}</th>
                  {pnlComparison.latestMo < 12 && <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap">Annualized</th>}
                  {pnlComparison.priorLabel && <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. Growth</th>}
                </tr>
              </thead>
              <tbody>
                {pnlComparison.rows.map((row) => (
                  <tr key={row.key} className={`border-b border-slate-50 last:border-b-0 ${row.isBold ? "bg-slate-50/60" : ""}`}>
                    <td className={`px-4 py-2.5 ${row.isBold ? "font-bold text-slate-800" : "text-slate-600"}`}>{row.label}</td>
                    {pnlComparison.priorLabel && (
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold" : ""} ${Number(row.priorTotal ?? 0) < 0 ? "text-red-600" : "text-slate-700"}`}>
                        {formatIDR(row.priorTotal)}
                      </td>
                    )}
                    <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold" : ""} ${Number(row.latestTotal ?? 0) < 0 ? "text-red-600" : (row.isBold ? "text-slate-900" : "text-slate-700")}`}>
                      {formatIDR(row.latestTotal)}
                    </td>
                    {pnlComparison.latestMo < 12 && (
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold" : ""} ${Number(row.annualizedTotal ?? 0) < 0 ? "text-red-600" : "text-indigo-700"}`}>
                        {formatIDR(row.annualizedTotal)}
                      </td>
                    )}
                    {pnlComparison.priorLabel && (
                      <td className="px-4 py-2.5 text-right">{growthBadge(row.estGrowthPct)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pnlComparison.latestMo < 12 && (
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[10px] text-slate-400">
                <span className="text-indigo-500 font-medium">Annualized</span> = Y0 YTD ({pnlComparison.latestMo} bln) ÷ {pnlComparison.latestMo} × 12 &nbsp;·&nbsp;
                <span className="font-medium">Est. Growth</span> = (Annualized − Y-1) / |Y-1| × 100
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-4 text-center">
          <p className="text-xs text-slate-400">Upload dokumen Profit &amp; Loss untuk melihat Laporan Laba Rugi</p>
        </div>
      )}

      {/* III-B: Neraca */}
      {bsComparison ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">III-B. Neraca (Balance Sheet)</p>
            <span className="text-[10px] text-slate-400">Year-over-Year Comparison</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[35%]">Pos</th>
                  {bsComparison.priorLabel && <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{bsComparison.priorLabel}</th>}
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{bsComparison.latestLabel}</th>
                  {bsComparison.remainingMonths !== null && bsComparison.remainingMonths > 0 && (
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap">
                      Proj. Dec {bsComparison.latestLabel.match(/\d{4}/)?.[0]}
                    </th>
                  )}
                  {bsComparison.priorLabel && (
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Growth <span className="text-slate-300 font-normal">({bsComparison.elapsedMonths} bln)</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {bsComparison.rows.map((row) => (
                  <tr key={row.key} className={`border-b border-slate-50 last:border-b-0 ${row.isBold ? "bg-slate-50/60" : ""}`}>
                    <td className={`px-4 py-2.5 ${row.isBold ? "font-bold text-slate-800" : "text-slate-600"}`}>{row.label}</td>
                    {bsComparison.priorLabel && (
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold" : ""} text-slate-700`}>
                        {formatIDR(row.priorValue)}
                      </td>
                    )}
                    <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold text-slate-900" : "text-slate-700"}`}>
                      {formatIDR(row.latestValue)}
                    </td>
                    {bsComparison.remainingMonths !== null && bsComparison.remainingMonths > 0 && (
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.isBold ? "font-bold" : ""} ${Number(row.projectedValue ?? 0) < 0 ? "text-red-600" : "text-indigo-700"}`}>
                        {formatIDR(row.projectedValue)}
                      </td>
                    )}
                    {bsComparison.priorLabel && (
                      <td className="px-4 py-2.5 text-right">{growthBadge(row.growthPct)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bsComparison.elapsedMonths !== null && bsComparison.remainingMonths !== null && bsComparison.remainingMonths > 0 && (
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[10px] text-slate-400">
                <span className="text-indigo-500 font-medium">Proj. Dec</span> = Y0 + (delta/{bsComparison.elapsedMonths} bln × {bsComparison.remainingMonths} sisa bln)
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-4 text-center">
          <p className="text-xs text-slate-400">Upload dokumen Balance Sheet untuk melihat Neraca</p>
        </div>
      )}

      {/* III-C: Arus Kas Rekening Koran */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <p className="text-xs font-bold text-slate-700">III-C. Arus Kas Rekening Koran</p>
        </div>
        {monthlyData.length === 0 ? (
          <div className="px-5 py-4 text-center">
            <p className="text-xs text-slate-400">Upload Bank Statement untuk melihat arus kas bulanan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  {["Bulan", "Total Masuk (Kredit)", "Total Keluar (Debet)", "Net Cash Flow", "Saldo Akhir"].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap ${h === "Bulan" ? "text-left w-[35%]" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m) => {
                  const net = m.credit - m.debit;
                  return (
                    <tr key={m.month} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                        {MONTHS_ID[parseInt(m.month.slice(5, 7)) - 1]} {m.month.slice(0, 4)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatIDR(m.credit)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{formatIDR(m.debit)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{net >= 0 ? "+" : "−"}{formatIDR(Math.abs(net))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatIDR(m.balance)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-bold">
                  <td className="px-4 py-2.5 text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatIDR(monthlyData.reduce((s, m) => s + m.credit, 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{formatIDR(monthlyData.reduce((s, m) => s + m.debit, 0))}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${(monthlyData.reduce((s, m) => s + m.credit - m.debit, 0)) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {(() => { const n = monthlyData.reduce((s, m) => s + m.credit - m.debit, 0); return (n >= 0 ? "+" : "−") + formatIDR(Math.abs(n)); })()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatIDR(monthlyData.at(-1)?.balance ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IV. Analisa Rasio Keuangan */}
      {derivedRatios && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">IV. Analisa Rasio Keuangan</p>
            {derivedRatios.isAnnualized && (
              <span className="text-[10px] text-indigo-500 font-medium">* ROE/ROA menggunakan net income annualized</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rasio</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-28">Nilai</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50/80">
                  <td colSpan={3} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Profitabilitas</td>
                </tr>
                {[
                  { label: "Gross Profit Margin (GPM)", value: derivedRatios.grossMargin, fmt: "pct", thresholds: [30, 15] },
                  { label: "Net Profit Margin (NPM)", value: derivedRatios.netMargin, fmt: "pct", thresholds: [10, 5] },
                  { label: `Return on Assets (ROA)${derivedRatios.isAnnualized ? "*" : ""}`, value: derivedRatios.roa, fmt: "pct", thresholds: [5, 2] },
                  { label: `Return on Equity (ROE)${derivedRatios.isAnnualized ? "*" : ""}`, value: derivedRatios.roe, fmt: "pct", thresholds: [15, 8] },
                  { label: "EBITDA Margin", value: derivedRatios.ebitdaMargin, fmt: "pct", thresholds: [20, 10] },
                ].map(({ label, value, fmt, thresholds }) => {
                  const display = value === null ? "—" : fmt === "ratio" ? `${value.toFixed(2)}x` : `${value.toFixed(2)}%`;
                  const tier = value === null ? null : value >= thresholds[0] ? "ok" : value >= thresholds[1] ? "warn" : "bad";
                  return (
                    <tr key={label} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 text-slate-700">{label}</td>
                      <td className="px-4 py-2.5 text-left tabular-nums font-semibold text-slate-800">{display}</td>
                      <td className="px-4 py-2.5 text-center">
                        {tier === "ok" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">BAIK</span>}
                        {tier === "warn" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">CUKUP</span>}
                        {tier === "bad" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 ring-1 ring-red-200">RENDAH</span>}
                        {tier === null && <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50/80">
                  <td colSpan={3} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Leverage &amp; Solvabilitas</td>
                </tr>
                {[
                  { label: "Debt-to-Equity Ratio (DER)", value: derivedRatios.der, fmt: "ratio", inverted: true, goodBelow: 2 },
                  { label: "Debt-to-Asset Ratio (DAR)", value: derivedRatios.dar, fmt: "pct", inverted: true, goodBelow: 50 },
                ].map(({ label, value, fmt, inverted, goodBelow }) => {
                  const display = value === null ? "—" : fmt === "ratio" ? `${value.toFixed(2)}x` : `${value.toFixed(2)}%`;
                  const tier = value === null ? null
                    : inverted
                      ? value < goodBelow ? "ok" : value < goodBelow * 1.5 ? "warn" : "bad"
                      : "ok";
                  return (
                    <tr key={label} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 text-slate-700">{label}</td>
                      <td className="px-4 py-2.5 text-left tabular-nums font-semibold text-slate-800">{display}</td>
                      <td className="px-4 py-2.5 text-center">
                        {tier === "ok" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">BAIK</span>}
                        {tier === "warn" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">CUKUP</span>}
                        {tier === "bad" && <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 ring-1 ring-red-200">RENDAH</span>}
                        {tier === null && <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VII. DSCR */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <p className="text-xs font-bold text-slate-700">VII. Debt Service Coverage Ratio (DSCR)</p>
        </div>
        {(() => {
          const opRow = pnlComparison?.rows.find((r) => r.key === "operating_profit");
          const ebitda = opRow?.annualizedTotal ?? opRow?.latestTotal ?? null;
          const latestMo = pnlComparison?.latestMo ?? 12;
          const entriesMonthly = debtEntries.reduce((s, e) => s + e.cicilanPerBulan, 0);
          const existingMonthly = entriesMonthly > 0 ? entriesMonthly : (slikDerived?.estCicilanPerBulan ?? 0);
          const existingAnnual = existingMonthly * 12;
          const newAnnual = dscrCicilanBaru * 12;
          const totalAnnual = existingAnnual + newAnnual;
          const dscr = ebitda !== null && totalAnnual > 0 ? ebitda / totalAnnual : null;
          const dscrColor = dscr === null ? "text-slate-400"
            : dscr >= 1.5 ? "text-emerald-600" : dscr >= 1.2 ? "text-violet-600"
              : dscr >= 1.0 ? "text-amber-600" : "text-red-600";
          const dscrBadge = dscr === null ? null
            : dscr >= 1.5 ? <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">SANGAT KUAT</span>
              : dscr >= 1.2 ? <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-violet-50 text-violet-700 ring-1 ring-violet-200">KUAT</span>
                : dscr >= 1.0 ? <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">CUKUP</span>
                  : <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 ring-1 ring-red-200">INSUFFICIENT</span>;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Komponen</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-44">Nilai (Rp)</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-44">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 text-slate-700">Operating Profit</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                      {ebitda !== null ? formatIDR(ebitda) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {latestMo < 12 ? `EBITDA annualisasi (${latestMo} bln)` : "EBITDA FY"}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-50 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 text-slate-700">Total Cicilan Existing / Bln</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">{formatIDR(existingMonthly)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{formatIDR(existingAnnual)} / tahun</td>
                  </tr>
                  <tr className="border-b border-slate-50 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 text-slate-700">Estimasi Cicilan Baru / Bln</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        value={dscrCicilanBaru || ""}
                        onChange={(e) => updateDscrCicilanBaru(Number(e.target.value))}
                        placeholder="0"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-right text-slate-700 outline-none focus:border-violet-400 tabular-nums placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{formatIDR(newAnnual)} / tahun</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-bold text-slate-800">Total Debt Service</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-800">{formatIDR(totalAnnual)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{formatIDR(totalAnnual > 0 ? totalAnnual / 12 : 0)} × 12 bln</td>
                  </tr>
                  <tr className="bg-slate-50/40 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-800">DSCR = OCF / Total Debt Service</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-black text-base ${dscrColor}`}>
                      {dscr !== null ? `${dscr.toFixed(2)}x` : <span className="text-slate-300 font-normal text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{dscrBadge ?? <span className="text-slate-300">—</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* IV. Scoring Aspek Kredit */}
      {scoringAspects.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">IV. Scoring Aspek Kredit</p>
            {(() => {
              const totalBobot = scoringAspects.reduce((s, a) => s + a.bobot, 0);
              const weighted = totalBobot > 0 ? scoringAspects.reduce((s, a) => s + a.bobot * a.skor, 0) / totalBobot : 0;
              const colorClass = weighted >= 4 ? "text-emerald-600" : weighted >= 3 ? "text-violet-600" : weighted >= 2 ? "text-amber-600" : "text-red-600";
              return <span className={`text-sm font-black ${colorClass}`}>{weighted.toFixed(2)} / 5.00</span>;
            })()}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[30%]">Aspek</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[8%]">Bobot</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[22%]">Skor (1–5)</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[8%]">W.Score</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {scoringAspects.map((aspect, idx) => {
                  const wScore = (aspect.bobot * aspect.skor) / 100;
                  return (
                    <tr key={aspect.id} className="border-b border-slate-50 last:border-b-0">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{aspect.label}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-500">{aspect.bobot}%</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button key={s} type="button" onClick={() => updateScoringAspect(idx, "skor", s)}
                              className={`h-6 w-6 rounded text-[10px] font-bold transition-all ${aspect.skor === s ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-slate-700">{wScore.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <input value={aspect.catatan}
                          onChange={(e) => updateScoringAspect(idx, "catatan", e.target.value)}
                          placeholder="Catatan analisis..."
                          className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-violet-400 placeholder:text-slate-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/60">
                <tr>
                  <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-700">{scoringAspects.reduce((s, a) => s + a.bobot, 0)}%</td>
                  <td></td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                    {(() => {
                      const tb = scoringAspects.reduce((s, a) => s + a.bobot, 0);
                      return tb > 0 ? (scoringAspects.reduce((s, a) => s + a.bobot * a.skor, 0) / tb).toFixed(2) : "0.00";
                    })()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* V. Rincian Hutang & DSCR */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">V. Rincian Hutang &amp; DSCR</p>
          <div className="flex items-center gap-1.5">
            <button onClick={importDebtEntries}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all">
              <Download className="h-3 w-3" /> Import SLIK/CBI
            </button>
            <button onClick={addDebtEntry}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 transition-all">
              <Plus className="h-3 w-3" /> Tambah
            </button>
          </div>
        </div>
        {debtEntries.length === 0 ? (
          <div className="px-5 py-4 text-center">
            <p className="text-xs text-slate-400">Belum ada data hutang existing. Klik &quot;Tambah&quot; untuk input.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  {["Kreditur", "Fasilitas", "Plafon", "Outstanding", "Cicilan/Bln", ""].map((h) => (
                    <th key={h} className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${h === "" ? "" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debtEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 last:border-b-0">
                    <td className="px-3 py-2">
                      <input value={entry.kreditur} onChange={(e) => updateDebtEntry(entry.id, "kreditur", e.target.value)}
                        placeholder="Nama bank..." className="w-full min-w-[100px] rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-violet-400 placeholder:text-slate-300" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={entry.fasilitas} onChange={(e) => updateDebtEntry(entry.id, "fasilitas", e.target.value)}
                        placeholder="KMK, KI..." className="w-full min-w-[80px] rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-violet-400 placeholder:text-slate-300" />
                    </td>
                    {(["plafon", "outstanding", "cicilanPerBulan"] as const).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input type="number" value={entry[field] || ""} onChange={(e) => updateDebtEntry(entry.id, field, Number(e.target.value))}
                          placeholder="0"
                          className="w-full min-w-[110px] rounded border border-slate-200 px-2 py-1 text-[11px] text-right text-slate-700 outline-none focus:border-violet-400 tabular-nums placeholder:text-slate-300" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button onClick={() => removeDebtEntry(entry.id)}
                        className="flex items-center justify-center rounded border border-slate-200 p-1 text-slate-400 hover:border-red-200 hover:text-red-500 transition-all">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/60">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 font-bold text-slate-700">Total Existing</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 tabular-nums">{formatIDR(debtEntries.reduce((s, e) => s + e.plafon, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 tabular-nums">{formatIDR(debtEntries.reduce((s, e) => s + e.outstanding, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 tabular-nums">{formatIDR(debtEntries.reduce((s, e) => s + e.cicilanPerBulan, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {/* DSCR Calculation */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Kalkulasi DSCR</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] text-slate-400 mb-1.5">Cicilan Baru / Bln (Rp)</p>
              <input type="number" value={dscrCicilanBaru || ""}
                onChange={(e) => updateDscrCicilanBaru(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-violet-400 tabular-nums placeholder:text-slate-300" />
            </div>
            {(() => {
              const existingAnnual = debtEntries.reduce((s, e) => s + e.cicilanPerBulan, 0) * 12;
              const newAnnual = dscrCicilanBaru * 12;
              const totalAnnual = existingAnnual + newAnnual;
              const netIncome = pnlComparison?.rows.find((r) => r.key === "net_income")?.latestTotal ?? null;
              const annualized = pnlComparison?.latestMo && pnlComparison.latestMo < 12 && netIncome !== null
                ? (netIncome / pnlComparison.latestMo) * 12 : netIncome;
              const dscr = annualized !== null && totalAnnual > 0 ? annualized / totalAnnual : null;
              const dscrColor = dscr === null ? "text-slate-400" : dscr >= 1.5 ? "text-emerald-600" : dscr >= 1.2 ? "text-violet-600" : dscr >= 1.0 ? "text-amber-600" : "text-red-600";
              return (
                <>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">Total Debt Service / Thn</p>
                    <p className="text-xs font-bold text-slate-700 tabular-nums pt-2">{formatIDR(totalAnnual)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">Net Income (annualized)</p>
                    <p className="text-xs font-bold text-slate-700 tabular-nums pt-2">{annualized !== null ? formatIDR(annualized) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">DSCR</p>
                    <p className={`text-xl font-black pt-1 ${dscrColor}`}>
                      {dscr !== null ? `${dscr.toFixed(2)}x` : "—"}
                    </p>
                    {dscr !== null && (
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                        {dscr >= 1.5 ? "Sangat Kuat" : dscr >= 1.2 ? "Kuat" : dscr >= 1.0 ? "Cukup" : "Insufficient"}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* CD3 — Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <PencilLine className="h-3.5 w-3.5 text-slate-400" /> Catatan Analis
          </p>
          <span className="text-[10px] text-slate-400">Disimpan di browser</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder="Tambahkan catatan analisis kredit, observasi khusus, atau rekomendasi…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 resize-none h-28 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all"
        />
      </div>

      {/* Tanda Tangan & Persetujuan */}
      {approvers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-bold text-slate-700">Tanda Tangan &amp; Persetujuan</p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {approvers.map(({ id, jabatan, nama }) => (
              <div key={id} className="flex flex-col items-center gap-3 py-4 sm:py-0 px-5 first:pl-0 last:pr-0">
                <div className="h-12 w-full" />
                <div className="w-full border-t-2 border-slate-300 pt-2 text-center">
                  <p className="text-xs font-bold text-slate-800">{nama || <span className="text-slate-300">—</span>}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{jabatan}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
