"use client";

import { useState, useEffect } from "react";
import { localData } from "@/lib/localData";
import type { CreditMemo, CompanyProfile, LegalDocs, LegalDocKey, ScoringAspect, DebtEntry, ApproverEntry, Collateral } from "@/lib/localData";
import { statementsApi } from "@/lib/api";
import type { SlikFasilitas, CbiFasilitas, ClickFasilitas, Statement, SlikReport, CbiReport, ClickReport } from "@/lib/api";
import { emptyCompanyMemo } from "../_lib/company-detail-helpers";
import { toast } from "sonner";

function calcCicilanPerBulan(bakiDebet: number | null, bungaStr: string, jatuhTempoStr: string): number {
  const baki = bakiDebet ?? 0;
  if (baki <= 0) return 0;

  const today = new Date();
  const jatuhTempo = jatuhTempoStr ? new Date(jatuhTempoStr) : null;
  const remainingMonths = jatuhTempo && jatuhTempo > today
    ? Math.max(1, Math.round((jatuhTempo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 36;

  const rateMatch = bungaStr?.match(/([\d.]+)/);
  const annualRate = rateMatch ? parseFloat(rateMatch[1]) / 100 : 0;

  if (annualRate > 0) {
    const r = annualRate / 12;
    const n = remainingMonths;
    return Math.round(baki * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
  }

  return Math.round(baki / remainingMonths);
}

export function useCompanyLocalState(id: string) {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState("");
  const [memo, setMemo] = useState<CreditMemo>(() => emptyCompanyMemo(id));
  const [profile, setProfile] = useState<CompanyProfile>(() => localData.getProfile(id));
  const [legalDocs, setLegalDocs] = useState<LegalDocs>({});
  const [legalUploading, setLegalUploading] = useState<Partial<Record<LegalDocKey, boolean>>>({});
  const [scoringAspects, setScoringAspects] = useState<ScoringAspect[]>(() => localData.getScoringAspects(id));
  const [debtEntries, setDebtEntries] = useState<DebtEntry[]>([]);
  const [dscrCicilanBaru, setDscrCicilanBaru] = useState(0);
  const [approvers, setApprovers] = useState<ApproverEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    setNotes(localStorage.getItem(`company-notes-${id}`) ?? "");
    setMemo(localData.getMemo(id) ?? emptyCompanyMemo(id));
    setProfile(localData.getProfile(id));
    setLegalDocs(localData.getLegalDocs(id));
    setScoringAspects(localData.getScoringAspects(id));
    setDebtEntries(localData.getDebtEntries(id));
    setDscrCicilanBaru(localData.getDscrCicilanBaru(id));
    setApprovers(localData.getApprovers());
  }, [id]);

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(`company-notes-${id}`, val);
  };

  const setMemoField = <K extends keyof CreditMemo>(key: K, value: CreditMemo[K]) => {
    setMemo((prev) => ({ ...prev, [key]: value }));
  };

  const setProfileField = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = () => {
    localData.saveProfile(id, profile);
    toast.success("Profil perusahaan disimpan");
  };

  const _legalDocType: Record<LegalDocKey, import("@/lib/api").DocumentType> = { nib: "nib", ahu: "ahu", akta: "akta" };

  const handleLegalDocUpload = async (docKey: LegalDocKey, file: File) => {
    setLegalUploading((prev) => ({ ...prev, [docKey]: true }));
    try {
      const res = await statementsApi.upload(file, { companyId: id, documentType: _legalDocType[docKey] ?? "other" });
      const ref = { statementId: res.data.id, filename: file.name, uploadedAt: new Date().toISOString() };
      const next = { ...legalDocs, [docKey]: ref };
      setLegalDocs(next);
      localData.saveLegalDocs(id, next);
      toast.success(`Dokumen ${docKey.toUpperCase()} berhasil diupload`);
    } catch {
      toast.error(`Gagal upload dokumen ${docKey.toUpperCase()}`);
    } finally {
      setLegalUploading((prev) => ({ ...prev, [docKey]: false }));
    }
  };

  const removeLegalDoc = (docKey: LegalDocKey) => {
    const next = { ...legalDocs };
    delete next[docKey];
    setLegalDocs(next);
    localData.saveLegalDocs(id, next);
  };

  const updateScoringAspect = (idx: number, field: "skor" | "catatan", value: number | string) => {
    setScoringAspects((prev) => {
      const next = prev.map((a, i) => i === idx ? { ...a, [field]: value } : a);
      localData.saveScoringAspects(id, next);
      return next;
    });
  };

  const addDebtEntry = () => {
    const entry: DebtEntry = { id: crypto.randomUUID(), kreditur: "", fasilitas: "", plafon: 0, outstanding: 0, cicilanPerBulan: 0 };
    const next = [...debtEntries, entry];
    setDebtEntries(next);
    localData.saveDebtEntries(id, next);
  };

  const updateDebtEntry = (entryId: string, field: keyof DebtEntry, value: string | number) => {
    setDebtEntries((prev) => {
      const next = prev.map((e) => e.id === entryId ? { ...e, [field]: value } : e);
      localData.saveDebtEntries(id, next);
      return next;
    });
  };

  const removeDebtEntry = (entryId: string) => {
    const next = debtEntries.filter((e) => e.id !== entryId);
    setDebtEntries(next);
    localData.saveDebtEntries(id, next);
  };

  const updateDscrCicilanBaru = (val: number) => {
    setDscrCicilanBaru(val);
    localData.saveDscrCicilanBaru(id, val);
  };

  const importDebtEntriesFromCreditBureaus = (slikFas: SlikFasilitas[], cbiFas: CbiFasilitas[], clickFas: ClickFasilitas[] = []) => {
    const fromSlik: DebtEntry[] = slikFas.map((f) => ({
      id: crypto.randomUUID(),
      kreditur: f.kreditur ?? "",
      fasilitas: f.jenis_kredit ?? "",
      plafon: f.plafon ?? 0,
      outstanding: f.baki_debet ?? 0,
      cicilanPerBulan: calcCicilanPerBulan(f.baki_debet, f.bunga, f.tanggal_jatuh_tempo),
    }));
    const fromCbi: DebtEntry[] = cbiFas.map((f) => ({
      id: crypto.randomUUID(),
      kreditur: f.kreditur ?? "",
      fasilitas: f.jenis_fasilitas ?? "",
      plafon: f.plafon ?? 0,
      outstanding: f.baki_debet ?? 0,
      cicilanPerBulan: calcCicilanPerBulan(f.baki_debet, f.suku_bunga, f.tanggal_jatuh_tempo),
    }));
    const fromClick: DebtEntry[] = clickFas.map((f) => ({
      id: crypto.randomUUID(),
      kreditur: f.kreditur ?? "",
      fasilitas: f.jenis_kredit ?? "",
      plafon: f.plafon ?? 0,
      outstanding: f.baki_debet ?? 0,
      cicilanPerBulan: calcCicilanPerBulan(f.baki_debet, f.bunga, f.tanggal_jatuh_tempo),
    }));
    const next = [...fromSlik, ...fromCbi, ...fromClick];
    setDebtEntries(next);
    localData.saveDebtEntries(id, next);
    toast.success(`${next.length} fasilitas diimpor dari SLIK/CBI/CLICK`);
  };

  const generateRingkasanFromDocs = (
    statements: Statement[],
    companyName: string,
    totalCredit?: number,
    slikReports: SlikReport[] = [],
    cbiReports: CbiReport[] = [],
    clickReports: ClickReport[] = [],
  ) => {
    type M = Record<string, unknown>;

    const rev = [...statements].reverse();
    const nibStmt  = rev.find((s) => s.document_type === "nib"           && s.parse_meta);
    const ahuStmt  = rev.find((s) => s.document_type === "ahu"           && s.parse_meta);
    const aktaStmt = rev.find((s) => s.document_type === "akta"          && s.parse_meta);
    const pnlStmt  = rev.find((s) => s.document_type === "profit_loss"   && s.parse_meta);
    const bsStmt   = rev.find((s) => s.document_type === "balance_sheet" && s.parse_meta);
    const cfStmt   = rev.find((s) => s.document_type === "cash_flow"     && s.parse_meta);

    const nib  = (nibStmt?.parse_meta  as M)?.nib  as M | undefined;
    const ahu  = (ahuStmt?.parse_meta  as M)?.ahu  as M | undefined;
    const akta = (aktaStmt?.parse_meta as M)?.akta as M | undefined;
    const pnlSummary = (pnlStmt?.parse_meta as M)?.summary as M | undefined;
    const bsSummary  = (bsStmt?.parse_meta  as M)?.summary as M | undefined;
    const cfSummary  = (cfStmt?.parse_meta  as M)?.summary as M | undefined;

    const fmt = (n: number) =>
      new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

    // Helper: get latest period value from a BS summary dict {"Dec-2023": x, "Dec-2024": y}
    const latestPeriod = (dict: M | undefined): number | undefined => {
      if (!dict) return undefined;
      const keys = Object.keys(dict).filter((k) => k !== "total");
      if (!keys.length) return undefined;
      const lastKey = keys[keys.length - 1];
      const val = dict[lastKey];
      return typeof val === "number" ? val : undefined;
    };

    const lines: string[] = [];

    // --- Identitas ---
    const namaPerusahaan = ((akta?.nama_perusahaan || ahu?.nama_perusahaan || nib?.nama_pelaku_usaha || companyName) as string) || "";
    const alamat = (nib?.alamat_kantor as string | undefined) || "";
    const kbliEntries = (nib?.kbli_entries as { kode?: string; uraian?: string }[] | undefined) ?? [];
    const keguiatanUsaha = (akta?.kegiatan_usaha as { kode_kbli?: string; uraian?: string }[] | undefined) ?? [];
    const bidangUsaha = kbliEntries[0]?.uraian || keguiatanUsaha[0]?.uraian || "";
    const kbli = kbliEntries[0]?.kode || keguiatanUsaha[0]?.kode_kbli || "";

    if (namaPerusahaan) {
      let line = namaPerusahaan;
      if (bidangUsaha) line += ` adalah perusahaan yang bergerak di bidang ${bidangUsaha}${kbli ? ` (KBLI ${kbli})` : ""}`;
      if (alamat) line += `, berdomisili di ${alamat}`;
      lines.push(line + ".");
    }

    // --- Lama berdiri ---
    const tanggalBerdiri = (ahu?.tanggal_penetapan || ahu?.tanggal_akta || akta?.tanggal_akta) as string | undefined;
    if (tanggalBerdiri) {
      const thn = new Date().getFullYear() - new Date(tanggalBerdiri).getFullYear();
      if (thn > 0) lines.push(`Perusahaan berdiri sejak ${tanggalBerdiri.slice(0, 4)} (${thn} tahun).`);
    }

    // --- Pengurus & Modal ---
    const pengurus = (akta?.pengurus as { nama?: string; jabatan?: string }[] | undefined) ?? [];
    const direkturList = pengurus.filter((p) => (p.jabatan ?? "").toLowerCase().includes("direktur")).map((p) => p.nama).filter(Boolean);
    const komisarisList = pengurus.filter((p) => (p.jabatan ?? "").toLowerCase().includes("komisaris")).map((p) => p.nama).filter(Boolean);
    if (direkturList.length > 0) {
      let line = `Direktur: ${direkturList.join(", ")}`;
      if (komisarisList.length > 0) line += `. Komisaris: ${komisarisList.join(", ")}`;
      lines.push(line + ".");
    }

    const modalDasar = (akta?.modal_dasar || ahu?.modal_dasar) as number | undefined;
    const modalDisetor = (akta?.modal_ditempatkan_disetor || ahu?.modal_disetor) as number | undefined;
    if (modalDasar) {
      let line = `Modal dasar: ${fmt(modalDasar)}`;
      if (modalDisetor) line += `, modal disetor: ${fmt(modalDisetor)}`;
      lines.push(line + ".");
    }

    // --- P&L ---
    if (pnlSummary) {
      const revenue    = (pnlSummary.revenue         as M | undefined)?.total as number | undefined;
      const grossProfit = (pnlSummary.gross_profit   as M | undefined)?.total as number | undefined;
      const opProfit   = (pnlSummary.operating_profit as M | undefined)?.total as number | undefined;
      const netIncome  = (pnlSummary.net_income      as M | undefined)?.total as number | undefined;
      if (revenue !== undefined) {
        const margin = netIncome != null && revenue > 0 ? ` (margin ${(netIncome / revenue * 100).toFixed(1)}%)` : "";
        let line = `Total pendapatan: ${fmt(revenue)}`;
        if (grossProfit !== undefined) line += `, laba kotor: ${fmt(grossProfit)}`;
        if (opProfit !== undefined) line += `, laba operasional: ${fmt(opProfit)}`;
        if (netIncome !== undefined) line += `, laba bersih: ${fmt(netIncome)}${margin}`;
        lines.push(line + ".");
      }
    }

    // --- Balance Sheet ---
    if (bsSummary) {
      const totalAssets = latestPeriod(bsSummary.total_assets as M | undefined);
      const totalLiab   = latestPeriod(bsSummary.total_liabilities as M | undefined);
      const totalEquity = latestPeriod(bsSummary.total_equities as M | undefined);
      if (totalAssets !== undefined) {
        let line = `Total aset: ${fmt(totalAssets)}`;
        if (totalLiab !== undefined) line += `, total kewajiban: ${fmt(totalLiab)}`;
        if (totalEquity !== undefined) {
          line += `, ekuitas: ${fmt(totalEquity)}`;
          if (totalLiab !== undefined && totalEquity > 0) {
            const der = (totalLiab / totalEquity).toFixed(2);
            line += ` (DER ${der}x)`;
          }
        }
        lines.push(line + ".");
      }
    }

    // --- Cash Flow ---
    if (cfSummary) {
      const netOperating = cfSummary.net_cash_from_operating as number | undefined;
      const netChange    = cfSummary.net_cash_change         as number | undefined;
      if (netOperating !== undefined) {
        let line = `Arus kas operasi: ${fmt(netOperating)}`;
        if (netChange !== undefined) line += `, perubahan kas bersih: ${fmt(netChange)}`;
        lines.push(line + ".");
      }
    }

    // --- Bank Statement ---
    if (totalCredit && totalCredit > 0) {
      const bankDocs = statements.filter((s) => s.document_type === "bank_statement" && s.period_start && s.period_end);
      let avgLine = `Total kredit rekening koran: ${fmt(totalCredit)}`;
      if (bankDocs.length > 0) {
        const sorted = [...bankDocs].sort((a, b) => (a.period_start ?? "").localeCompare(b.period_start ?? ""));
        const [ey, em] = (sorted[0].period_start ?? "").slice(0, 7).split("-").map(Number);
        const [ly, lm] = (sorted.at(-1)!.period_end   ?? "").slice(0, 7).split("-").map(Number);
        const months = Math.max(1, (ly - ey) * 12 + (lm - em) + 1);
        avgLine += `, rata-rata per bulan: ${fmt(Math.round(totalCredit / months))}`;
      }
      lines.push(avgLine + ".");
    }

    // --- SLIK / CBI / CLICK ---
    const slikFas  = slikReports.flatMap((r) => r.parsed_data?.fasilitas ?? []);
    const cbiFas   = cbiReports.flatMap((r) => r.parsed_data?.fasilitas_aktif ?? []);
    const clickFas = clickReports.flatMap((r) => r.parsed_data?.fasilitas_aktif ?? []);
    const allFas = [
      ...slikFas.map((f) => ({ kol: parseInt(f.kualitas.replace(/\D/g, ""), 10), baki: f.baki_debet ?? 0 })),
      ...cbiFas.map((f)  => ({ kol: parseInt(f.kolektabilitas.replace(/\D/g, ""), 10), baki: f.baki_debet ?? 0 })),
      ...clickFas.map((f) => ({ kol: parseInt(f.kualitas.replace(/\D/g, ""), 10), baki: f.baki_debet ?? 0 })),
    ].filter((f) => !isNaN(f.kol));

    if (allFas.length > 0) {
      const worstKol  = allFas.reduce((w, f) => Math.max(w, f.kol), 1);
      const totalBaki = allFas.reduce((s, f) => s + f.baki, 0);
      const kolLabel  = worstKol === 1 ? "Lancar" : worstKol === 2 ? "DPK" : worstKol === 3 ? "Kurang Lancar" : worstKol === 4 ? "Diragukan" : "Macet";
      const jmlKreditur = (slikReports[0]?.jumlah_kreditur ?? slikFas.length) + (cbiReports[0]?.jumlah_kreditur_aktif ?? 0);
      let line = `Riwayat kredit: kolektabilitas terburuk ${kolLabel} (kol-${worstKol})`;
      if (totalBaki > 0) line += `, total baki debet: ${fmt(totalBaki)}`;
      if (jmlKreditur > 0) line += `, ${jmlKreditur} kreditur`;
      lines.push(line + ".");
    }

    if (lines.length === 0) {
      toast.error("Tidak ada data dokumen untuk generate ringkasan");
      return;
    }

    setProfile((prev) => {
      const next = { ...prev, ringkasanEksekutif: lines.join("\n") };
      localData.saveProfile(id, next);
      return next;
    });
    toast.success("Ringkasan eksekutif berhasil di-generate");
  };

  const importProfileFromParsedDocs = (statements: Statement[]) => {
    type Meta = Record<string, unknown>;
    const nibStmt = [...statements].reverse().find((s) => s.document_type === "nib" && s.parse_meta);
    const ahuStmt = [...statements].reverse().find((s) => s.document_type === "ahu" && s.parse_meta);
    const aktaStmt = [...statements].reverse().find((s) => s.document_type === "akta" && s.parse_meta);

    const nib = (nibStmt?.parse_meta as Meta)?.nib as Meta | undefined;
    const ahu = (ahuStmt?.parse_meta as Meta)?.ahu as Meta | undefined;
    const akta = (aktaStmt?.parse_meta as Meta)?.akta as Meta | undefined;

    const kbliEntries = (nib?.kbli_entries as { kode?: string; uraian?: string }[] | undefined) ?? [];
    const keguiatanUsaha = (akta?.kegiatan_usaha as { kode_kbli?: string; uraian?: string }[] | undefined) ?? [];
    const pengurus = (akta?.pengurus as { nama?: string; jabatan?: string }[] | undefined) ?? [];
    const direkturEntry = pengurus.find((p) => (p.jabatan ?? "").toLowerCase().includes("direktur"));

    const patch: Partial<CompanyProfile> = {};

    const alamat = (nib?.alamat_kantor as string | undefined) || "";
    if (alamat) patch.alamat = alamat;

    const nibNumber = (nib?.nib_number as string | undefined) || "";
    if (nibNumber) patch.nibSiup = nibNumber;

    const kbliKode = kbliEntries[0]?.kode || keguiatanUsaha[0]?.kode_kbli || "";
    const kbliUraian = kbliEntries[0]?.uraian || keguiatanUsaha[0]?.uraian || "";
    if (kbliKode) patch.kbli = kbliKode;
    if (kbliUraian) patch.jenisUsaha = kbliUraian;

    const tanggalBerdiri = (ahu?.tanggal_penetapan as string | undefined)
      || (ahu?.tanggal_akta as string | undefined)
      || (akta?.tanggal_akta as string | undefined) || "";
    if (tanggalBerdiri) patch.tanggalBerdiri = tanggalBerdiri;

    if (direkturEntry?.nama) patch.direktur = direkturEntry.nama;

    if (Object.keys(patch).length === 0) {
      toast.error("Tidak ada data yang bisa diimpor dari NIB / AHU / Akta");
      return;
    }

    setProfile((prev) => {
      const next = { ...prev, ...patch };
      localData.saveProfile(id, next);
      return next;
    });
    toast.success(`${Object.keys(patch).length} field diisi dari dokumen`);
  };

  const updateApprover = (approverIdx: number, nama: string) => {
    setApprovers((prev) => {
      const next = prev.map((a, i) => i === approverIdx ? { ...a, nama } : a);
      localData.saveApprovers(next);
      return next;
    });
  };

  const addCollateral = () => {
    const col: Collateral = { id: crypto.randomUUID(), type: "", description: "", marketValue: 0, liquidationValue: 0, ltvLimit: 70, legalStatus: "clear", appraisalDate: "" };
    setMemoField("collaterals", [...memo.collaterals, col]);
  };

  const updateCollateral = (colId: string, field: keyof Collateral, value: string | number) => {
    setMemoField("collaterals", memo.collaterals.map((c) => c.id === colId ? { ...c, [field]: value } : c));
  };

  const removeCollateral = (colId: string) => {
    setMemoField("collaterals", memo.collaterals.filter((c) => c.id !== colId));
  };

  const saveMemo = () => {
    const updated = { ...memo, updatedAt: new Date().toISOString() };
    setMemo(updated);
    localData.saveMemo(id, updated);
    toast.success("Memo kredit disimpan");
  };

  return {
    mounted, notes, memo, profile, legalDocs, legalUploading,
    scoringAspects, debtEntries, dscrCicilanBaru, approvers,
    saveNotes, setMemoField, setProfileField, saveProfile,
    handleLegalDocUpload, removeLegalDoc,
    updateScoringAspect,
    addDebtEntry, updateDebtEntry, removeDebtEntry, updateDscrCicilanBaru, importDebtEntriesFromCreditBureaus,
    generateRingkasanFromDocs,
    importProfileFromParsedDocs,
    updateApprover,
    addCollateral, updateCollateral, removeCollateral,
    saveMemo,
  };
}
