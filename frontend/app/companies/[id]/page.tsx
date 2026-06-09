"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentType, Statement } from "@/lib/api";
import { computeEWSTier } from "@/lib/localData";
import {
  ArrowLeft, Building2, AlertTriangle,
  FolderOpen, PencilLine, ShieldCheck, BarChart3,
} from "lucide-react";
import { RATING_META } from "./_lib/company-detail-constants";
import type { ActiveTab } from "./_lib/company-detail-types";
import { computeCreditScore } from "./_lib/company-detail-helpers";
import { handlePrint } from "./_lib/print-credit-summary";
import { CompanyHeader } from "./_components/CompanyHeader";
import { LeftNavigationPanel } from "./_components/LeftNavigationPanel";
import { UploadDocumentPanel } from "./_components/UploadDocumentPanel";
import { DocumentStatsPanel } from "./_components/DocumentStatsPanel";
import { ProfileTab } from "./_components/ProfileTab";
import { CreditSummaryTab } from "./_components/CreditSummaryTab";
import { DocumentsTab } from "./_components/DocumentsTab";
import { CreditMemoTab } from "./_components/CreditMemoTab";
import { TrendAnalysisTab } from "./_components/TrendAnalysisTab";
import { UploadDocumentModal } from "./_components/UploadDocumentModal";
import { FinancialDocumentModal } from "./_components/FinancialDocumentModal";
import { useCompanyDetailData } from "./_hooks/useCompanyDetailData";
import { useCompanyLocalState } from "./_hooks/useCompanyLocalState";
import { useTransactionAnalytics } from "./_hooks/useTransactionAnalytics";
import { useFinancialComparisons } from "./_hooks/useFinancialComparisons";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();

  // ── UI-only state ────────────────────────────────────────────────────────
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("bank_statement");
  const [documentFilter, setDocumentFilter] = useState<DocumentType | "all">("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPnlDoc, setSelectedPnlDoc] = useState<Statement | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("ringkasan");
  const [docView, setDocView] = useState<"tabel" | "kalender">("kalender");
  const [calYear, setCalYear] = useState<string>("");

  // ── Server data ──────────────────────────────────────────────────────────
  const {
    summary, statements, slikReports, cbiReports,
    loading, error, fetchData,
    deletingId, reparsingId, confirmDeleteId, setConfirmDeleteId,
    handleDelete, handleReparse,
  } = useCompanyDetailData(id);

  // ── Local (localStorage) state ───────────────────────────────────────────
  const {
    mounted, notes, memo, profile, legalDocs, legalUploading,
    scoringAspects, debtEntries, dscrCicilanBaru, approvers,
    saveNotes, setMemoField, setProfileField, saveProfile,
    handleLegalDocUpload, removeLegalDoc,
    updateScoringAspect,
    addDebtEntry, updateDebtEntry, removeDebtEntry, updateDscrCicilanBaru,
    updateApprover,
    addCollateral, updateCollateral, removeCollateral,
    saveMemo,
  } = useCompanyLocalState(id);

  // ── Transaction analytics + chart data ──────────────────────────────────
  const {
    monthlyData, txLoading, chartPeriod, setChartPeriod,
    filteredDaily, filteredMonthly,
  } = useTransactionAnalytics(statements);

  // ── Financial comparisons ────────────────────────────────────────────────
  const { pnlComparison, bsComparison, derivedRatios } = useFinancialComparisons(statements);

  // ── Derived UI values ────────────────────────────────────────────────────
  const visibleStatements = useMemo(() => {
    if (documentFilter === "all") return statements;
    return statements.filter((s) => s.document_type === documentFilter);
  }, [statements, documentFilter]);

  const byYearMonth = useMemo(() => {
    const map: Record<string, Record<number, Statement[]>> = {};
    visibleStatements.forEach((s) => {
      if (!s.period_start) return;
      const year = s.period_start.slice(0, 4);
      const mIdx = parseInt(s.period_start.slice(5, 7)) - 1;
      (map[year] ??= {})[mIdx] ??= [];
      map[year][mIdx].push(s);
    });
    return map;
  }, [visibleStatements]);

  const calYears = useMemo(() => Object.keys(byYearMonth).sort().reverse(), [byYearMonth]);

  useEffect(() => {
    if (calYears.length && !calYear) setCalYear(calYears[0]);
  }, [calYears, calYear]);

  const openUploadModal = (type: DocumentType) => {
    setSelectedDocType(type);
    setDocumentFilter(type);
    setActiveTab("dokumen");
    setDocView(type === "bank_statement" ? "kalender" : "tabel");
    setUploadModalOpen(true);
  };

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) return (
    <AppShell>
      <div className="space-y-5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </AppShell>
  );

  if (error || !summary) return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-700">Perusahaan tidak ditemukan</p>
        <p className="text-sm text-slate-400 mt-1 mb-4">Pastikan ID perusahaan benar atau koneksi backend aktif.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={fetchData}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors">
            Coba lagi
          </button>
          <Link href="/companies" className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-500 font-medium">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </div>
      </div>
    </AppShell>
  );

  const { company } = summary;
  const netFlow     = Number(summary.total_credit) - Number(summary.total_debit);
  const creditScore = computeCreditScore(summary, statements, slikReports, memo.collaterals, memo.loanAmount, cbiReports);
  const rating      = creditScore.rating;
  const ratingMeta  = RATING_META[rating];

  const entityType = /^PT\s/i.test(company.name)    ? "Perseroan Terbatas (PT)"
    : /^CV\s/i.test(company.name)    ? "Commanditaire Vennootschap (CV)"
    : /^UD\s/i.test(company.name)    ? "Usaha Dagang (UD)"
    : /^Firma\s/i.test(company.name) ? "Firma"
    : "";

  const lamaBerdiri = (() => {
    if (!profile.tanggalBerdiri) return "";
    const [d, m, y] = profile.tanggalBerdiri.split("/");
    if (!d || !m || !y) return "";
    const years = Math.floor((Date.now() - new Date(Number(y), Number(m) - 1, Number(d)).getTime()) / (365.25 * 24 * 3600 * 1000));
    return years > 0 ? `${years} Tahun` : "";
  })();

  const ewsTier = computeEWSTier(
    summary.failed_uploads,
    summary.document_count,
    Number(summary.total_credit),
    Number(summary.total_debit),
    statements.filter((s) => s.document_type === "bank_statement").sort((a, b) => (b.period_end ?? "").localeCompare(a.period_end ?? ""))[0]?.status,
  );

  const slikDerived = (() => {
    if (!slikReports.length && !cbiReports.length) return null;
    const slikFas = slikReports.flatMap((r) => r.parsed_data?.fasilitas ?? []);
    const cbiFas  = cbiReports.flatMap((r) => r.parsed_data?.fasilitas_aktif ?? []);
    const allKolBaki = [
      ...slikFas.map((f) => ({ kol: parseInt(f.kualitas.replace(/\D/g, ""), 10), baki: f.baki_debet ?? 0 })),
      ...cbiFas.map((f)  => ({ kol: parseInt(f.kolektabilitas.replace(/\D/g, ""), 10), baki: f.baki_debet ?? 0 })),
    ];
    if (!allKolBaki.length) return null;
    const worstKol  = allKolBaki.reduce((w, f) => (isNaN(f.kol) ? w : Math.max(w, f.kol)), 1);
    const totalBaki = allKolBaki.reduce((s, f) => s + f.baki, 0);
    const jmlKreditur = (slikReports[0]?.jumlah_kreditur ?? slikFas.length) +
      (cbiReports[0]?.jumlah_kreditur_aktif ?? 0);
    const jmlFasilitas = slikFas.length + cbiFas.length;
    const bankDocs = statements.filter((s) => s.document_type === "bank_statement" && s.period_start && s.period_end);
    let totalMonths = 1;
    if (bankDocs.length > 0) {
      const sorted    = [...bankDocs].sort((a, b) => (a.period_start ?? "").localeCompare(b.period_start ?? ""));
      const earliest  = sorted[0];
      const latestDoc = sorted.at(-1)!;
      const [ey, em]  = (earliest.period_start ?? "").slice(0, 7).split("-").map(Number);
      const [ly, lm]  = (latestDoc.period_end  ?? "").slice(0, 7).split("-").map(Number);
      totalMonths = Math.max(1, (ly - ey) * 12 + (lm - em) + 1);
    } else {
      totalMonths = Math.max(1, summary.bank_statement_count);
    }
    const monthlyIncome      = Number(summary.total_credit) / totalMonths;
    const estCicilanPerBulan = totalBaki > 0 ? totalBaki / 36 : 0;
    const dsr = monthlyIncome > 0 && estCicilanPerBulan > 0 ? estCicilanPerBulan / monthlyIncome : null;
    const kolLabel = worstKol === 1 ? "Lancar"
      : worstKol === 2 ? "Dalam Perhatian Khusus"
      : worstKol === 3 ? "Kurang Lancar"
      : worstKol === 4 ? "Diragukan"
      : "Macet";
    return { worstKol, totalBaki, jmlKreditur, jmlFasilitas, monthlyIncome, estCicilanPerBulan, dsr, kolLabel };
  })();

  const TABS: {
    key: ActiveTab;
    label: string;
    helper: string;
    icon: React.ComponentType<{ className?: string }>;
    active: string;
    idle: string;
  }[] = [
    { key: "ringkasan", label: "Ringkasan Kredit",   helper: "Rating risiko, faktor risiko, dan catatan analis",    icon: ShieldCheck, active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", idle: "bg-emerald-50 text-emerald-600" },
    { key: "profil",    label: "Profil Perusahaan",  helper: "Identitas, legalitas, dan ringkasan eksekutif",       icon: Building2,   active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", idle: "bg-violet-50 text-violet-600" },
    { key: "dokumen",   label: "Dokumen",            helper: "Upload, kalender dokumen, dan hasil parsing",          icon: FolderOpen,  active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", idle: "bg-blue-50 text-blue-600" },
    { key: "grafik",    label: "Analisis Tren",      helper: "Grafik mutasi, saldo, dan tren keuangan",             icon: BarChart3,   active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", idle: "bg-indigo-50 text-indigo-600" },
    { key: "memo",      label: "Analisa 5C",         helper: "Fasilitas, 5C, sumber pembayaran, dan status",        icon: PencilLine,  active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", idle: "bg-amber-50 text-amber-600" },
  ];

  const printSummary = () => handlePrint(summary, rating, notes, netFlow, profile, memo, {
    ewsTier,
    coverage: [
      { label: "Bank Statement", has: summary.bank_statement_count > 0 },
      { label: "Profit & Loss",  has: summary.profit_loss_count > 0 },
      { label: "Cash Flow",      has: summary.cash_flow_count > 0 },
      { label: "Balance Sheet",  has: summary.balance_sheet_count > 0 },
      { label: "SLIK / IDEB",    has: slikReports.length > 0 },
    ],
    pnlComparison,
    bsComparison,
    monthlyData,
    derivedRatios,
    scoringAspects,
    debtEntries,
    dscrCicilanBaru,
    creditScore,
    slikDerived,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <UploadDocumentModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          selectedDocType={selectedDocType}
          companyId={id}
          onComplete={() => {
            fetchData();
            setDocumentFilter(selectedDocType);
          }}
        />

        <FinancialDocumentModal
          doc={selectedPnlDoc}
          onClose={() => setSelectedPnlDoc(null)}
          reparsingId={reparsingId}
          onReparse={handleReparse}
        />

        <CompanyHeader
          company={company}
          totalTransactions={summary.total_transactions}
          documentCount={summary.document_count}
          rating={rating}
          ratingMeta={ratingMeta}
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <LeftNavigationPanel
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <UploadDocumentPanel
              selectedDocType={selectedDocType}
              onDocTypeSelect={(type) => {
                setSelectedDocType(type);
                setDocumentFilter(type);
                setActiveTab("dokumen");
                setDocView(type === "bank_statement" ? "kalender" : "tabel");
              }}
            />
            <DocumentStatsPanel
              bankStatementCount={summary.bank_statement_count}
              profitLossCount={summary.profit_loss_count}
              cashFlowCount={summary.cash_flow_count}
              balanceSheetCount={summary.balance_sheet_count}
              otherDocumentCount={summary.other_document_count}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {activeTab === "profil" && (
              <ProfileTab
                company={company}
                profile={profile}
                setProfileField={setProfileField}
                saveProfile={saveProfile}
                legalDocs={legalDocs}
                legalUploading={legalUploading}
                handleLegalDocUpload={handleLegalDocUpload}
                removeLegalDoc={removeLegalDoc}
                approvers={approvers}
                updateApprover={updateApprover}
              />
            )}

            {activeTab === "ringkasan" && (
              <CreditSummaryTab
                summary={summary}
                company={company}
                profile={profile}
                memo={memo}
                rating={rating}
                ratingMeta={ratingMeta}
                creditScore={creditScore}
                ewsTier={ewsTier}
                netFlow={netFlow}
                entityType={entityType}
                lamaBerdiri={lamaBerdiri}
                slikDerived={slikDerived}
                slikReports={slikReports}
                cbiReports={cbiReports}
                pnlComparison={pnlComparison}
                bsComparison={bsComparison}
                derivedRatios={derivedRatios}
                monthlyData={monthlyData}
                notes={notes}
                saveNotes={saveNotes}
                printSummary={printSummary}
                debtEntries={debtEntries}
                scoringAspects={scoringAspects}
                dscrCicilanBaru={dscrCicilanBaru}
                updateDscrCicilanBaru={updateDscrCicilanBaru}
                addDebtEntry={addDebtEntry}
                updateDebtEntry={updateDebtEntry}
                removeDebtEntry={removeDebtEntry}
                updateScoringAspect={updateScoringAspect}
              />
            )}

            {activeTab === "dokumen" && (
              <DocumentsTab
                visibleStatements={visibleStatements}
                byYearMonth={byYearMonth}
                calYears={calYears}
                documentFilter={documentFilter}
                setDocumentFilter={setDocumentFilter}
                docView={docView}
                setDocView={setDocView}
                calYear={calYear}
                setCalYear={setCalYear}
                deletingId={deletingId}
                reparsingId={reparsingId}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                handleDelete={handleDelete}
                handleReparse={handleReparse}
                fetchData={fetchData}
                openUploadModal={openUploadModal}
                setSelectedPnlDoc={setSelectedPnlDoc}
              />
            )}

            {activeTab === "memo" && (
              <CreditMemoTab
                company={company}
                memo={memo}
                setMemoField={setMemoField}
                saveMemo={saveMemo}
                addCollateral={addCollateral}
                updateCollateral={updateCollateral}
                removeCollateral={removeCollateral}
              />
            )}

            {activeTab === "grafik" && (
              <TrendAnalysisTab
                chartPeriod={chartPeriod}
                setChartPeriod={setChartPeriod}
                txLoading={txLoading}
                mounted={mounted}
                filteredDaily={filteredDaily}
                filteredMonthly={filteredMonthly}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
