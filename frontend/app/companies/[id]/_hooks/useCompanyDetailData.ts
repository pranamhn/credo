"use client";

import { useState, useCallback, useEffect } from "react";
import { companiesApi, statementsApi, slikApi, cbiApi, clickApi } from "@/lib/api";
import type { CompanySummary, Statement, SlikReport, CbiReport, ClickReport } from "@/lib/api";
import { toast } from "sonner";

export function useCompanyDetailData(id: string) {
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [slikReports, setSlikReports] = useState<SlikReport[]>([]);
  const [cbiReports, setCbiReports] = useState<CbiReport[]>([]);
  const [clickReports, setClickReports] = useState<ClickReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(false);

      const [summaryRes, statementsRes] = await Promise.all([
        companiesApi.get(id),
        companiesApi.statements(id),
      ]);
      setSummary(summaryRes.data);
      setStatements(statementsRes.data);

      // Non-critical data: catch individually so page still loads
      const [slikRes, cbiRes, clickRes] = await Promise.allSettled([
        slikApi.list(id),
        cbiApi.list(id),
        clickApi.list(id),
      ]);
      if (slikRes.status === "fulfilled") setSlikReports(slikRes.value.data);
      if (cbiRes.status === "fulfilled") setCbiReports(cbiRes.value.data);
      if (clickRes.status === "fulfilled") setClickReports(clickRes.value.data);
    } catch {
      setError(true);
      toast.error("Gagal memuat detail perusahaan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await statementsApi.delete(docId);
      toast.success("Dokumen dihapus");
      setConfirmDeleteId(null);
      fetchData();
    } catch { toast.error("Gagal menghapus dokumen"); }
    finally { setDeletingId(null); }
  };

  const handleReparse = async (docId: string) => {
    setReparsingId(docId);
    try {
      await statementsApi.reparse(docId);
      toast.success("Retry parsing dimulai");
      await fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Gagal retry parsing";
      toast.error(msg);
    } finally {
      setReparsingId(null);
    }
  };

  return {
    summary, statements, slikReports, cbiReports, clickReports,
    loading, error,
    fetchData,
    deletingId, reparsingId, confirmDeleteId, setConfirmDeleteId,
    handleDelete, handleReparse,
  };
}
