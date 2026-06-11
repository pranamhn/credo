interface Props {
  bankStatementCount: number;
  profitLossCount: number;
  cashFlowCount: number;
  balanceSheetCount: number;
  otherDocumentCount: number;
}

export function DocumentStatsPanel({
  bankStatementCount,
  profitLossCount,
  cashFlowCount,
  balanceSheetCount,
  otherDocumentCount,
}: Props) {
  const rows: [string, number, string][] = [
    ["Bank Statement",  bankStatementCount,  "bg-violet-50 text-violet-700"],
    ["Profit & Loss",   profitLossCount,     "bg-emerald-50 text-emerald-700"],
    ["Cash Flow",       cashFlowCount,       "bg-amber-50 text-amber-700"],
    ["Balance Sheet",   balanceSheetCount,   "bg-indigo-50 text-indigo-700"],
    ["Lain-lain",       otherDocumentCount,  "bg-slate-100 text-slate-600"],
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Statistik Dokumen</p>
      <div className="space-y-2">
        {rows.map(([label, count, colorClass]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-500 text-xs">{label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClass}`}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
