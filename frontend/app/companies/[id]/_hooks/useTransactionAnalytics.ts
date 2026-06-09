"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { statementsApi } from "@/lib/api";
import type { Statement } from "@/lib/api";
import { toast } from "sonner";
import type { DailyData, MonthlyData } from "../_lib/company-detail-types";

export function useTransactionAnalytics(statements: Statement[]) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<3 | 6 | 12>(12);

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

  return { dailyData, monthlyData, txLoading, chartPeriod, setChartPeriod, filteredDaily, filteredMonthly };
}
