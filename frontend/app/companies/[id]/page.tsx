"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DropZone } from "@/components/upload/DropZone";
import { StatusBadge } from "@/components/statement/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { companiesApi, statementsApi, CompanySummary, Statement, DocumentType } from "@/lib/api";
import { localData, CreditMemo } from "@/lib/localData";
import { formatIDR, formatDate } from "@/lib/utils";
import {
  ArrowLeft, Building2, FileText, TrendingUp, TrendingDown,
  Scale, FileSpreadsheet, BarChart3, BookOpen, AlertTriangle,
  FolderOpen, Trash2, Printer, PencilLine, ShieldCheck, CalendarDays, List, RefreshCw, Save, Wallet, X, Upload, Eye,
  ScrollText, FileCheck,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from "recharts";
import { toast } from "sonner";

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
  cursor: { fill: "rgba(20,184,166,0.04)" },
};
const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };
const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

const docTypeInfo: Record<DocumentType, { label: string; icon: React.ComponentType<{ className?: string }>; active: string; idle: string }> = {
  bank_statement: { label: "Bank Statement",  icon: FileText,        active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-blue-50 text-blue-600" },
  profit_loss:    { label: "Profit & Loss",   icon: TrendingUp,      active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-emerald-50 text-emerald-600" },
  cash_flow:      { label: "Cash Flow",       icon: Scale,           active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-amber-50 text-amber-600" },
  balance_sheet:  { label: "Balance Sheet",   icon: FileSpreadsheet, active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-indigo-50 text-indigo-600" },
  other:          { label: "Dokumen Lain",    icon: BookOpen,        active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-slate-100 text-slate-500" },
  nib:            { label: "Dokumen NIB",     icon: ScrollText,      active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-sky-50 text-sky-600" },
  ahu:            { label: "Dokumen AHU",     icon: Building2,       active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-violet-50 text-violet-600" },
  akta:           { label: "Akta",            icon: FileCheck,       active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-rose-50 text-rose-600" },
};

const docBadge: Record<DocumentType, string> = {
  bank_statement: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  profit_loss:    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  cash_flow:      "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  balance_sheet:  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  other:          "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  nib:            "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  ahu:            "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  akta:           "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

interface PnlLineItem {
  description: string;
  section?: string;
  values?: Record<string, number>;
  total?: number | null;
  is_total?: boolean;
}

interface PnlReport {
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

interface BalanceSheetLineItem {
  description: string;
  section?: string;
  subsection?: string;
  account_group?: string;
  values?: Record<string, number>;
  is_total?: boolean;
}

interface BalanceSheetReport {
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

interface CashFlowLineItem {
  description: string;
  section?: string;
  subsection?: string;
  amount?: number;
  is_total?: boolean;
}

interface CashFlowReport {
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

const PNL_SUMMARY_LABELS: Record<string, string> = {
  revenue: "Pendapatan",
  cost_of_goods_sold: "Beban Pokok Penjualan",
  gross_profit: "Laba Kotor",
  operating_expense: "Beban Operasional",
  operating_profit: "Pendapatan Operasional",
  non_operating: "Non Operasional",
  net_income: "Laba Bersih",
};

const BS_SUMMARY_LABELS: Record<string, string> = {
  current_assets: "Aset Lancar",
  total_assets: "Total Aset",
  total_liabilities: "Total Liabilitas",
  total_equities: "Total Ekuitas",
};

const CF_SUMMARY_LABELS: Record<string, string> = {
  net_cash_from_operating: "Kas Operasi",
  net_cash_from_investing: "Kas Investasi",
  net_cash_from_financing: "Kas Pendanaan",
  ending_cash: "Kas Akhir",
};

function getPnlReport(doc: Statement | null): PnlReport | null {
  const pnl = doc?.parse_meta?.pnl;
  return pnl && typeof pnl === "object" ? pnl as PnlReport : null;
}

function getBalanceSheetReport(doc: Statement | null): BalanceSheetReport | null {
  const report = doc?.parse_meta?.balance_sheet ?? doc?.parse_meta?.bs;
  return report && typeof report === "object" ? report as BalanceSheetReport : null;
}

function getCashFlowReport(doc: Statement | null): CashFlowReport | null {
  const report = doc?.parse_meta?.cash_flow ?? doc?.parse_meta?.cf;
  return report && typeof report === "object" ? report as CashFlowReport : null;
}

function documentTableHeaders(filter: DocumentType | "all"): string[] {
  if (filter === "profit_loss") return ["Nama File", "Periode", "Pendapatan", "Laba Bersih", "Status", "Aksi"];
  if (filter === "cash_flow") return ["Nama File", "Periode", "Status Balance", "Cash Akhir", "Status", "Aksi"];
  if (filter === "balance_sheet") return ["Nama File", "Periode", "Status Balance", "Total Aset", "Status", "Aksi"];
  return ["Nama File", "Periode", "Indikator", "Nilai Utama", "Status", "Aksi"];
}

// CD2 — Risk rating
type Rating = "AA" | "A" | "B" | "C" | "D";
const RATING_META: Record<Rating, { label: string; desc: string; color: string; bg: string; ring: string }> = {
  AA: { label: "Sangat Rendah",   desc: "Tidak ada gagal upload, net flow positif, dokumen terverifikasi.", color: "text-emerald-700", bg: "bg-emerald-50",  ring: "ring-emerald-200" },
  A:  { label: "Rendah",          desc: "Tidak ada gagal upload dan net flow positif.",                     color: "text-teal-700",    bg: "bg-teal-50",     ring: "ring-teal-200" },
  B:  { label: "Sedang",          desc: "Ada sedikit masalah upload atau net flow mendekati nol.",          color: "text-blue-700",    bg: "bg-blue-50",     ring: "ring-blue-200" },
  C:  { label: "Tinggi",          desc: "Beberapa dokumen gagal atau net flow negatif.",                    color: "text-amber-700",   bg: "bg-amber-50",    ring: "ring-amber-200" },
  D:  { label: "Sangat Tinggi",   desc: "Banyak dokumen gagal atau tidak ada dokumen sukses.",              color: "text-red-700",     bg: "bg-red-50",      ring: "ring-red-200" },
};

function computeRiskRating(summary: CompanySummary, statements: Statement[]): Rating {
  const failRate   = summary.document_count > 0 ? summary.failed_uploads / summary.document_count : 0;
  const netFlow    = Number(summary.total_credit) - Number(summary.total_debit);
  const anyReconciled = statements.some((s) => s.is_reconciled);
  const hasSuccess = summary.successful_uploads > 0;
  if (!hasSuccess) return "D";
  if (failRate > 0.4 || netFlow < 0) return "C";
  if (failRate > 0.1 || netFlow < summary.total_credit * 0.05) return "B";
  if (anyReconciled) return "AA";
  return "A";
}

function handlePrint(summary: CompanySummary, rating: Rating, notes: string, netFlow: number) {
  const meta = RATING_META[rating];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan Analisis Kredit — ${summary.company.name}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #1e293b; padding: 40px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 10px; }
  .rating-badge { display: inline-block; font-size: 36px; font-weight: 900; padding: 8px 20px; border-radius: 12px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
  .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
  .metric-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
  .metric-value { font-size: 16px; font-weight: 700; color: #1e293b; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; font-size: 14px; color: #374151; white-space: pre-wrap; min-height: 80px; }
  .footer { color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 40px; }
</style></head><body>
<h1>${summary.company.name}</h1>
<p class="sub">Laporan Analisis Kredit · Dicetak ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
<div class="section">
  <div class="section-title">Rating Risiko Kredit (CREDO)</div>
  <div class="rating-badge">${rating}</div>
  <p style="color:#166534;font-weight:600;margin:4px 0">${meta.label}</p>
  <p style="color:#64748b;font-size:13px">${meta.desc}</p>
</div>
<div class="section">
  <div class="section-title">Ringkasan Keuangan</div>
  <div class="grid">
    <div class="metric"><div class="metric-label">Total Kredit</div><div class="metric-value">${formatIDR(Number(summary.total_credit))}</div></div>
    <div class="metric"><div class="metric-label">Total Debit</div><div class="metric-value">${formatIDR(Number(summary.total_debit))}</div></div>
    <div class="metric"><div class="metric-label">Net Flow</div><div class="metric-value">${netFlow >= 0 ? "+" : "−"}${formatIDR(Math.abs(netFlow))}</div></div>
    <div class="metric"><div class="metric-label">Jumlah Transaksi</div><div class="metric-value">${summary.total_transactions.toLocaleString("id-ID")}</div></div>
    <div class="metric"><div class="metric-label">Dokumen Berhasil</div><div class="metric-value">${summary.successful_uploads} dari ${summary.document_count}</div></div>
    <div class="metric"><div class="metric-label">Dokumen Gagal</div><div class="metric-value">${summary.failed_uploads}</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">Catatan Analis</div>
  <div class="notes-box">${notes || "(belum ada catatan)"}</div>
</div>
<div class="footer">Digenerate oleh CREDO · ${window.location.origin}</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up diblokir browser. Izinkan pop-up untuk export PDF."); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

interface DailyData  { date: string; credit: number; debit: number; balance: number }
interface MonthlyData { month: string; credit: number; debit: number; balance: number }

const FACILITY_TYPES = ["KMK", "KI", "KPR", "KUK", "Kredit Sindikasi", "Lainnya"];
const MEMO_STATUS: CreditMemo["status"][] = ["draft", "diajukan", "review", "komite", "disetujui", "ditolak"];
const MEMO_STATUS_LABEL: Record<CreditMemo["status"], string> = {
  draft: "Draft",
  diajukan: "Diajukan",
  review: "Review",
  komite: "Komite",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};
type MemoScoreKey = "characterScore" | "capacityScore" | "capitalScore" | "collateralScore" | "conditionScore";
const MEMO_SCORE_FIELDS: { label: string; key: MemoScoreKey }[] = [
  { label: "Character", key: "characterScore" },
  { label: "Capacity", key: "capacityScore" },
  { label: "Capital", key: "capitalScore" },
  { label: "Collateral", key: "collateralScore" },
  { label: "Condition", key: "conditionScore" },
];

function emptyCompanyMemo(companyId: string): CreditMemo {
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

type ActiveTab = "ringkasan" | "dokumen" | "grafik" | "memo";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("bank_statement");
  const [documentFilter, setDocumentFilter] = useState<DocumentType | "all">("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPnlDoc, setSelectedPnlDoc] = useState<Statement | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dokumen");
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [chartPeriod, setChartPeriod] = useState<3 | 6 | 12>(12); // CD6
  const [notes, setNotes] = useState("");
  const [memo, setMemo] = useState<CreditMemo>(() => emptyCompanyMemo(id));
  const [docView, setDocView] = useState<"tabel" | "kalender">("kalender");
  const [calYear, setCalYear] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    // CD3 — load notes from localStorage
    setNotes(localStorage.getItem(`company-notes-${id}`) ?? "");
    setMemo(localData.getMemo(id) ?? emptyCompanyMemo(id));
  }, [id]);

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(`company-notes-${id}`, val);
  };

  const setMemoField = <K extends keyof CreditMemo>(key: K, value: CreditMemo[K]) => {
    setMemo((prev) => ({ ...prev, [key]: value }));
  };

  const saveMemo = () => {
    const updated = { ...memo, updatedAt: new Date().toISOString() };
    setMemo(updated);
    localData.saveMemo(id, updated);
    toast.success("Memo kredit disimpan");
  };

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      const [summaryRes, statementsRes] = await Promise.all([
        companiesApi.get(id),
        companiesApi.statements(id),
      ]);
      setSummary(summaryRes.data);
      setStatements(statementsRes.data);
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

  const loadTransactionsData = useCallback(async (activeDocs: Statement[]) => {
    if (activeDocs.length === 0) { setDailyData([]); setMonthlyData([]); return; }
    setTxLoading(true);
    try {
      const results = await Promise.all(
        activeDocs.map((doc) => statementsApi.allTransactions(doc.id).then((txs) => ({ doc, txs })))
      );
      const dailyMap: Record<string, { credit: number; debit: number; balanceSamples: number[] }> = {};
      results.forEach(({ doc, txs }) => {
        const sorted = [...txs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row);
        let runningBalance: number | null = doc.opening_balance ?? null;
        if (runningBalance === null) {
          const firstWithBal = sorted.find((t) => t.balance != null);
          if (firstWithBal?.balance != null)
            runningBalance = Number(firstWithBal.balance) - Number(firstWithBal.credit || 0) + Number(firstWithBal.debit || 0);
        }
        const byDate: Record<string, typeof sorted> = {};
        sorted.forEach((t) => { if (!t.date) return; (byDate[t.date] ||= []).push(t); });
        Object.entries(byDate).forEach(([date, dayTxs]) => {
          if (!dailyMap[date]) dailyMap[date] = { credit: 0, debit: 0, balanceSamples: [] };
          let dayCredit = 0, dayDebit = 0;
          dayTxs.forEach((t) => { dayCredit += Number(t.credit || 0); dayDebit += Number(t.debit || 0); });
          dailyMap[date].credit += dayCredit;
          dailyMap[date].debit += dayDebit;
          const lastWithBal = [...dayTxs].reverse().find((t) => t.balance != null);
          if (lastWithBal?.balance != null) runningBalance = Number(lastWithBal.balance);
          else if (runningBalance !== null) runningBalance = runningBalance + dayCredit - dayDebit;
          if (runningBalance !== null) dailyMap[date].balanceSamples.push(runningBalance);
        });
        if (doc.closing_balance != null && doc.period_end) {
          const endDate = doc.period_end.slice(0, 10);
          if (!dailyMap[endDate]) dailyMap[endDate] = { credit: 0, debit: 0, balanceSamples: [] };
          if (dailyMap[endDate].balanceSamples.length === 0)
            dailyMap[endDate].balanceSamples.push(doc.closing_balance);
        }
      });
      const sortedDates = Object.keys(dailyMap).sort();
      let lastKnown = 0;
      const dailyAgg: DailyData[] = sortedDates.map((date) => {
        const d = dailyMap[date];
        const balance = d.balanceSamples.length > 0 ? d.balanceSamples.reduce((s, v) => s + v, 0) : 0;
        if (balance !== 0) lastKnown = balance;
        return { date, credit: d.credit, debit: d.debit, balance: balance !== 0 ? balance : lastKnown };
      });
      setDailyData(dailyAgg);
      const monthlyAgg: Record<string, { credit: number; debit: number; lastBalance: number }> = {};
      dailyAgg.forEach((day) => {
        const m = day.date.slice(0, 7);
        if (!monthlyAgg[m]) monthlyAgg[m] = { credit: 0, debit: 0, lastBalance: 0 };
        monthlyAgg[m].credit += day.credit;
        monthlyAgg[m].debit  += day.debit;
        monthlyAgg[m].lastBalance = day.balance;
      });
      setMonthlyData(Object.keys(monthlyAgg).sort().map((m) => ({
        month: m, credit: monthlyAgg[m].credit, debit: monthlyAgg[m].debit, balance: monthlyAgg[m].lastBalance,
      })));
    } catch (err) {
      console.error(err); toast.error("Gagal memproses analisis transaksi");
    } finally { setTxLoading(false); }
  }, []);

  useEffect(() => {
    const activeDocs = statements.filter(
      (s) => s.document_type === "bank_statement" && (s.status === "done" || s.status === "needs_review")
    );
    loadTransactionsData(activeDocs);
  }, [statements, loadTransactionsData]);

  // CD6 — filtered chart data by period
  const filteredMonthly = useMemo(() => {
    if (chartPeriod === 12) return monthlyData;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - chartPeriod);
    const cutoffStr = cutoff.toISOString().slice(0, 7);
    return monthlyData.filter((d) => d.month >= cutoffStr);
  }, [monthlyData, chartPeriod]);

  const filteredDaily = useMemo(() => {
    if (chartPeriod === 12) return dailyData;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - chartPeriod);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return dailyData.filter((d) => d.date >= cutoffStr);
  }, [dailyData, chartPeriod]);

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
  const netFlow   = Number(summary.total_credit) - Number(summary.total_debit);
  const rating    = computeRiskRating(summary, statements);
  const ratingMeta = RATING_META[rating];
  const averageBalance = dailyData.length > 0
    ? dailyData.reduce((sum, day) => sum + day.balance, 0) / dailyData.length
    : null;
  const selectedDocInfo = docTypeInfo[selectedDocType];
  const SelectedDocIcon = selectedDocInfo.icon;
  const selectedPnlReport = getPnlReport(selectedPnlDoc);
  const selectedBsReport = getBalanceSheetReport(selectedPnlDoc);
  const selectedCfReport = getCashFlowReport(selectedPnlDoc);
  const selectedPnlSummaries = selectedPnlReport?.summaries ?? {};
  const selectedPnlRows = selectedPnlReport?.line_items?.filter((item) => item.is_total) ?? [];
  const selectedBsSummaries = selectedBsReport?.summaries ?? {};
  const selectedBsLastPeriod = selectedBsReport?.periods?.at(-1);
  const selectedBsRows = selectedBsReport?.line_items?.filter((item) => item.is_total) ?? [];
  const selectedCfSummaries = selectedCfReport?.summaries ?? {};
  const selectedCfRows = selectedCfReport?.line_items ?? [];
  const selectedFinancialInfo = selectedPnlDoc ? docTypeInfo[selectedPnlDoc.document_type] : null;
  const SelectedFinancialIcon = selectedFinancialInfo?.icon ?? FileText;
  const selectedFinancialReport = selectedPnlReport ?? selectedBsReport ?? selectedCfReport;
  const openUploadModal = (type: DocumentType) => {
    setSelectedDocType(type);
    setDocumentFilter(type);
    setActiveTab("dokumen");
    setDocView(type === "bank_statement" ? "kalender" : "tabel");
    setUploadModalOpen(true);
  };

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "ringkasan", label: "Ringkasan Kredit" },
    { key: "dokumen",   label: "Dokumen" },
    { key: "grafik",    label: "Analisis Tren" },
    { key: "memo",      label: "Memo Kredit" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${selectedDocInfo.active}`}>
                    <SelectedDocIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-950">Upload {selectedDocInfo.label}</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      File akan disimpan sebagai dokumen {selectedDocInfo.label}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup upload modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <DropZone
                  companyId={id}
                  documentType={selectedDocType}
                  onComplete={() => {
                    fetchData();
                    setDocumentFilter(selectedDocType);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {selectedPnlDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${selectedFinancialInfo?.active ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                    <SelectedFinancialIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      {selectedFinancialReport?.company_name || selectedPnlDoc.original_filename}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {selectedFinancialReport?.report_title || selectedFinancialInfo?.label || "Dokumen"}
                      {selectedPnlDoc.period_start && selectedPnlDoc.period_end
                        ? ` · ${formatDate(selectedPnlDoc.period_start)} - ${formatDate(selectedPnlDoc.period_end)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPnlDoc(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup view dokumen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(88vh-73px)] overflow-y-auto p-5">
                {selectedPnlReport ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {["revenue", "gross_profit", "operating_profit", "net_income"].map((key) => {
                        const total = selectedPnlSummaries[key]?.total;
                        const negative = Number(total ?? 0) < 0;
                        return (
                          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {PNL_SUMMARY_LABELS[key]}
                            </p>
                            <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                              {formatIDR(total ?? null)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                          <tr>
                            <th className="min-w-[240px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Item
                            </th>
                            {(selectedPnlReport.periods ?? []).map((period) => (
                              <th key={period} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                {period}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPnlRows.map((item) => (
                            <tr key={item.description} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-4 py-3 font-semibold text-slate-800">{item.description}</td>
                              {(selectedPnlReport.periods ?? []).map((period) => {
                                const value = item.values?.[period] ?? null;
                                return (
                                  <td key={period} className={`whitespace-nowrap px-4 py-3 text-right text-xs font-semibold ${Number(value ?? 0) < 0 ? "text-red-600" : "text-slate-700"}`}>
                                    {formatIDR(value)}
                                  </td>
                                );
                              })}
                              <td className={`whitespace-nowrap px-4 py-3 text-right text-xs font-bold ${Number(item.total ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>
                                {formatIDR(item.total ?? null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedBsReport ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {["current_assets", "total_assets", "total_liabilities", "total_equities"].map((key) => {
                        const value = selectedBsLastPeriod ? selectedBsSummaries[key]?.[selectedBsLastPeriod] : null;
                        const negative = Number(value ?? 0) < 0;
                        return (
                          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {BS_SUMMARY_LABELS[key]}
                            </p>
                            <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                              {formatIDR(value ?? null)}
                            </p>
                            {selectedBsLastPeriod && <p className="mt-1 text-[10px] text-slate-400">{selectedBsLastPeriod}</p>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold text-slate-600">Balance check</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        selectedBsReport.balance_checks?.every((check) => check.balanced)
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                      }`}>
                        {selectedBsReport.balance_checks?.every((check) => check.balanced) ? "Balanced" : "Needs review"}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                          <tr>
                            <th className="min-w-[260px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Item
                            </th>
                            {(selectedBsReport.periods ?? []).map((period) => (
                              <th key={period} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                {period}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBsRows.map((item) => (
                            <tr key={`${item.section}-${item.description}`} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-800">{item.description}</p>
                                <p className="text-[10px] text-slate-400">{[item.section, item.subsection].filter(Boolean).join(" · ")}</p>
                              </td>
                              {(selectedBsReport.periods ?? []).map((period) => {
                                const value = item.values?.[period] ?? null;
                                return (
                                  <td key={period} className={`whitespace-nowrap px-4 py-3 text-right text-xs font-semibold ${Number(value ?? 0) < 0 ? "text-red-600" : "text-slate-700"}`}>
                                    {formatIDR(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedCfReport ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {["net_cash_from_operating", "net_cash_from_investing", "net_cash_from_financing", "ending_cash"].map((key) => {
                        const value = selectedCfSummaries[key] ?? null;
                        const negative = Number(value ?? 0) < 0;
                        return (
                          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {CF_SUMMARY_LABELS[key]}
                            </p>
                            <p className={`mt-2 truncate text-base font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>
                              {formatIDR(value)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold text-slate-600">Cash reconciliation</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        selectedCfReport.cash_check?.balanced
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                      }`}>
                        {selectedCfReport.cash_check?.balanced ? "Balanced" : "Needs review"}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                          <tr>
                            <th className="min-w-[320px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Item
                            </th>
                            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCfRows.map((item, idx) => (
                            <tr key={`${item.description}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-4 py-3">
                                <p className={`text-slate-800 ${item.is_total ? "font-bold" : "font-semibold"}`}>{item.description}</p>
                                <p className="text-[10px] text-slate-400">{[item.section, item.subsection].filter(Boolean).join(" · ")}</p>
                              </td>
                              <td className={`whitespace-nowrap px-4 py-3 text-right text-xs font-bold ${Number(item.amount ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>
                                {formatIDR(item.amount ?? null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-14 text-center">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="font-semibold text-slate-600">Hasil parser {selectedFinancialInfo?.label ?? "dokumen"} belum tersedia</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
                      Dokumen ini kemungkinan di-upload sebelum parser tersambung. Re-upload file atau jalankan reparse untuk mengisi hasil parsing.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleReparse(selectedPnlDoc.id);
                        setSelectedPnlDoc(null);
                      }}
                      disabled={reparsingId === selectedPnlDoc.id}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${reparsingId === selectedPnlDoc.id ? "animate-spin" : ""}`} />
                      Reparse {selectedFinancialInfo?.label ?? "Dokumen"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Company header */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Profil Perusahaan</p>
                <h1 className="mt-1 truncate text-xl font-bold leading-tight text-slate-950">{company.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    Dibuat {formatDate(company.created_at)}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{summary.document_count} dokumen</span>
                </div>
                {company.notes && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    {company.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 lg:w-[320px]">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Transaksi
                </div>
                <p className="mt-1 text-lg font-bold leading-none text-slate-900">
                  {summary.total_transactions.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="border-l border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Rating
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-lg font-black leading-none ${ratingMeta.color}`}>{rating}</span>
                  <span className="truncate text-[11px] font-semibold text-slate-500">{ratingMeta.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial metrics */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Kredit (Inflow)", value: formatIDR(Number(summary.total_credit)), icon: TrendingUp, color: "emerald" },
            { label: "Total Debit (Outflow)", value: formatIDR(Number(summary.total_debit)), icon: TrendingDown, color: "red" },
            { label: "Net Cash Flow", value: formatIDR(Math.abs(netFlow)), icon: Scale, color: netFlow >= 0 ? "emerald" : "red" },
            { label: "Saldo Rata-rata", value: formatIDR(averageBalance), icon: Wallet, color: "blue" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                <span>{label}</span>
                <Icon className={`h-4 w-4 ${
                  color === "emerald" ? "text-emerald-500" : color === "blue" ? "text-blue-500" : "text-red-500"
                }`} />
              </div>
              <p className={`text-xl font-bold ${
                color === "emerald" ? "text-emerald-600" : color === "blue" ? "text-blue-600" : "text-red-500"
              }`}>
                {netFlow < 0 && label.includes("Net") ? "−" : ""}{value}
              </p>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab.key
                    ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Upload panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Upload Dokumen Baru</p>
              <p className="text-xs text-slate-400 mb-4">Pilih tipe sebelum mengunggah file.</p>
              <div className="space-y-1.5 mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tipe Dokumen</p>
                <div className="grid gap-1.5">
                  {(Object.keys(docTypeInfo) as DocumentType[]).map((type) => {
                    const info = docTypeInfo[type];
                    const Icon = info.icon;
                    const isActive = selectedDocType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedDocType(type);
                          setDocumentFilter(type);
                          setActiveTab("dokumen");
                          setDocView(type === "bank_statement" ? "kalender" : "tabel");
                        }}
                        className={`flex items-center gap-3 w-full rounded-lg border p-2.5 text-left transition-all ${
                          isActive ? "border-teal-300 bg-teal-50 text-teal-800 shadow-sm"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        }`}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${isActive ? info.active : info.idle} ring-current/20`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{info.label}</p>
                          <p className={`text-[10px] ${isActive ? "text-teal-600" : "text-slate-400"}`}>
                            {type === "bank_statement" ? "Akan diparse transaksinya" : "Disimpan sebagai dokumen"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Statistik Dokumen</p>
              <div className="space-y-2">
                {[
                  ["Bank Statement",  summary.bank_statement_count,  "bg-blue-50 text-blue-700"],
                  ["Profit & Loss",   summary.profit_loss_count,     "bg-emerald-50 text-emerald-700"],
                  ["Cash Flow",       summary.cash_flow_count,        "bg-amber-50 text-amber-700"],
                  ["Balance Sheet",   summary.balance_sheet_count,    "bg-indigo-50 text-indigo-700"],
                  ["Lain-lain",       summary.other_document_count,   "bg-slate-100 text-slate-600"],
                ].map(([label, count, colorClass]) => (
                  <div key={String(label)} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 text-xs">{String(label)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${String(colorClass)}`}>
                      {String(count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* ── Ringkasan Kredit ── */}
            {activeTab === "ringkasan" && (
              <div className="p-6 space-y-5">
                {/* CD2 — Rating card */}
                <div className={`rounded-xl border px-6 py-5 ring-1 ${ratingMeta.ring} ${ratingMeta.bg} flex flex-col sm:flex-row items-start sm:items-center gap-5`}>
                  <div className="shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Rating Risiko</p>
                    <span className={`text-6xl font-black leading-none ${ratingMeta.color}`}>{rating}</span>
                  </div>
                  <div>
                    <p className={`text-base font-bold ${ratingMeta.color}`}>{ratingMeta.label}</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-xs">{ratingMeta.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(["AA","A","B","C","D"] as Rating[]).map((r) => (
                        <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ${r === rating ? `${RATING_META[r].bg} ${RATING_META[r].color} ${RATING_META[r].ring}` : "bg-slate-100 text-slate-400 ring-slate-200"}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Risk factors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Upload Berhasil",  value: `${summary.successful_uploads}/${summary.document_count}`, ok: summary.failed_uploads === 0 },
                    { label: "Upload Gagal",      value: summary.failed_uploads.toString(),     ok: summary.failed_uploads === 0 },
                    { label: "Net Flow",          value: (netFlow >= 0 ? "+" : "−") + formatIDR(Math.abs(netFlow)), ok: netFlow >= 0 },
                    { label: "Jumlah Transaksi",  value: summary.total_transactions.toLocaleString("id-ID"), ok: true },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
                      <p className={`text-sm font-bold mt-1 ${ok ? "text-emerald-700" : "text-red-600"}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Coverage check */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Kelengkapan Dokumen</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      ["Bank Statement",  summary.bank_statement_count  > 0],
                      ["Profit & Loss",   summary.profit_loss_count     > 0],
                      ["Cash Flow",       summary.cash_flow_count        > 0],
                      ["Balance Sheet",   summary.balance_sheet_count    > 0],
                      ["SLIK / IDEB",     false],
                    ].map(([label, has]) => (
                      <div key={String(label)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ring-1 ${has ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"}`}>
                        <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${has ? "text-emerald-500" : "text-slate-300"}`} />
                        {String(label)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CD3 — Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <PencilLine className="h-3.5 w-3.5 text-slate-400" /> Catatan Analis
                    </p>
                    <span className="text-[10px] text-slate-400">Disimpan di browser</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => saveNotes(e.target.value)}
                    placeholder="Tambahkan catatan analisis kredit, observasi khusus, atau rekomendasi…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 resize-none h-28 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* CD4 — Print button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handlePrint(summary, rating, notes, netFlow)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-teal-300 hover:text-teal-700 transition-all shadow-sm"
                  >
                    <Printer className="h-4 w-4" /> Export / Print Ringkasan
                  </button>
                </div>
              </div>
            )}

            {/* ── Dokumen ── */}
            {activeTab === "dokumen" && (
              visibleStatements.length === 0 ? (
                <div className="py-20 text-center">
                  <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-500">
                    {documentFilter === "all" ? "Belum ada dokumen" : `Belum ada ${docTypeInfo[documentFilter].label}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Pilih tipe dokumen di panel kiri untuk upload file baru.
                  </p>
                  {documentFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => openUploadModal(documentFilter)}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload {docTypeInfo[documentFilter].label}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {/* View toggle */}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDocumentFilter("all")}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                          documentFilter === "all" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        Semua
                      </button>
                      <button onClick={() => setDocView("kalender")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${docView === "kalender" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                        <CalendarDays className="h-3 w-3" /> Kalender
                      </button>
                      <button onClick={() => setDocView("tabel")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${docView === "tabel" ? "bg-white text-teal-700 ring-1 ring-teal-200 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                        <List className="h-3 w-3" /> Tabel
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {documentFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => openUploadModal(documentFilter)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </button>
                      )}
                      <button onClick={fetchData}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* ── Calendar view ── */}
                  {docView === "kalender" && (
                    <div className="p-5 space-y-4">
                      {calYears.length === 0 ? (
                        <div className="py-8 text-center">
                          <CalendarDays className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">Belum ada dokumen dengan informasi periode</p>
                        </div>
                      ) : (
                        <>
                          {/* Year selector */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Tahun</p>
                            {calYears.map((y) => (
                              <button key={y} onClick={() => setCalYear(y)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${calYear === y ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "text-slate-500 hover:bg-slate-100"}`}>
                                {y}
                              </button>
                            ))}
                          </div>

                          {calYear && (
                            <>
                              {/* Coverage summary */}
                              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                                  {Object.keys(byYearMonth[calYear] ?? {}).length} bulan terupload
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
                                  {12 - Object.keys(byYearMonth[calYear] ?? {}).length} bulan belum ada
                                </span>
                              </div>

                              {/* 12-month grid */}
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {MONTHS_ID.map((monthLabel, mIdx) => {
                                  const docs = byYearMonth[calYear]?.[mIdx] ?? [];
                                  const hasDocs = docs.length > 0;
                                  return (
                                    <div key={mIdx} className={`rounded-xl border p-3 min-h-[88px] flex flex-col transition-all ${hasDocs ? "border-teal-200 bg-teal-50/70" : "border-dashed border-slate-200 bg-slate-50/30"}`}>
                                      <p className={`text-[10px] font-bold uppercase mb-2 ${hasDocs ? "text-teal-700" : "text-slate-300"}`}>
                                        {monthLabel}
                                      </p>
                                      {hasDocs ? (
                                        <div className="space-y-1.5 flex-1">
                                          {docs.slice(0, 2).map((doc) => (
                                            <div key={doc.id} className="min-w-0">
                                              {doc.document_type === "bank_statement" && (doc.status === "done" || doc.status === "needs_review") ? (
                                                <Link href={`/statements/${doc.id}`} className="block text-[9px] font-semibold text-teal-800 hover:text-teal-600 truncate leading-tight" title={doc.original_filename}>
                                                  {doc.original_filename.replace(/\.pdf$/i, "").slice(0, 14)}
                                                </Link>
                                              ) : (
                                                <p className="text-[9px] font-medium text-slate-600 truncate leading-tight" title={doc.original_filename}>
                                                  {doc.original_filename.replace(/\.pdf$/i, "").slice(0, 14)}
                                                </p>
                                              )}
                                              <StatusBadge status={doc.status} />
                                            </div>
                                          ))}
                                          {docs.length > 2 && (
                                            <p className="text-[9px] text-teal-600 font-medium">+{docs.length - 2} lainnya</p>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-[11px] text-slate-300 mt-auto">—</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Documents without period info */}
                              {visibleStatements.filter((s) => !s.period_start).length > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                  <p className="text-xs font-semibold text-amber-700 mb-2">Dokumen tanpa informasi periode</p>
                                  <div className="space-y-2">
                                    {visibleStatements.filter((s) => !s.period_start).map((doc) => (
                                      <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/60 px-2.5 py-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-medium text-amber-800 truncate" title={doc.original_filename}>
                                            {doc.original_filename}
                                          </p>
                                          <div className="mt-1 flex items-center gap-1.5">
                                            <StatusBadge status={doc.status} />
                                            {doc.parse_error && (
                                              <span className="text-[10px] text-amber-700 truncate" title={doc.parse_error}>
                                                {doc.parse_error}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {doc.document_type === "bank_statement" && doc.status !== "queued" && doc.status !== "parsing" && (
                                          <button
                                            type="button"
                                            onClick={() => handleReparse(doc.id)}
                                            disabled={reparsingId === doc.id}
                                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60 transition-all"
                                            title="Retry parsing untuk membaca periode"
                                          >
                                            <RefreshCw className={`h-3.5 w-3.5 ${reparsingId === doc.id ? "animate-spin" : ""}`} />
                                            Retry
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Table view ── */}
                  {docView === "tabel" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                          <tr>
                            {documentTableHeaders(documentFilter).map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleStatements.map((doc) => {
                            const pnlReport = getPnlReport(doc);
                            const bsReport = getBalanceSheetReport(doc);
                            const cfReport = getCashFlowReport(doc);
                            const bsLastPeriod = bsReport?.periods?.at(-1);
                            const revenue = pnlReport?.summaries?.revenue?.total;
                            const netIncome = pnlReport?.summaries?.net_income?.total;
                            const balanceOk = doc.document_type === "balance_sheet"
                              ? bsReport?.balance_checks?.every((check) => check.balanced)
                              : doc.document_type === "cash_flow"
                                ? cfReport?.cash_check?.balanced
                                : doc.is_reconciled;
                            const cashAkhir = cfReport?.summaries?.ending_cash ?? doc.closing_balance;
                            const totalAssets = bsLastPeriod ? bsReport?.summaries?.total_assets?.[bsLastPeriod] : null;
                            const primaryMetric = doc.document_type === "profit_loss"
                              ? revenue
                              : balanceOk;
                            const secondaryMetric = doc.document_type === "profit_loss"
                              ? netIncome
                              : doc.document_type === "balance_sheet"
                                ? totalAssets
                                : cashAkhir;
                            return (
                              <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-800 truncate max-w-[200px]" title={doc.original_filename}>
                                    {doc.original_filename}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {new Date(doc.created_at).toLocaleDateString("id-ID", { dateStyle: "short" })}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                  {doc.period_start && doc.period_end
                                    ? `${formatDate(doc.period_start)} – ${formatDate(doc.period_end)}`
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap ${doc.document_type === "profit_loss" ? "text-right text-xs font-semibold text-emerald-700" : ""}`}>
                                  {doc.document_type === "profit_loss" ? (
                                    primaryMetric != null ? formatIDR(Number(primaryMetric)) : <span className="text-slate-300 font-normal">—</span>
                                  ) : typeof primaryMetric === "boolean" ? (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                                      primaryMetric
                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                        : "bg-amber-50 text-amber-700 ring-amber-200"
                                    }`}>
                                      {primaryMetric ? "Balanced" : "Review"}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-right text-xs font-semibold whitespace-nowrap ${Number(secondaryMetric ?? 0) < 0 ? "text-red-600" : "text-slate-800"}`}>
                                  {secondaryMetric != null && typeof secondaryMetric !== "boolean" ? formatIDR(Number(secondaryMetric)) : <span className="text-slate-300 font-normal">—</span>}
                                </td>
                                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {doc.document_type === "bank_statement" && (doc.status === "done" || doc.status === "needs_review") && (
                                      <Link href={`/statements/${doc.id}`}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-teal-200 hover:text-teal-600 transition-all">
                                        Analisis
                                      </Link>
                                    )}
                                    {["profit_loss", "balance_sheet", "cash_flow"].includes(doc.document_type) && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPnlDoc(doc)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-700"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        View
                                      </button>
                                    )}
                                    {doc.document_type === "other" && (
                                      <Link
                                        href={`/statements/${doc.id}`}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-700"
                                        title="Lihat dokumen"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        View
                                      </Link>
                                    )}
                                    {confirmDeleteId === doc.id ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-red-400">Hapus?</span>
                                        <button onClick={() => handleDelete(doc.id)} disabled={deletingId === doc.id}
                                          className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-all">
                                          {deletingId === doc.id ? "…" : "Ya"}
                                        </button>
                                        <button onClick={() => setConfirmDeleteId(null)}
                                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all">
                                          Batal
                                        </button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setConfirmDeleteId(doc.id)}
                                        className="flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-500 transition-all">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ── Memo Kredit ── */}
            {activeTab === "memo" && (
              <div className="p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Memo Kredit</p>
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

                <div className="grid gap-4 md:grid-cols-3">
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
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Plafon</span>
                    <input
                      type="number"
                      value={memo.loanAmount || ""}
                      onChange={(e) => setMemoField("loanAmount", Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 tabular-nums"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tenor</span>
                    <input
                      type="number"
                      value={memo.tenor}
                      onChange={(e) => setMemoField("tenor", Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400"
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
              </div>
            )}

            {/* ── Grafik ── */}
            {activeTab === "grafik" && (
              <div className="p-6 space-y-6">
                {/* CD6 — Period filter */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Menampilkan data {chartPeriod === 12 ? "12 bulan" : `${chartPeriod} bulan terakhir`}</p>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    {([3, 6, 12] as const).map((p) => (
                      <button key={p} onClick={() => setChartPeriod(p)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          chartPeriod === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {p}B
                      </button>
                    ))}
                  </div>
                </div>

                {txLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-56 w-full rounded-xl" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-56 w-full rounded-xl" />
                  </div>
                ) : filteredDaily.length === 0 ? (
                  <div className="py-16 text-center">
                    <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-500">Belum ada data analitik</p>
                    <p className="text-xs text-slate-400 mt-1">Upload minimal satu Bank Statement untuk melihat visualisasi.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <ChartCard title="Tren Saldo Konsolidasi">
                      {mounted && (
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={filteredDaily}>
                            <defs>
                              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} tickFormatter={(d) => formatDate(d)} />
                            <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
                            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} labelFormatter={(l) => formatDate(String(l))} />
                            <Area type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#balGrad)" name="Saldo" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </ChartCard>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ChartCard title="Mutasi Bulanan (Kredit vs Debit)">
                        {mounted && (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={filteredMonthly}>
                              <CartesianGrid {...GRID_PROPS} />
                              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                              <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
                              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                              <Bar dataKey="credit" fill="#10b981" name="Kredit" radius={[2,2,0,0]} />
                              <Bar dataKey="debit"  fill="#ef4444" name="Debit"  radius={[2,2,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </ChartCard>
                      <ChartCard title="Saldo Akhir Bulanan">
                        {mounted && (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={filteredMonthly}>
                              <CartesianGrid {...GRID_PROPS} />
                              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} />
                              <YAxis tick={AXIS_TICK} tickLine={false} tickFormatter={(v) => `${(v/1e6).toFixed(0)}M`} />
                              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatIDR(Number(v ?? 0))} />
                              <Bar dataKey="balance" fill="#6366f1" name="Saldo Akhir" radius={[2,2,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </ChartCard>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  );
}
