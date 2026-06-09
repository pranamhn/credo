import React from "react";
import {
  FileText, TrendingUp, Scale, FileSpreadsheet,
  BookOpen, ScrollText, Building2, FileCheck,
} from "lucide-react";
import type { DocumentType } from "@/lib/api";
import type { CreditMemo } from "@/lib/localData";
import type { Rating, MemoScoreKey, MemoNotesKey } from "./company-detail-types";

// ── Date / Chart helpers ──────────────────────────────────────────────────────

export const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

export const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#1e293b", fontSize: 12 },
  labelStyle: { color: "#64748b" },
  cursor: { fill: "rgba(20,184,166,0.04)" },
};

export const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };
export const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

// ── Document type metadata ────────────────────────────────────────────────────

export const docTypeInfo: Record<DocumentType, { label: string; icon: React.ComponentType<{ className?: string }>; active: string; idle: string }> = {
  bank_statement: { label: "Bank Statement",  icon: FileText,        active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-blue-50 text-blue-600" },
  profit_loss:    { label: "Profit & Loss",   icon: TrendingUp,      active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-emerald-50 text-emerald-600" },
  cash_flow:      { label: "Cash Flow",       icon: Scale,           active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-amber-50 text-amber-600" },
  balance_sheet:  { label: "Balance Sheet",   icon: FileSpreadsheet, active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-indigo-50 text-indigo-600" },
  other:          { label: "Dokumen Lain",    icon: BookOpen,        active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-slate-100 text-slate-500" },
  nib:            { label: "Dokumen NIB",     icon: ScrollText,      active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-sky-50 text-sky-600" },
  ahu:            { label: "Dokumen AHU",     icon: Building2,       active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-violet-50 text-violet-600" },
  akta:           { label: "Akta",            icon: FileCheck,       active: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",    idle: "bg-rose-50 text-rose-600" },
};


// ── Financial summary labels ──────────────────────────────────────────────────

export const PNL_SUMMARY_LABELS: Record<string, string> = {
  revenue: "Pendapatan",
  cost_of_goods_sold: "Beban Pokok Penjualan",
  gross_profit: "Laba Kotor",
  operating_expense: "Beban Operasional",
  operating_profit: "Pendapatan Operasional",
  non_operating: "Non Operasional",
  net_income: "Laba Bersih",
};

export const BS_SUMMARY_LABELS: Record<string, string> = {
  current_assets: "Aset Lancar",
  total_assets: "Total Aset",
  total_liabilities: "Total Liabilitas",
  total_equities: "Total Ekuitas",
};

export const CF_SUMMARY_LABELS: Record<string, string> = {
  net_cash_from_operating: "Kas Operasi",
  net_cash_from_investing: "Kas Investasi",
  net_cash_from_financing: "Kas Pendanaan",
  ending_cash: "Kas Akhir",
};

// ── Credit rating metadata ────────────────────────────────────────────────────

export const RATING_META: Record<Rating, { label: string; desc: string; color: string; bg: string; ring: string }> = {
  AAA: { label: "Sangat Prima",  desc: "Score 85–100. Risiko sangat rendah, semua dimensi prima.",          color: "text-emerald-800", bg: "bg-emerald-50",  ring: "ring-emerald-300" },
  AA:  { label: "Prima",         desc: "Score 70–84. Risiko rendah, keuangan solid dan cashflow kuat.",     color: "text-emerald-700", bg: "bg-emerald-50",  ring: "ring-emerald-200" },
  A:   { label: "Baik",          desc: "Score 55–69. Risiko moderat rendah, layak dipertimbangkan.",        color: "text-teal-700",    bg: "bg-teal-50",     ring: "ring-teal-200" },
  B:   { label: "Cukup Baik",    desc: "Score 40–54. Perlu pemantauan lebih ketat.",                        color: "text-blue-700",    bg: "bg-blue-50",     ring: "ring-blue-200" },
  C:   { label: "Kurang",        desc: "Score 25–39. Risiko signifikan, perlu mitigasi kuat.",              color: "text-amber-700",   bg: "bg-amber-50",    ring: "ring-amber-200" },
  D:   { label: "Meragukan",     desc: "Score 10–24. Risiko tinggi, pertimbangkan penolakan.",              color: "text-orange-700",  bg: "bg-orange-50",   ring: "ring-orange-200" },
  E:   { label: "Macet / Tolak", desc: "Score 0–9. Tidak layak kredit, tolak pengajuan.",                  color: "text-red-700",     bg: "bg-red-50",      ring: "ring-red-200" },
};

// ── Memo / facility ───────────────────────────────────────────────────────────

export const FACILITY_TYPES = ["KMK", "KI", "KPR", "KUK", "Kredit Sindikasi", "Lainnya"];

export const MEMO_STATUS: CreditMemo["status"][] = ["draft", "diajukan", "review", "komite", "disetujui", "ditolak"];

export const MEMO_STATUS_LABEL: Record<CreditMemo["status"], string> = {
  draft: "Draft",
  diajukan: "Diajukan",
  review: "Review",
  komite: "Komite",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

export const MEMO_SCORE_FIELDS: { label: string; key: MemoScoreKey }[] = [
  { label: "Character",  key: "characterScore"  },
  { label: "Capacity",   key: "capacityScore"   },
  { label: "Capital",    key: "capitalScore"    },
  { label: "Collateral", key: "collateralScore" },
  { label: "Condition",  key: "conditionScore"  },
];

export const MEMO_5C_FIELDS: { label: string; scoreKey: MemoScoreKey; notesKey: MemoNotesKey }[] = [
  { label: "Character",  scoreKey: "characterScore",  notesKey: "characterNotes"  },
  { label: "Capacity",   scoreKey: "capacityScore",   notesKey: "capacityNotes"   },
  { label: "Capital",    scoreKey: "capitalScore",    notesKey: "capitalNotes"    },
  { label: "Collateral", scoreKey: "collateralScore", notesKey: "collateralNotes" },
  { label: "Condition",  scoreKey: "conditionScore",  notesKey: "conditionNotes"  },
];
