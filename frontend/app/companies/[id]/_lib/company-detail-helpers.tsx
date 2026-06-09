import type { Statement, DocumentType, CompanySummary, SlikReport, CbiReport } from "@/lib/api";
import type { CreditMemo, Collateral } from "@/lib/localData";
import type {
  PnlReport, BalanceSheetReport, CashFlowReport,
  Rating, CreditScoreBreakdown,
} from "./company-detail-types";

// ── Financial report parsers ──────────────────────────────────────────────────

export function getPnlReport(doc: Statement | null): PnlReport | null {
  const pnl = doc?.parse_meta?.pnl;
  return pnl && typeof pnl === "object" ? pnl as PnlReport : null;
}

export function getBalanceSheetReport(doc: Statement | null): BalanceSheetReport | null {
  const report = doc?.parse_meta?.balance_sheet ?? doc?.parse_meta?.bs;
  return report && typeof report === "object" ? report as BalanceSheetReport : null;
}

export function getCashFlowReport(doc: Statement | null): CashFlowReport | null {
  const report = doc?.parse_meta?.cash_flow ?? doc?.parse_meta?.cf;
  return report && typeof report === "object" ? report as CashFlowReport : null;
}

export function documentTableHeaders(filter: DocumentType | "all"): string[] {
  if (filter === "profit_loss")  return ["Nama File", "Periode", "Pendapatan", "Laba Bersih", "Status", "Aksi"];
  if (filter === "cash_flow")    return ["Nama File", "Periode", "Status Balance", "Cash Akhir", "Status", "Aksi"];
  if (filter === "balance_sheet") return ["Nama File", "Periode", "Status Balance", "Total Aset", "Status", "Aksi"];
  return ["Nama File", "Periode", "Indikator", "Nilai Utama", "Status", "Aksi"];
}

// ── Credit scoring model (5-dimensi, 100 poin) ────────────────────────────────

export function computeCreditScore(
  summary: CompanySummary,
  statements: Statement[],
  slikReports: SlikReport[],
  collaterals: Collateral[],
  loanAmount: number,
  cbiReports: CbiReport[] = [],
): CreditScoreBreakdown {
  const failRate     = summary.document_count > 0 ? summary.failed_uploads / summary.document_count : 0;
  const netFlow      = Number(summary.total_credit) - Number(summary.total_debit);
  const totalCredit  = Number(summary.total_credit);
  const hasSuccess   = summary.successful_uploads > 0;
  const anyReconciled = statements.some((s) => s.is_reconciled);

  // Karakter / Kualitatif (5 poin)
  const karakter = hasSuccess
    ? (failRate === 0 ? 5 : failRate < 0.1 ? 4 : failRate < 0.2 ? 3 : failRate < 0.4 ? 2 : 1)
    : 0;

  // Cashflow Bank Statement (25 poin)
  const netRatio = totalCredit > 0 ? netFlow / totalCredit : 0;
  const cashflow = !hasSuccess ? 0
    : netFlow < 0     ? 5
    : netRatio < 0.02 ? 10
    : netRatio < 0.05 ? 15
    : netRatio < 0.15 ? 20
    : 25;

  // Keuangan (40 poin) — proxy dari rekonsiliasi + volume saat P&L/BS belum ada
  const keuangan = !hasSuccess ? 0
    : anyReconciled
      ? (failRate === 0 && netRatio >= 0.1 ? 35 : failRate === 0 ? 28 : netRatio >= 0.05 ? 22 : 15)
      : (failRate === 0 && netRatio >= 0.05 ? 20 : failRate < 0.1 ? 14 : 8);

  // Kolektibilitas SLIK + CBI (20 poin)
  let slik = 10;
  let slikDefault = true;
  const allFasSlik = slikReports.flatMap((r) => r.parsed_data?.fasilitas ?? []);
  const allFasCbi  = cbiReports.flatMap((r) => r.parsed_data?.fasilitas_aktif ?? []);
  const allFas = [
    ...allFasSlik.map((f) => ({ kol: parseInt(f.kualitas.replace(/\D/g, ""), 10), baki: f.baki_debet })),
    ...allFasCbi.map((f)  => ({ kol: parseInt(f.kolektabilitas.replace(/\D/g, ""), 10), baki: f.baki_debet })),
  ];
  if (allFas.length > 0) {
    slikDefault = false;
    const worstKol = allFas.reduce((w, f) => (isNaN(f.kol) ? w : Math.max(w, f.kol)), 1);
    slik = worstKol === 1 ? 20 : worstKol === 2 ? 15 : worstKol === 3 ? 8 : worstKol === 4 ? 4 : 0;
    const jmlKreditur = (slikReports[0]?.jumlah_kreditur ?? allFasSlik.length) +
      (cbiReports[0]?.jumlah_kreditur_aktif ?? 0);
    if (worstKol <= 2 && jmlKreditur <= 3) slik = Math.min(20, slik + 2);
  }

  // Agunan (10 poin) — dari collateral registry memo kredit
  let agunan = 5;
  let agunanDefault = true;
  if (collaterals.length > 0 && loanAmount > 0) {
    agunanDefault = false;
    const totalLiq = collaterals.reduce((s, c) => s + c.liquidationValue, 0);
    const coverage = totalLiq / loanAmount;
    agunan = coverage >= 1.5 ? 10 : coverage >= 1.2 ? 8 : coverage >= 1.0 ? 6 : coverage >= 0.8 ? 4 : 2;
  }

  const total = karakter + cashflow + keuangan + slik + agunan;
  const rating: Rating = total >= 85 ? "AAA" : total >= 70 ? "AA" : total >= 55 ? "A" : total >= 40 ? "B" : total >= 25 ? "C" : total >= 10 ? "D" : "E";

  return { karakter, cashflow, keuangan, slik, agunan, total, rating, slikDefault, agunanDefault };
}

// ── Memo factory ──────────────────────────────────────────────────────────────

export function emptyCompanyMemo(companyId: string): CreditMemo {
  return {
    companyId,
    loanPurpose: "",
    loanAmount: 0,
    tenor: 12,
    facilityType: "KMK",
    proposedRate: 10,
    repaymentSource: "",
    conditions: "",
    characterScore: 3,
    characterNotes: "",
    capacityScore: 3,
    capacityNotes: "",
    capitalScore: 3,
    capitalNotes: "",
    collateralScore: 3,
    collateralNotes: "",
    conditionScore: 3,
    conditionNotes: "",
    collaterals: [],
    status: "draft",
    analystName: "",
    analystDate: "",
    checkerName: "",
    checkerNotes: "",
    checkerDate: "",
    committeeDecision: "",
    committeeDate: "",
    updatedAt: new Date().toISOString(),
  };
}

// ── Growth badge (JSX) ────────────────────────────────────────────────────────

export function growthBadge(pct: number | null | undefined) {
  if (pct == null) return <span className="text-slate-300 text-[10px]">—</span>;
  const pos = pct >= 0;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${pos ? "text-emerald-600" : "text-red-600"}`}>
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}
