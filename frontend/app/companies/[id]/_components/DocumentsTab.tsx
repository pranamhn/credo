"use client";

import Link from "next/link";
import { FolderOpen, Upload, CalendarDays, List, Trash2, RefreshCw, Eye } from "lucide-react";
import { StatusBadge } from "@/components/statement/StatusBadge";
import type { Statement, DocumentType } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import { docTypeInfo, MONTHS_ID } from "../_lib/company-detail-constants";
import {
  documentTableHeaders, getPnlReport, getBalanceSheetReport, getCashFlowReport,
} from "../_lib/company-detail-helpers";

interface Props {
  visibleStatements: Statement[];
  byYearMonth: Record<string, Record<number, Statement[]>>;
  calYears: string[];
  documentFilter: DocumentType | "all";
  setDocumentFilter: (f: DocumentType | "all") => void;
  docView: "tabel" | "kalender";
  setDocView: (v: "tabel" | "kalender") => void;
  calYear: string;
  setCalYear: (y: string) => void;
  deletingId: string | null;
  reparsingId: string | null;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleDelete: (id: string) => void;
  handleReparse: (id: string) => void;
  fetchData: () => void;
  openUploadModal: (type: DocumentType) => void;
  setSelectedPnlDoc: (doc: Statement | null) => void;
}

