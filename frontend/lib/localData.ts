// Shared types and localStorage utilities for credit analysis features
// All data is stored client-side; replace storage layer with API calls when backend is ready

export interface FinancialYear {
  year: number;
  // Laporan Laba Rugi
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  depreciation: number;
  interestExpense: number;
  taxExpense: number;
  netIncome: number;
  // Neraca — Aset
  cash: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets: number;
  fixedAssets: number;
  otherLongTermAssets: number;
  // Neraca — Kewajiban & Ekuitas
  accountsPayable: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  longTermDebt: number;
  otherLongTermLiabilities: number;
  equity: number;
}

export interface FinancialRatios {
  currentRatio: number;
  quickRatio: number;
  der: number;
  dar: number;
  grossMargin: number;
  ebitdaMargin: number;
  netProfitMargin: number;
  roa: number;
  roe: number;
  interestCoverage: number;
  dscr: number;
  // Derived totals
  grossProfit: number;
  ebitda: number;
  ebit: number;
  currentAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  currentLiabilities: number;
}

export interface Collateral {
  id: string;
  type: string;
  description: string;
  marketValue: number;
  liquidationValue: number;
  ltvLimit: number;
  legalStatus: "clear" | "in_progress" | "dispute";
  appraisalDate: string;
}

export interface CreditMemo {
  companyId: string;
  loanPurpose: string;
  loanAmount: number;
  tenor: number;
  facilityType: string;
  proposedRate: number;
  repaymentSource: string;
  conditions: string;
  // 5C
  characterScore: number;  characterNotes: string;
  capacityScore: number;   capacityNotes: string;
  capitalScore: number;    capitalNotes: string;
  collateralScore: number; collateralNotes: string;
  conditionScore: number;  conditionNotes: string;
  collaterals: Collateral[];
  // Workflow
  status: "draft" | "diajukan" | "review" | "komite" | "disetujui" | "ditolak";
  analystName: string; analystDate: string;
  checkerName: string; checkerNotes: string; checkerDate: string;
  committeeDecision: string; committeeDate: string;
  updatedAt: string;
}

export interface Covenant {
  id: string;
  type: "financial" | "non_financial";
  description: string;
  threshold: string;
  actual: string;
  status: "ok" | "watch" | "breach";
  lastChecked: string;
}

export interface Installment {
  id: string;
  dueDate: string;
  principal: number;
  interest: number;
  paidDate: string | null;
  paidAmount: number | null;
  status: "lunas" | "pending" | "terlambat" | "macet";
}

export interface LoanFacility {
  id: string;
  companyId: string;
  companyName: string;
  facilityName: string;
  facilityType: string;
  plafon: number;
  outstanding: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  kolektibilitas: 1 | 2 | 3 | 4 | 5;
  lastPaymentDate: string;
  dpd: number;
  covenants: Covenant[];
  installments: Installment[];
}

export interface WatchlistEntry {
  id: string;
  companyId: string;
  companyName: string;
  ewsTier: "kuning" | "merah";
  reasons: string[];
  addedDate: string;
  actionPlan: string;
  targetDate: string;
  assignee: string;
  notes: string;
}

// ── localStorage helpers ──

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

function setLS<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export const localData = {
  getLapkeu:     (id: string) => getLS<FinancialYear[]>(`credo-lapkeu-${id}`, []),
  saveLapkeu:    (id: string, v: FinancialYear[]) => setLS(`credo-lapkeu-${id}`, v),
  getMemo:       (id: string) => getLS<CreditMemo | null>(`credo-memo-${id}`, null),
  saveMemo:      (id: string, v: CreditMemo) => setLS(`credo-memo-${id}`, v),
  getLoans:      () => getLS<LoanFacility[]>("credo-loans", []),
  saveLoans:     (v: LoanFacility[]) => setLS("credo-loans", v),
  getWatchlist:  () => getLS<WatchlistEntry[]>("credo-watchlist", []),
  saveWatchlist: (v: WatchlistEntry[]) => setLS("credo-watchlist", v),
};

// ── Ratio computation ──

export function computeRatios(fy: FinancialYear, annualDebtService = 0): FinancialRatios {
  const safe = (n: number, d: number) => (d === 0 ? 0 : n / d);
  const grossProfit       = fy.revenue - fy.cogs;
  const ebitda            = grossProfit - fy.operatingExpenses + fy.depreciation;
  const ebit              = ebitda - fy.depreciation;
  const currentAssets     = fy.cash + fy.receivables + fy.inventory + fy.otherCurrentAssets;
  const totalAssets       = currentAssets + fy.fixedAssets + fy.otherLongTermAssets;
  const currentLiabilities = fy.accountsPayable + fy.shortTermDebt + fy.otherCurrentLiabilities;
  const totalLiabilities  = currentLiabilities + fy.longTermDebt + fy.otherLongTermLiabilities;
  return {
    currentRatio:      safe(currentAssets, currentLiabilities),
    quickRatio:        safe(currentAssets - fy.inventory, currentLiabilities),
    der:               safe(totalLiabilities, fy.equity),
    dar:               safe(totalLiabilities, totalAssets),
    grossMargin:       safe(grossProfit, fy.revenue) * 100,
    ebitdaMargin:      safe(ebitda, fy.revenue) * 100,
    netProfitMargin:   safe(fy.netIncome, fy.revenue) * 100,
    roa:               safe(fy.netIncome, totalAssets) * 100,
    roe:               safe(fy.netIncome, fy.equity) * 100,
    interestCoverage:  safe(ebit, fy.interestExpense),
    dscr:              annualDebtService > 0 ? safe(fy.netIncome + fy.depreciation, annualDebtService) : 0,
    grossProfit, ebitda, ebit, currentAssets, totalAssets, totalLiabilities, currentLiabilities,
  };
}

// ── EWS computation (from CompanySummary without extra fetch) ──

export function computeEWSTier(
  failedUploads: number,
  documentCount: number,
  totalCredit: number,
  totalDebit: number,
  latestStatus?: string,
): "hijau" | "kuning" | "merah" {
  const failRate = documentCount > 0 ? failedUploads / documentCount : 0;
  const netFlow  = totalCredit - totalDebit;
  let flags = 0;
  if (latestStatus === "failed") flags += 2;
  if (netFlow < 0) flags += 2;
  if (failRate > 0.4) flags += 1;
  if (failRate > 0.1) flags += 1;
  if (failedUploads > 0 && netFlow < totalCredit * 0.05) flags += 1;
  if (flags >= 3) return "merah";
  if (flags >= 1) return "kuning";
  return "hijau";
}

// ── CKPN provisi by kolektibilitas ──
export const CKPN_RATES: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.01, 2: 0.05, 3: 0.15, 4: 0.50, 5: 1.00,
};
