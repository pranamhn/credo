"use client";

import { X, FileText, RefreshCw } from "lucide-react";
import type { Statement } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import { docTypeInfo, PNL_SUMMARY_LABELS, BS_SUMMARY_LABELS, CF_SUMMARY_LABELS } from "../_lib/company-detail-constants";
import { getPnlReport, getBalanceSheetReport, getCashFlowReport } from "../_lib/company-detail-helpers";

interface Props {
  doc: Statement | null;
  onClose: () => void;
  reparsingId: string | null;
  onReparse: (id: string) => void;
}

export function FinancialDocumentModal({ doc, onClose, reparsingId, onReparse }: Props) {
  if (!doc) return null;

  const pnlReport = getPnlReport(doc);
  const bsReport = getBalanceSheetReport(doc);
  const cfReport = getCashFlowReport(doc);

  const pnlSummaries = pnlReport?.summaries ?? {};
  const pnlRows = pnlReport?.line_items?.filter((item) => item.is_total) ?? [];

  const bsSummaries = bsReport?.summaries ?? {};
  const bsLastPeriod = bsReport?.periods?.at(-1);
  const bsRows = bsReport?.line_items?.filter((item) => item.is_total) ?? [];

  const cfSummaries = cfReport?.summaries ?? {};
  const cfRows = cfReport?.line_items ?? [];

  const financialInfo = docTypeInfo[doc.document_type] ?? null;
  const FinancialIcon = financialInfo?.icon ?? FileText;
  const financialReport = pnlReport ?? bsReport ?? cfReport;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${financialInfo?.active ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
              <FinancialIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-950">
                {financialReport?.company_name || doc.original_filename}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {financialReport?.report_title || financialInfo?.label || "Dokumen"}
                {doc.period_start && doc.period_end
                  ? ` · ${formatDate(doc.period_start)} - ${formatDate(doc.period_end)}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup view dokumen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-73px)] overflow-y-auto p-5">
          {pnlReport ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {["revenue", "gross_profit", "operating_profit", "net_income"].map((key) => {
                  const total = pnlSummaries[key]?.total;
                  const negative = Number(total ?? 0) < 0;
                  return (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {PNL_SUMMARY_LABELS[key]}
                      </p>
                      <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                        {formatIDR(total ?? null)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="min-w-[240px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      {(pnlReport.periods ?? []).map((period) => (
                        <th key={period} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {period}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlRows.map((item) => (
                      <tr key={item.description} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.description}</td>
                        {(pnlReport.periods ?? []).map((period) => {
                          const value = item.values?.[period] ?? null;
                          return (
                            <td key={period} className={`whitespace-nowrap px-4 py-3 text-right text-xs font-semibold ${Number(value ?? 0) < 0 ? "text-red-600" : "text-slate-700"}`}>
                              {formatIDR(value)}
                            </td>
                          );
                        })}
                        <td className={`whitespace-nowrap px-4 py-3 text-right text-xs font-bold ${Number(item.total ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatIDR(item.total ?? null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : bsReport ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {["current_assets", "total_assets", "total_liabilities", "total_equities"].map((key) => {
                  const value = bsLastPeriod ? bsSummaries[key]?.[bsLastPeriod] : null;
                  const negative = Number(value ?? 0) < 0;
                  return (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {BS_SUMMARY_LABELS[key]}
                      </p>
                      <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                        {formatIDR(value ?? null)}
                      </p>
                      {bsLastPeriod && <p className="mt-1 text-[10px] text-slate-400">{bsLastPeriod}</p>}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-slate-600">Balance check</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  bsReport.balance_checks?.every((check) => check.balanced)
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}>
                  {bsReport.balance_checks?.every((check) => check.balanced) ? "Balanced" : "Needs review"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="min-w-[260px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      {(bsReport.periods ?? []).map((period) => (
                        <th key={period} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bsRows.map((item) => (
                      <tr key={`${item.section}-${item.description}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{item.description}</p>
                          <p className="text-[10px] text-slate-400">{[item.section, item.subsection].filter(Boolean).join(" · ")}</p>
                        </td>
                        {(bsReport.periods ?? []).map((period) => {
                          const value = item.values?.[period] ?? null;
                          return (
                            <td key={period} className={`whitespace-nowrap px-4 py-3 text-right text-xs font-semibold ${Number(value ?? 0) < 0 ? "text-red-600" : "text-slate-700"}`}>
                              {formatIDR(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : cfReport ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {["net_cash_from_operating", "net_cash_from_investing", "net_cash_from_financing", "ending_cash"].map((key) => {
                  const value = cfSummaries[key] ?? null;
                  const negative = Number(value ?? 0) < 0;
                  return (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {CF_SUMMARY_LABELS[key]}
                      </p>
                      <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                        {formatIDR(value)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-slate-600">Cash reconciliation</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  cfReport.cash_check?.balanced
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}>
                  {cfReport.cash_check?.balanced ? "Balanced" : "Needs review"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="min-w-[320px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfRows.map((item, idx) => (
                      <tr key={`${item.description}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3">
                          <p className={`text-slate-800 ${item.is_total ? "font-bold" : "font-semibold"}`}>{item.description}</p>
                          <p className="text-[10px] text-slate-400">{[item.section, item.subsection].filter(Boolean).join(" · ")}</p>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right text-xs font-bold ${Number(item.amount ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatIDR(item.amount ?? null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-14 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-600">Hasil parser {financialInfo?.label ?? "dokumen"} belum tersedia</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
                Dokumen ini kemungkinan di-upload sebelum parser tersambung. Re-upload file atau jalankan reparse untuk mengisi hasil parsing.
              </p>
              <button
                type="button"
                onClick={() => {
                  onReparse(doc.id);
                  onClose();
                }}
                disabled={reparsingId === doc.id}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reparsingId === doc.id ? "animate-spin" : ""}`} />
                Reparse {financialInfo?.label ?? "Dokumen"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
