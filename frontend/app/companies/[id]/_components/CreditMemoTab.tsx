"use client";

import { Save, Plus, X } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import type { CreditMemo, Collateral } from "@/lib/localData";
import {
  FACILITY_TYPES, MEMO_STATUS, MEMO_STATUS_LABEL,
  MEMO_SCORE_FIELDS, MEMO_5C_FIELDS,
} from "../_lib/company-detail-constants";

interface Props {
  company: { name: string };
  memo: CreditMemo;
  setMemoField: <K extends keyof CreditMemo>(key: K, value: CreditMemo[K]) => void;
  saveMemo: () => void;
  addCollateral: () => void;
  updateCollateral: (colId: string, field: keyof Collateral, value: string | number) => void;
  removeCollateral: (colId: string) => void;
}

export function CreditMemoTab({
  company, memo, setMemoField, saveMemo,
  addCollateral, updateCollateral, removeCollateral,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Analisa 5C</p>
          <h2 className="text-base font-bold text-slate-900">{company.name}</h2>
          <p className="text-xs text-slate-400 mt-1">
            Terakhir diperbarui: {new Date(memo.updatedAt).toLocaleString("id-ID")}
          </p>
        </div>
        <button
          type="button"
          onClick={saveMemo}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 transition-all"
        >
          <Save className="h-3.5 w-3.5" /> Simpan Memo
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fasilitas</span>
          <select
            value={memo.facilityType}
            onChange={(e) => setMemoField("facilityType", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400"
          >
            {FACILITY_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Plafon (Rp)</span>
          <input
            type="number"
            value={memo.loanAmount || ""}
            onChange={(e) => setMemoField("loanAmount", Number(e.target.value))}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 tabular-nums"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tenor (Bulan)</span>
          <input
            type="number"
            value={memo.tenor}
            onChange={(e) => setMemoField("tenor", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Suku Bunga (% p.a.)</span>
          <input
            type="number"
            step="0.1"
            value={memo.proposedRate || ""}
            onChange={(e) => setMemoField("proposedRate", Number(e.target.value))}
            placeholder="0.0"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 tabular-nums"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tujuan Kredit</span>
            <textarea
              value={memo.loanPurpose}
              onChange={(e) => setMemoField("loanPurpose", e.target.value)}
              rows={3}
              placeholder="Deskripsikan tujuan penggunaan kredit..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sumber Pembayaran</span>
            <textarea
              value={memo.repaymentSource}
              onChange={(e) => setMemoField("repaymentSource", e.target.value)}
              rows={3}
              placeholder="Contoh: arus kas operasional, piutang dagang, kontrak berjalan..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Syarat & Catatan</span>
            <textarea
              value={memo.conditions}
              onChange={(e) => setMemoField("conditions", e.target.value)}
              rows={4}
              placeholder="Tambahkan covenant, dokumen pending, atau catatan komite..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300"
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Status Memo</p>
          <select
            value={memo.status}
            onChange={(e) => setMemoField("status", e.target.value as CreditMemo["status"])}
            className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400"
          >
            {MEMO_STATUS.map((status) => (
              <option key={status} value={status}>{MEMO_STATUS_LABEL[status]}</option>
            ))}
          </select>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Skor 5C</p>
          <div className="space-y-2">
            {MEMO_SCORE_FIELDS.map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setMemoField(key, score)}
                      className={`h-6 w-6 rounded-md text-[10px] font-bold transition-all ${
                        memo[key] === score
                          ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                          : "bg-white text-slate-400 ring-1 ring-slate-200 hover:text-slate-600"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analisis 5C */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Analisis 5C</p>
          <div className="flex items-center gap-3">
            {MEMO_5C_FIELDS.map(({ label, scoreKey }) => (
              <span key={scoreKey} className="text-[10px] text-slate-500">
                <span className="font-semibold text-slate-700">{label[0]}</span>: {memo[scoreKey]}
              </span>
            ))}
            <span className="text-[10px] font-semibold text-teal-600 ml-1">
              Avg {(MEMO_5C_FIELDS.reduce((s, { scoreKey }) => s + memo[scoreKey], 0) / MEMO_5C_FIELDS.length).toFixed(1)}
            </span>
          </div>
        </div>
        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMO_5C_FIELDS.map(({ label, scoreKey, notesKey }) => (
            <div key={scoreKey} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">{label}</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setMemoField(scoreKey, s)}
                      className={`h-6 w-6 rounded text-[10px] font-bold transition-all ${memo[scoreKey] === s ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={memo[notesKey]}
                onChange={(e) => setMemoField(notesKey, e.target.value)}
                rows={2}
                placeholder={`Catatan ${label}...`}
                className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300 transition-all"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Jaminan / Agunan */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Daftar Jaminan / Agunan</p>
          <button onClick={addCollateral}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-600 transition-all">
            <Plus className="h-3 w-3" /> Tambah
          </button>
        </div>
        {memo.collaterals.length === 0 ? (
          <div className="px-5 py-4 text-center">
            <p className="text-xs text-slate-400">Belum ada jaminan. Klik &quot;Tambah&quot; untuk input agunan.</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {memo.collaterals.map((col) => (
              <div key={col.id} className="rounded-lg border border-slate-200 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">{col.type || "Jaminan baru"}</span>
                  <button onClick={() => removeCollateral(col.id)}
                    className="flex items-center justify-center rounded border border-slate-200 p-1 text-slate-400 hover:border-red-200 hover:text-red-500 transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tipe Jaminan</span>
                    <input value={col.type} onChange={(e) => updateCollateral(col.id, "type", e.target.value)}
                      placeholder="Tanah & Bangunan..." className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Deskripsi</span>
                    <input value={col.description} onChange={(e) => updateCollateral(col.id, "description", e.target.value)}
                      placeholder="Lokasi/detail..." className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tgl Appraisal</span>
                    <input type="date" value={col.appraisalDate} onChange={(e) => updateCollateral(col.id, "appraisalDate", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-teal-400" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nilai Pasar (Rp)</span>
                    <input type="number" value={col.marketValue || ""}
                      onChange={(e) => updateCollateral(col.id, "marketValue", Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-right text-slate-700 outline-none focus:border-teal-400 tabular-nums" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nilai Likuidasi (Rp)</span>
                    <input type="number" value={col.liquidationValue || ""}
                      onChange={(e) => updateCollateral(col.id, "liquidationValue", Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-right text-slate-700 outline-none focus:border-teal-400 tabular-nums" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status Legal</span>
                    <select value={col.legalStatus} onChange={(e) => updateCollateral(col.id, "legalStatus", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-teal-400">
                      <option value="clear">Clear</option>
                      <option value="in_progress">In Progress</option>
                      <option value="dispute">Dispute</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        {memo.collaterals.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex gap-8">
            <div>
              <p className="text-[10px] text-slate-400">Total Nilai Pasar</p>
              <p className="text-xs font-bold text-slate-700">{formatIDR(memo.collaterals.reduce((s, c) => s + c.marketValue, 0))}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Total Nilai Likuidasi</p>
              <p className="text-xs font-bold text-slate-700">{formatIDR(memo.collaterals.reduce((s, c) => s + c.liquidationValue, 0))}</p>
            </div>
          </div>
        )}
      </div>

      {/* Approval Workflow */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <p className="text-xs font-bold text-slate-700">Approval Workflow</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Risk Analyst</span>
              <input value={memo.analystName} onChange={(e) => setMemoField("analystName", e.target.value)}
                placeholder="Nama analis"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tanggal Analisis</span>
              <input type="date" value={memo.analystDate} onChange={(e) => setMemoField("analystDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Checker</span>
              <input value={memo.checkerName} onChange={(e) => setMemoField("checkerName", e.target.value)}
                placeholder="Nama checker"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tanggal Review</span>
              <input type="date" value={memo.checkerDate} onChange={(e) => setMemoField("checkerDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Catatan Checker</span>
              <textarea value={memo.checkerNotes} onChange={(e) => setMemoField("checkerNotes", e.target.value)}
                rows={1} placeholder="Catatan review..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-300" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Keputusan Komite</span>
              <select value={memo.committeeDecision} onChange={(e) => setMemoField("committeeDecision", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400">
                <option value="">-- Belum ada keputusan --</option>
                <option value="disetujui">Disetujui</option>
                <option value="disetujui_syarat">Disetujui dengan Syarat</option>
                <option value="ditolak">Ditolak</option>
                <option value="pending">Pending / Ditunda</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tanggal Komite</span>
              <input type="date" value={memo.committeeDate} onChange={(e) => setMemoField("committeeDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
