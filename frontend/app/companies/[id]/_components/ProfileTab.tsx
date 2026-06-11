"use client";

import { Save, FileText, RefreshCw, X, Upload } from "lucide-react";
import type { CompanyProfile, LegalDocs, LegalDocKey, ApproverEntry } from "@/lib/localData";

interface Props {
  company: { name: string };
  profile: CompanyProfile;
  setProfileField: <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => void;
  saveProfile: () => void;
  legalDocs: LegalDocs;
  legalUploading: Partial<Record<LegalDocKey, boolean>>;
  handleLegalDocUpload: (key: LegalDocKey, file: File) => void;
  removeLegalDoc: (key: LegalDocKey) => void;
  approvers: ApproverEntry[];
  updateApprover: (idx: number, nama: string) => void;
}

export function ProfileTab({
  company, profile, setProfileField, saveProfile,
  legalDocs, legalUploading, handleLegalDocUpload, removeLegalDoc,
  approvers, updateApprover,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Profil Perusahaan</p>
          <h2 className="text-base font-bold text-slate-900">{company.name}</h2>
          <p className="text-xs text-slate-400 mt-1">Identitas debitur, legalitas, dan ringkasan eksekutif.</p>
        </div>
        <button
          type="button"
          onClick={saveProfile}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600 transition-all"
        >
          <Save className="h-3.5 w-3.5" /> Simpan Profil
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Alamat</span>
          <textarea
            value={profile.alamat}
            onChange={(e) => setProfileField("alamat", e.target.value)}
            rows={3}
            placeholder="Alamat lengkap perusahaan"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
          />
        </label>
        {[
          ["tanggalBerdiri", "Tanggal Berdiri", "DD/MM/YYYY"],
          ["jenisUsaha", "Jenis Usaha", "Contoh: Perdagangan besar"],
          ["kbli", "KBLI", "Kode dan uraian KBLI"],
          ["totalKaryawan", "Total Karyawan", "Contoh: 120"],
          ["direktur", "Direktur", "Nama direktur utama"],
          ["teleponDirektur", "Telepon Direktur", "Nomor telepon"],
          ["npwp", "NPWP", "Nomor NPWP"],
          ["nibSiup", "NIB / SIUP", "Nomor legalitas usaha"],
          ["masaBerlakuNib", "Masa Berlaku NIB", "Tanggal / status berlaku"],
        ].map(([key, label, placeholder]) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
            <input
              value={String(profile[key as keyof CompanyProfile] ?? "")}
              onChange={(e) => setProfileField(key as keyof CompanyProfile, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
            />
          </label>
        ))}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status Wajib Pajak</span>
          <select
            value={profile.statusWajibPajak}
            onChange={(e) => setProfileField("statusWajibPajak", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
          >
            {["Aktif", "Non-Aktif", "Belum Terdaftar"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Dokumen Legalitas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Dokumen Legalitas</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { key: "nib" as LegalDocKey, label: "NIB", hint: "Nomor Induk Berusaha" },
            { key: "ahu" as LegalDocKey, label: "AHU", hint: "SK Kemenkumham" },
            { key: "akta" as LegalDocKey, label: "Akta Pendirian", hint: "Akta Notaris" },
          ]).map(({ key, label, hint }) => {
            const ref = legalDocs[key];
            const isUploading = legalUploading[key];
            return (
              <div key={key} className={`rounded-lg border p-3 transition-all ${ref ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-slate-50/40"}`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                <p className="text-[10px] text-slate-400 mb-2">{hint}</p>
                {ref ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3 w-3 shrink-0 text-violet-600" />
                      <span className="text-[11px] font-medium text-violet-700 truncate" title={ref.filename}>{ref.filename}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="cursor-pointer">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegalDocUpload(key, f); e.target.value = ""; }}
                        />
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer">
                          <RefreshCw className="h-3 w-3" /> Ganti
                        </span>
                      </label>
                      <button onClick={() => removeLegalDoc(key)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-3 w-3" /> Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed px-3 py-2 text-[11px] font-medium transition-all cursor-pointer ${isUploading ? "border-violet-300 bg-violet-50 text-violet-600 cursor-wait" : "border-slate-300 text-slate-400 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50"}`}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" disabled={isUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegalDocUpload(key, f); e.target.value = ""; }}
                    />
                    {isUploading
                      ? <><RefreshCw className="h-3 w-3 animate-spin" /> Mengupload…</>
                      : <><Upload className="h-3 w-3" /> Upload PDF</>}
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ringkasan Eksekutif</span>
        <textarea
          value={profile.ringkasanEksekutif}
          onChange={(e) => setProfileField("ringkasanEksekutif", e.target.value)}
          rows={5}
          placeholder="Ringkas profil bisnis, kebutuhan kredit, kekuatan utama, dan perhatian analis."
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
        />
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tanda Tangan Ringkasan Kredit</p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["riskAnalystName", "Risk Analyst", "riskAnalystDate"],
            ["cooName", "COO", "cooDate"],
            ["ceoName", "CEO", "ceoDate"],
          ].map(([nameKey, label, dateKey]) => (
            <div key={nameKey} className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">{label}</p>
              <input
                value={String(profile[nameKey as keyof CompanyProfile] ?? "")}
                onChange={(e) => setProfileField(nameKey as keyof CompanyProfile, e.target.value)}
                placeholder="Nama"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-400"
              />
              <input
                type="date"
                value={String(profile[dateKey as keyof CompanyProfile] ?? "")}
                onChange={(e) => setProfileField(dateKey as keyof CompanyProfile, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-all focus:border-violet-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Approvers Default Global */}
      {approvers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Template Approver Default</p>
          <p className="text-[10px] text-slate-400 mb-3">Nama default digunakan lintas perusahaan. Disimpan di browser.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {approvers.map((a, idx) => (
              <div key={a.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">{a.jabatan}</p>
                <input
                  value={a.nama}
                  onChange={(e) => updateApprover(idx, e.target.value)}
                  placeholder={`Nama ${a.jabatan}`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
