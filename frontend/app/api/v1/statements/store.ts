/**
 * In-memory store for mock statements (dev/demo mode).
 * Replace with real DB calls when backend is running.
 */
import { v4 as uuidv4 } from "uuid";

export type StatementStatus = "queued" | "parsing" | "done" | "needs_review" | "failed";

export interface MockStatement {
  id: string;
  company_id: string | null;
  document_type: "bank_statement" | "profit_loss" | "cash_flow" | "balance_sheet" | "other";
  original_filename: string;
  bank_code: string | null;
  bank_name: string | null;
  account_no_masked: string | null;
  account_holder: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  status: StatementStatus;
  is_reconciled: boolean;
  reconciliation_delta: number | null;
  is_scanned: boolean;
  detection_confidence: number | null;
  page_count?: number | null;
  parse_meta?: Record<string, unknown> | null;
  parse_error: string | null;
  created_at: string;
  parsed_at: string | null;
}

// Shared in-process store (survives hot reloads in dev)
const g = globalThis as typeof globalThis & { _stmtStore?: Map<string, MockStatement> };
if (!g._stmtStore) g._stmtStore = new Map();
export const store = g._stmtStore;

export interface MockTransaction {
  id: string;
  statement_id: string;
  row: number;
  date: string;
  value_date: string;
  description_raw: string;
  description_normalized: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  category: string | null;
  flags: string[];
  confidence: number;
  source: string;
  is_low_confidence: boolean;
  is_manually_corrected: boolean;
}

const tg = globalThis as typeof globalThis & { _txnStore?: Map<string, MockTransaction[]> };
if (!tg._txnStore) tg._txnStore = new Map();
export const transactionStore = tg._txnStore;

type MockDocumentType = MockStatement["document_type"];

function detectBank(filename: string): { code: string; name: string } {
  const f = filename.toLowerCase();
  if (f.includes("bca")) return { code: "BCA", name: "Bank Central Asia" };
  if (f.includes("mandiri")) return { code: "MDR", name: "Bank Mandiri" };
  if (f.includes("bri")) return { code: "BRI", name: "Bank Rakyat Indonesia" };
  if (f.includes("bni")) return { code: "BNI", name: "Bank Negara Indonesia" };
  if (f.includes("btn")) return { code: "BTN", name: "Bank Tabungan Negara" };
  return { code: "BCA", name: "Bank Central Asia" };
}

function mockPnlParseMeta() {
  const periods = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  const summaries = {
    revenue: { "2026-01": 506033580, "2026-02": 858973366, "2026-03": 530978020, "2026-04": 694799246, "2026-05": 755966488, total: 3346750700 },
    cost_of_goods_sold: { "2026-01": 147052403, "2026-02": 857105285, "2026-03": 736595731, "2026-04": 628062760, "2026-05": 680480278, total: 3049296457 },
    gross_profit: { "2026-01": 358981177, "2026-02": 1868081, "2026-03": -205617711, "2026-04": 66736486, "2026-05": 75486210, total: 297454243 },
    operating_expense: { "2026-01": 70744585, "2026-02": 31239718, "2026-03": 31378396, "2026-04": 74050055, "2026-05": 66292488, total: 273705242 },
    operating_profit: { "2026-01": 288236592, "2026-02": -29371637, "2026-03": -236996107, "2026-04": -7313569, "2026-05": 9193722, total: 23749001 },
    non_operating: { "2026-01": -31255570, "2026-02": -13524877, "2026-03": -15882486, "2026-04": -138228283, "2026-05": -15247474, total: -214138690 },
    net_income: { "2026-01": 256981022, "2026-02": -42896514, "2026-03": -252878593, "2026-04": -145541852, "2026-05": -6053752, total: -190389689 },
  };

  const line_items = Object.entries({
    "Jumlah Pendapatan": summaries.revenue,
    "Jumlah Beban Pokok Penjualan": summaries.cost_of_goods_sold,
    "LABA KOTOR": summaries.gross_profit,
    "Jumlah Beban Operasional": summaries.operating_expense,
    "PENDAPATAN OPERASIONAL": summaries.operating_profit,
    "Jumlah Pendapatan dan Beban Non Operasional": summaries.non_operating,
    "LABA BERSIH": summaries.net_income,
  }).map(([description, values]) => ({
    description,
    section: "",
    values: Object.fromEntries(periods.map((period) => [period, values[period as keyof typeof values]])),
    total: values.total,
    is_total: true,
  }));

  return {
    page_count: 2,
    parser: "pnl_parsing",
    summary: summaries,
    pnl: {
      company_name: "PT Mitra Daksa Anarawata",
      report_title: "Laba/Rugi (Multi Periode)",
      period_start: "2026-01",
      period_end: "2026-05",
      branch: "[All Branch]",
      currency: "Indonesian Rupiah",
      periods,
      line_items,
      summaries,
      raw_pages: 2,
    },
  };
}

