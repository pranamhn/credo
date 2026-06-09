"use client";

import { useMemo } from "react";
import type { Statement } from "@/lib/api";
import { getPnlReport, getBalanceSheetReport } from "../_lib/company-detail-helpers";

export function useFinancialComparisons(statements: Statement[]) {
  const pnlComparison = useMemo(() => {
    const docs = statements
      .filter((s) => s.document_type === "profit_loss" && getPnlReport(s))
      .sort((a, b) => (b.period_end ?? "").localeCompare(a.period_end ?? ""));
    if (!docs.length) return null;

    const latestDoc = docs[0];
    const latestReport = getPnlReport(latestDoc)!;
    const latestYear = (latestDoc.period_end ?? "").slice(0, 4);
    const priorDoc = docs.slice(1).find((d) => (d.period_end?.slice(0, 4) ?? "") < latestYear) ?? null;
    const priorReport = priorDoc ? getPnlReport(priorDoc) : null;

    const startStr = latestDoc.period_start ?? "";
    const endStr   = latestDoc.period_end   ?? "";
    const latestMo = startStr && endStr
      ? (parseInt(endStr.slice(0, 4)) - parseInt(startStr.slice(0, 4))) * 12
        + (parseInt(endStr.slice(5, 7)) - parseInt(startStr.slice(5, 7)) + 1)
      : 12;

    const priorLabel  = priorDoc  ? `Y-1 FY ${priorDoc.period_end?.slice(0, 4)} (${priorDoc.period_start?.slice(0, 7)}–${priorDoc.period_end?.slice(0, 7)})` : null;
    const latestLabel = `Y0 ${latestMo < 12 ? "YTD " : ""}${latestDoc.period_end?.slice(0, 4)} (${latestDoc.period_start?.slice(0, 7)}–${latestDoc.period_end?.slice(0, 7)})`;

    const PNL_ROWS = [
      { key: "revenue",            label: "Revenue",              isBold: false },
      { key: "cost_of_goods_sold", label: "COGS / HPP",           isBold: false },
      { key: "gross_profit",       label: "Gross Profit",         isBold: true  },
      { key: "operating_expense",  label: "OPEX",                 isBold: false },
      { key: "operating_profit",   label: "EBITDA",               isBold: true  },
      { key: "non_operating",      label: "Other Income/Expenses",isBold: false },
      { key: "net_income",         label: "Nett Profit",          isBold: true  },
    ];

    const rows = PNL_ROWS.map(({ key, label, isBold }) => {
      const lt = latestReport.summaries?.[key]?.total ?? null;
      const pr = priorReport?.summaries?.[key]?.total ?? null;
      const annualizedTotal = lt !== null && latestMo > 0 ? (lt / latestMo) * 12 : null;
      const estGrowthPct = annualizedTotal !== null && pr !== null && pr !== 0
        ? ((annualizedTotal - pr) / Math.abs(pr)) * 100 : null;
      return { key, label, isBold, latestTotal: lt, priorTotal: pr, annualizedTotal, estGrowthPct };
    });

    return { priorLabel, latestLabel, latestMo, rows };
  }, [statements]);

  const bsComparison = useMemo(() => {
    const docs = statements
      .filter((s) => s.document_type === "balance_sheet" && getBalanceSheetReport(s))
      .sort((a, b) => (b.period_end ?? "").localeCompare(a.period_end ?? ""));
    if (!docs.length) return null;

    const latestDoc = docs[0];
    const latestReport = getBalanceSheetReport(latestDoc)!;
    const latestYear = (latestDoc.period_end ?? "").slice(0, 4);
    const priorDoc = docs.slice(1).find((d) => (d.period_end?.slice(0, 4) ?? "") < latestYear) ?? null;
    const priorReport = priorDoc ? getBalanceSheetReport(priorDoc) : null;

    const latestPeriod = latestReport.periods?.at(-1) ?? "";
    const priorPeriod  = priorReport?.periods?.at(-1) ?? "";

    const elapsedMonths = (() => {
      if (!priorDoc?.period_end || !latestDoc.period_end) return null;
      const [py, pm] = priorDoc.period_end.slice(0, 7).split("-").map(Number);
      const [ly, lm] = latestDoc.period_end.slice(0, 7).split("-").map(Number);
      const m = (ly - py) * 12 + (lm - pm);
      return m > 0 ? m : null;
    })();
    const remainingMonths = elapsedMonths !== null ? Math.max(0, 12 - elapsedMonths) : null;

    const priorLabel  = priorDoc  ? `Y-1 FY ${priorDoc.period_end?.slice(0, 4)} (${priorPeriod})` : null;
    const latestLabel = `Y0 ${latestDoc.period_end?.slice(0, 4)} (${latestPeriod})`;

    const BS_ROWS = [
      { key: "current_assets",    label: "Aset Lancar",     isBold: false },
      { key: "total_assets",      label: "TOTAL ASET",      isBold: true  },
      { key: "total_liabilities", label: "TOTAL KEWAJIBAN", isBold: true  },
      { key: "total_equities",    label: "TOTAL EKUITAS",   isBold: true  },
    ];

    const rows = BS_ROWS.map(({ key, label, isBold }) => {
      const lv = latestReport.summaries?.[key]?.[latestPeriod] ?? null;
      const pv = priorReport?.summaries?.[key]?.[priorPeriod] ?? null;
      const growthPct = lv !== null && pv !== null && pv !== 0
        ? ((lv - pv) / Math.abs(pv)) * 100 : null;
      const projectedValue = lv !== null && pv !== null && elapsedMonths
        ? lv + ((lv - pv) / elapsedMonths) * (remainingMonths ?? 0) : null;
      const projectedGrowthPct = projectedValue !== null && pv !== null && pv !== 0
        ? ((projectedValue - pv) / Math.abs(pv)) * 100 : null;
      return { key, label, isBold, latestValue: lv, priorValue: pv, growthPct, projectedValue, projectedGrowthPct };
    });

    return { priorLabel, latestLabel, elapsedMonths, remainingMonths, rows };
  }, [statements]);

  const derivedRatios = useMemo(() => {
    const getRow = (key: string) => pnlComparison?.rows.find((r) => r.key === key);
    const bsRow  = (key: string) => bsComparison?.rows.find((r) => r.key === key);

    const revenue        = getRow("revenue")?.latestTotal          ?? null;
    const grossProfit    = getRow("gross_profit")?.latestTotal      ?? null;
    const ebitda         = getRow("operating_profit")?.latestTotal  ?? null;
    const netIncome      = getRow("net_income")?.latestTotal        ?? null;
    const latestMo       = pnlComparison?.latestMo ?? 12;
    const annualize      = (v: number | null) =>
      v !== null && latestMo > 0 && latestMo < 12 ? (v / latestMo) * 12 : v;
    const annualNI       = annualize(netIncome);

    const totalAssets      = bsRow("total_assets")?.latestValue      ?? null;
    const totalLiabilities = bsRow("total_liabilities")?.latestValue ?? null;
    const totalEquities    = bsRow("total_equities")?.latestValue    ?? null;

    if (revenue === null && totalAssets === null) return null;

    const pct   = (n: number | null, d: number | null) =>
      n !== null && d !== null && d !== 0 ? (n / d) * 100 : null;
    const ratio = (n: number | null, d: number | null) =>
      n !== null && d !== null && d !== 0 ? n / d : null;

    return {
      grossMargin:  pct(grossProfit, revenue),
      ebitdaMargin: pct(ebitda, revenue),
      netMargin:    pct(netIncome, revenue),
      der:          ratio(totalLiabilities, totalEquities),
      dar:          pct(totalLiabilities, totalAssets),
      roe:          pct(annualNI, totalEquities),
      roa:          pct(annualNI, totalAssets),
      isAnnualized: latestMo < 12,
    };
  }, [pnlComparison, bsComparison]);

  return { pnlComparison, bsComparison, derivedRatios };
}
