"use client";

import { useState, useEffect } from "react";
import { localData } from "@/lib/localData";
import type { CreditMemo, CompanyProfile, LegalDocs, LegalDocKey, ScoringAspect, DebtEntry, ApproverEntry, Collateral } from "@/lib/localData";
import { statementsApi } from "@/lib/api";
import { emptyCompanyMemo } from "../_lib/company-detail-helpers";
import { toast } from "sonner";

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

  const handleLegalDocUpload = async (docKey: LegalDocKey, file: File) => {
    setLegalUploading((prev) => ({ ...prev, [docKey]: true }));
    try {
      const res = await statementsApi.upload(file, { companyId: id, documentType: "other" });
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
    addDebtEntry, updateDebtEntry, removeDebtEntry, updateDscrCicilanBaru,
    updateApprover,
    addCollateral, updateCollateral, removeCollateral,
    saveMemo,
  };
}