export function applyMockProfitLossParse(stmt: MockStatement): MockStatement {
  const now = new Date().toISOString();
  Object.assign(stmt, {
    document_type: "profit_loss",
    bank_code: null,
    bank_name: null,
    period_start: "2026-01-01",
    period_end: "2026-05-31",
    currency: "IDR",
    status: "done" as StatementStatus,
    page_count: 2,
    parse_meta: mockPnlParseMeta(),
    parse_error: null,
    parsed_at: now,
  });
  return stmt;
}

export function createStatement(
  filename: string,
  options: { companyId?: string | null; documentType?: MockDocumentType } = {}
): MockStatement {
  const id = uuidv4();
  const bank = detectBank(filename);
  const now = new Date().toISOString();
  const documentType = options.documentType ?? "bank_statement";
  const isProfitLoss = documentType === "profit_loss";
  const stmt: MockStatement = {
    id,
    company_id: options.companyId ?? null,
    document_type: documentType,
    original_filename: filename,
    bank_code: isProfitLoss ? null : bank.code,
    bank_name: isProfitLoss ? null : bank.name,
    account_no_masked: null,
    account_holder: null,
    period_start: null,
    period_end: null,
    currency: "IDR",
    opening_balance: null,
    closing_balance: null,
    status: isProfitLoss ? "done" : "queued",
    is_reconciled: false,
    reconciliation_delta: null,
    is_scanned: false,
    detection_confidence: null,
    page_count: isProfitLoss ? 2 : 12,
    parse_meta: null,
    parse_error: null,
    created_at: now,
    parsed_at: null,
  };
  if (isProfitLoss) applyMockProfitLossParse(stmt);
  store.set(id, stmt);

  if (documentType !== "bank_statement") return stmt;

  // Simulate async parsing: queued → parsing → done after delay
  setTimeout(() => {
    const s = store.get(id);
    if (s) { s.status = "parsing"; store.set(id, s); }
  }, 800);

  setTimeout(() => {
    const s = store.get(id);
    if (!s) return;
    const now2 = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const periodEnd = new Date();
    Object.assign(s, {
      status: "done",
      account_no_masked: "xxxxxx4521",
      account_holder: "PT Contoh Nasabah",
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      opening_balance: 12_500_000,
      closing_balance: 8_750_000,
      is_reconciled: true,
      reconciliation_delta: 0,
      detection_confidence: 0.97,
      page_count: s.page_count ?? 12,
      parsed_at: now2,
    });
    store.set(id, s);
  }, 3000);

  return stmt;
}