export function DocumentsTab({
  visibleStatements, byYearMonth, calYears,
  documentFilter, setDocumentFilter,
  docView, setDocView,
  calYear, setCalYear,
  deletingId, reparsingId, confirmDeleteId, setConfirmDeleteId,
  handleDelete, handleReparse,
  fetchData, openUploadModal, setSelectedPnlDoc,
}: Props) {
  if (visibleStatements.length === 0) {
    return (
      <div className="py-20 text-center">
        <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-500">
          {documentFilter === "all" ? "Belum ada dokumen" : `Belum ada ${docTypeInfo[documentFilter].label}`}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Pilih tipe dokumen di panel kiri untuk upload file baru.
        </p>
        {documentFilter !== "all" && (
          <button
            type="button"
            onClick={() => openUploadModal(documentFilter)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload {docTypeInfo[documentFilter].label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDocumentFilter("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              documentFilter === "all" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Semua
          </button>
          <button onClick={() => setDocView("kalender")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${docView === "kalender" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
            <CalendarDays className="h-3 w-3" /> Kalender
          </button>
          <button onClick={() => setDocView("tabel")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${docView === "tabel" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
            <List className="h-3 w-3" /> Tabel
          </button>
        </div>
        <div className="flex items-center gap-2">
          {documentFilter !== "all" && (
            <button
              type="button"
              onClick={() => openUploadModal(documentFilter)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
          )}
          <button onClick={fetchData}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
            Refresh
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {docView === "kalender" && (
        <div className="p-5 space-y-4">
          {calYears.length === 0 ? (
            <div className="py-8 text-center">
              <CalendarDays className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Belum ada dokumen dengan informasi periode</p>
            </div>
          ) : (
            <>
              {/* Year selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Tahun</p>
                {calYears.map((y) => (
                  <button key={y} onClick={() => setCalYear(y)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${calYear === y ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "text-slate-500 hover:bg-slate-100"}`}>
                    {y}
                  </button>
                ))}
              </div>

              {calYear && (
                <>
                  {/* Coverage summary */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                      {Object.keys(byYearMonth[calYear] ?? {}).length} bulan terupload
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
                      {12 - Object.keys(byYearMonth[calYear] ?? {}).length} bulan belum ada
                    </span>
                  </div>

                  {/* 12-month grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {MONTHS_ID.map((monthLabel, mIdx) => {
                      const docs = byYearMonth[calYear]?.[mIdx] ?? [];
                      const hasDocs = docs.length > 0;
                      return (
                        <div key={mIdx} className={`rounded-xl border p-3 min-h-[88px] flex flex-col transition-all ${hasDocs ? "border-teal-200 bg-teal-50/70" : "border-dashed border-slate-200 bg-slate-50/30"}`}>
                          <p className={`text-[10px] font-bold uppercase mb-2 ${hasDocs ? "text-teal-700" : "text-slate-300"}`}>
                            {monthLabel}
                          </p>
                          {hasDocs ? (
                            <div className="space-y-1.5 flex-1">
                              {docs.slice(0, 2).map((doc) => (
                                <div key={doc.id} className="min-w-0">
                                  {doc.document_type === "bank_statement" && (doc.status === "done" || doc.status === "needs_review") ? (
                                    <Link href={`/statements/${doc.id}`} className="block text-[9px] font-semibold text-teal-800 hover:text-teal-600 truncate leading-tight" title={doc.original_filename}>
                                      {doc.original_filename.replace(/\.pdf$/i, "").slice(0, 14)}
                                    </Link>
                                  ) : (
                                    <p className="text-[9px] font-medium text-slate-600 truncate leading-tight" title={doc.original_filename}>
                                      {doc.original_filename.replace(/\.pdf$/i, "").slice(0, 14)}
                                    </p>
                                  )}
                                  <StatusBadge status={doc.status} />
                                </div>
                              ))}
                              {docs.length > 2 && (
                                <p className="text-[9px] text-teal-600 font-medium">+{docs.length - 2} lainnya</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-300 mt-auto">—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Documents without period info */}
                  {visibleStatements.filter((s) => !s.period_start).length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-semibold text-amber-700 mb-2">Dokumen tanpa informasi periode</p>
                      <div className="space-y-2">
                        {visibleStatements.filter((s) => !s.period_start).map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/60 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-amber-800 truncate" title={doc.original_filename}>
                                {doc.original_filename}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <StatusBadge status={doc.status} />
                                {doc.parse_error && (
                                  <span className="text-[10px] text-amber-700 truncate" title={doc.parse_error}>
                                    {doc.parse_error}
                                  </span>
                                )}
                              </div>
                            </div>
                            {doc.document_type === "bank_statement" && doc.status !== "queued" && doc.status !== "parsing" && (
                              <button
                                type="button"
                                onClick={() => handleReparse(doc.id)}
                                disabled={reparsingId === doc.id}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60 transition-all"
                                title="Retry parsing untuk membaca periode"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${reparsingId === doc.id ? "animate-spin" : ""}`} />
                                Retry
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Table view */}
      {docView === "tabel" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {documentTableHeaders(documentFilter).map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStatements.map((doc) => {
                const pnlReport = getPnlReport(doc);
                const bsReport = getBalanceSheetReport(doc);
                const cfReport = getCashFlowReport(doc);
                const bsLastPeriod = bsReport?.periods?.at(-1);
                const revenue = pnlReport?.summaries?.revenue?.total;
                const netIncome = pnlReport?.summaries?.net_income?.total;
                const balanceOk = doc.document_type === "balance_sheet"
                  ? bsReport?.balance_checks?.every((check) => check.balanced)
                  : doc.document_type === "cash_flow"
                    ? cfReport?.cash_check?.balanced
                    : doc.is_reconciled;
                const cashAkhir = cfReport?.summaries?.ending_cash ?? doc.closing_balance;
                const totalAssets = bsLastPeriod ? bsReport?.summaries?.total_assets?.[bsLastPeriod] : null;
                const primaryMetric = doc.document_type === "profit_loss" ? revenue : balanceOk;
                const secondaryMetric = doc.document_type === "profit_loss"
                  ? netIncome
                  : doc.document_type === "balance_sheet"
                    ? totalAssets
                    : cashAkhir;
                return (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 truncate max-w-[200px]" title={doc.original_filename}>
                        {doc.original_filename}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString("id-ID", { dateStyle: "short" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {doc.period_start && doc.period_end
                        ? `${formatDate(doc.period_start)} – ${formatDate(doc.period_end)}`
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${doc.document_type === "profit_loss" ? "text-right text-xs font-semibold text-emerald-700" : ""}`}>
                      {doc.document_type === "profit_loss" ? (
                        primaryMetric != null ? formatIDR(Number(primaryMetric)) : <span className="text-slate-300 font-normal">—</span>
                      ) : typeof primaryMetric === "boolean" ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                          primaryMetric
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-amber-50 text-amber-700 ring-amber-200"
                        }`}>
                          {primaryMetric ? "Balanced" : "Review"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold whitespace-nowrap ${Number(secondaryMetric ?? 0) < 0 ? "text-red-600" : "text-slate-800"}`}>
                      {secondaryMetric != null && typeof secondaryMetric !== "boolean" ? formatIDR(Number(secondaryMetric)) : <span className="text-slate-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {doc.document_type === "bank_statement" && (doc.status === "done" || doc.status === "needs_review") && (
                          <Link href={`/statements/${doc.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-teal-200 hover:text-teal-600 transition-all">
                            Analisis
                          </Link>
                        )}
                        {["profit_loss", "balance_sheet", "cash_flow"].includes(doc.document_type) && (
                          <button
                            type="button"
                            onClick={() => setSelectedPnlDoc(doc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        )}
                        {doc.document_type === "other" && (
                          <Link
                            href={`/statements/${doc.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-700"
                            title="Lihat dokumen"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        )}
                        {confirmDeleteId === doc.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-400">Hapus?</span>
                            <button onClick={() => handleDelete(doc.id)} disabled={deletingId === doc.id}
                              className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-all">
                              {deletingId === doc.id ? "…" : "Ya"}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all">
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(doc.id)}
                            className="flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-500 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
