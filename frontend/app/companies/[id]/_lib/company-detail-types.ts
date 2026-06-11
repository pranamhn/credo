// ── Financial report line items ──────────────────────────────────────────────

export interface PnlLineItem {
  description: string;
  section?: string;
  values?: Record<string, number>;
  total?: number | null;
  is_total?: boolean;
}

export interface PnlReport {
  company_name?: string;
  report_title?: string;
  period_start?: string;
  period_end?: string;
  branch?: string;
  currency?: string;
  periods?: string[];
  line_items?: PnlLineItem[];
  summaries?: Record<string, Record<string, number>>;
  raw_pages?: number;
}

export interface BalanceSheetLineItem {
  description: string;
  section?: string;
  subsection?: string;
  account_group?: string;
  values?: Record<string, number>;
  is_total?: boolean;
}

export interface BalanceSheetReport {
  company_name?: string;
  report_title?: string;
  period_start?: string;
  period_end?: string;
  currency?: string;
  periods?: string[];
  line_items?: BalanceSheetLineItem[];
  summaries?: Record<string, Record<string, number>>;
  balance_checks?: { period: string; delta?: number | null; balanced?: boolean }[];
  raw_pages?: number;
}

export interface CashFlowLineItem {
  description: string;
  section?: string;
  subsection?: string;
  amount?: number;
  is_total?: boolean;
}

export interface CashFlowReport {
  company_name?: string;
  report_title?: string;
  period_start?: string;
  period_end?: string;
  branch?: string;
  line_items?: CashFlowLineItem[];
  summaries?: Record<string, number>;
  cash_check?: { delta?: number | null; balanced?: boolean };
  raw_pages?: number;
}

// ── Credit scoring ────────────────────────────────────────────────────────────

export type Rating = "AAA" | "AA" | "A" | "B" | "C" | "D" | "E";

export interface CreditScoreBreakdown {
  karakter: number;
  cashflow: number;
  keuangan: number;
  slik: number;
  agunan: number;
  total: number;
  rating: Rating;
  slikDefault: boolean;
  agunanDefault: boolean;
}

// ── UI state ─────────────────────────────────────────────────────────────────

export type ActiveTab = "profil" | "ringkasan" | "dokumen" | "grafik";

// ── Memo 5C field key types ───────────────────────────────────────────────────

export type MemoScoreKey = "characterScore" | "capacityScore" | "capitalScore" | "collateralScore" | "conditionScore";
export type MemoNotesKey = "characterNotes" | "capacityNotes" | "capitalNotes" | "collateralNotes" | "conditionNotes";

// ── Chart / transaction data ──────────────────────────────────────────────────

export interface DailyData  { date: string; credit: number; debit: number; balance: number }
export interface MonthlyData { month: string; credit: number; debit: number; balance: number }