function seedMockTransactions() {
  return [
    { row: 1, date: "2026-01-02", description_raw: "GAJI JANUARI PT MAJU BERSAMA", credit: 8_500_000, debit: null, balance: 21_000_000, category: "income_salary", flags: [], confidence: 0.99, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 2, date: "2026-01-03", description_raw: "TRSF E-BANKING DB SHOPEE PAY", credit: null, debit: 450_000, balance: 20_550_000, category: "ewallet_topup", flags: [], confidence: 0.97, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 3, date: "2026-01-05", description_raw: "ATM TARIK TUNAI", credit: null, debit: 1_000_000, balance: 19_550_000, category: "cash_withdrawal", flags: [], confidence: 0.98, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 4, date: "2026-01-07", description_raw: "TRANSFER KREDIVO PINJAMAN CAIR", credit: 3_000_000, debit: null, balance: 22_550_000, category: "loan_disbursement", flags: ["pinjol"], confidence: 0.91, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 5, date: "2026-01-08", description_raw: "TOPUP SALDO GAME SLOT OLYMPUS", credit: null, debit: 500_000, balance: 22_050_000, category: "unknown", flags: ["judol"], confidence: 0.88, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 6, date: "2026-01-09", description_raw: "BIAYA ADMIN BULANAN", credit: null, debit: 15_000, balance: 22_035_000, category: "admin_fee", flags: [], confidence: 0.99, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 7, date: "2026-01-10", description_raw: "CICILAN AKULAKU 1/12", credit: null, debit: 750_000, balance: 21_285_000, category: "loan_repayment", flags: ["pinjol"], confidence: 0.90, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 8, date: "2026-01-12", description_raw: "TRSF E-BANKING CR ANDI SUSANTO", credit: 500_000, debit: null, balance: 21_785_000, category: "income_transfer", flags: [], confidence: 0.95, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 9, date: "2026-01-15", description_raw: "TRANSFER KE REK 1234567890", credit: null, debit: 5_000_000, balance: 16_785_000, category: "transfer_out", flags: [], confidence: 0.96, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 10, date: "2026-01-16", description_raw: "TRANSFER MASUK SETELAH TRANSFER KELUAR CEPAT", credit: 4_900_000, debit: null, balance: 21_685_000, category: "income_transfer", flags: ["passthrough"], confidence: 0.72, source: "adapter", is_low_confidence: true, is_manually_corrected: false },
    { row: 11, date: "2026-01-17", description_raw: "TRANSFER KELUAR SEGERA", credit: null, debit: 4_850_000, balance: 16_835_000, category: "transfer_out", flags: ["passthrough"], confidence: 0.72, source: "adapter", is_low_confidence: true, is_manually_corrected: false },
    { row: 12, date: "2026-01-20", description_raw: "PEMBAYARAN LISTRIK PLN", credit: null, debit: 350_000, balance: 16_485_000, category: "utility", flags: [], confidence: 0.99, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 13, date: "2026-01-22", description_raw: "SLOT WIN WITHDRAW PRAGMATIC", credit: 200_000, debit: null, balance: 16_685_000, category: "unknown", flags: ["judol"], confidence: 0.93, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 14, date: "2026-01-25", description_raw: "BELANJA TOKOPEDIA", credit: null, debit: 1_200_000, balance: 15_485_000, category: "retail_purchase", flags: [], confidence: 0.96, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 15, date: "2026-01-28", description_raw: "CICILAN JULO FINANCE 3/6", credit: null, debit: 800_000, balance: 14_685_000, category: "loan_repayment", flags: ["pinjol"], confidence: 0.89, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 16, date: "2026-01-30", description_raw: "DEBIT RETURNED INSUFFICIENT FUND", credit: null, debit: 250_000, balance: 14_435_000, category: "unknown", flags: ["rejected"], confidence: 0.94, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
    { row: 17, date: "2026-01-31", description_raw: "TRSF E-BANKING DB GRAB", credit: null, debit: 85_000, balance: 14_350_000, category: "retail_purchase", flags: [], confidence: 0.98, source: "adapter", is_low_confidence: false, is_manually_corrected: false },
  ];

}

// Demo transactions seeded per statement
export function getMockTransactions(statementId: string) {
  const stmt = store.get(statementId);
  if (!stmt) return [];

  if (!transactionStore.has(statementId)) {
    transactionStore.set(statementId, seedMockTransactions().map((t) => ({
      id: `${statementId}-row-${t.row}`,
      statement_id: statementId,
      value_date: t.date,
      description_normalized: null,
      ...t,
    })));
  }

  return transactionStore.get(statementId) ?? [];
}

export function patchMockTransaction(statementId: string, row: number, patch: Partial<MockTransaction>) {
  const txns = getMockTransactions(statementId);
  const idx = txns.findIndex((txn) => txn.row === row);
  if (idx < 0) return null;

  const updated = {
    ...txns[idx],
    ...patch,
    confidence: 1,
    is_low_confidence: false,
    is_manually_corrected: true,
    source: "manual",
  };
  txns[idx] = updated;
  transactionStore.set(statementId, txns);
  return updated;
}

export function getMockTransaction(statementId: string, row: number) {
  return getMockTransactions(statementId).find((txn) => txn.row === row) ?? null;
}

export function getMockRisk(statementId: string) {
  return {
    id: `risk-${statementId}`,
    statement_id: statementId,
    total_credit: 17_100_000,
    total_debit: 15_250_000,
    net_flow: 1_850_000,
    avg_daily_balance: 18_400_000,
    min_balance: 14_350_000,
    max_balance: 22_550_000,
    days_below_threshold: 0,
    negative_balance_days: 0,
    transaction_count: 17,
    estimated_monthly_income: 8_500_000,
    estimated_monthly_obligations: 1_550_000,
    dsr: 0.182,
    flags: {
      judol: { flag_type: "judol", severity: "high", count: 3, total_amount: 700_000, supporting_rows: [5, 13], description: "Terdeteksi 2 transaksi indikasi judi online (judol). Total: Rp700.000", confidence: 0.91 },
      pinjol: { flag_type: "pinjol", severity: "high", count: 3, total_amount: 3_000_000, supporting_rows: [4, 7, 15], description: "Terdeteksi 1 pencairan pinjol & 2 cicilan. Indikasi over-indebtedness.", confidence: 0.90 },
      passthrough: { flag_type: "passthrough", severity: "high", count: 2, total_amount: null, supporting_rows: [10, 11], description: "Terdeteksi 2 pola passthrough: dana masuk lalu keluar ≥85% dalam 3 hari.", confidence: 0.75 },
      rejected: { flag_type: "rejected", severity: "medium", count: 1, total_amount: null, supporting_rows: [16], description: "Terdeteksi 1 transaksi ditolak/gagal.", confidence: 1.0 },
    },
    flag_count: 4,
    has_judol: true,
    has_pinjol: true,
    has_passthrough: true,
    risk_score: null,
    category_summary: {
      income_salary: "8500000",
      income_transfer: "5400000",
      loan_disbursement: "3000000",
      transfer_out: "-9850000",
      loan_repayment: "-1550000",
      ewallet_topup: "-450000",
      cash_withdrawal: "-1000000",
      retail_purchase: "-1285000",
      utility: "-350000",
      admin_fee: "-15000",
      unknown: "-300000",
    },
    created_at: new Date().toISOString(),
  };
}
