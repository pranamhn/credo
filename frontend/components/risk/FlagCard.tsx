import { AlertTriangle, ShieldAlert, ArrowRightLeft, XCircle, TrendingDown, TrendingUp, Info } from "lucide-react";
import { FlagDetail } from "@/lib/api";
import { formatIDR } from "@/lib/utils";

const flagIcons: Record<string, React.ReactNode> = {
  judol: <ShieldAlert className="w-4 h-4" />,
  pinjol: <AlertTriangle className="w-4 h-4" />,
  passthrough: <ArrowRightLeft className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
  negative_balance: <TrendingDown className="w-4 h-4" />,
  large_inflow: <TrendingUp className="w-4 h-4" />,
  low_confidence: <Info className="w-4 h-4" />,
};

const severityCfg = {
  high: {
    card:  "border-red-200 bg-red-50",
    icon:  "bg-red-100 text-red-600 ring-1 ring-red-200",
    badge: "bg-red-100 text-red-700 ring-1 ring-red-200",
    text:  "text-red-700",
    muted: "text-red-400",
  },
  medium: {
    card:  "border-amber-200 bg-amber-50",
    icon:  "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    badge: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    text:  "text-amber-800",
    muted: "text-amber-500",
  },
  low: {
    card:  "border-slate-200 bg-white",
    icon:  "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    text:  "text-slate-700",
    muted: "text-slate-400",
  },
};

export function FlagCard({ flag, onInspect }: { flag: FlagDetail; onInspect?: (flag: FlagDetail) => void }) {
  const cfg = severityCfg[flag.severity] ?? severityCfg.low;
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cfg.card}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.icon}`}>
          {flagIcons[flag.flag_type] ?? <AlertTriangle className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className={`font-semibold text-sm capitalize ${cfg.text}`}>
              {flag.flag_type.replace(/_/g, " ")}
            </p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cfg.badge}`}>
              {flag.severity}
            </span>
            <span className={`text-xs ${cfg.muted}`}>{flag.count}×</span>
            {flag.total_amount != null && (
              <span className={`text-xs font-semibold ${cfg.text}`}>{formatIDR(flag.total_amount)}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-5">{flag.description}</p>
          {flag.supporting_rows.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-400">
                Baris: {flag.supporting_rows.slice(0, 8).join(", ")}
                {flag.supporting_rows.length > 8 ? ` +${flag.supporting_rows.length - 8}` : ""}
              </p>
              {onInspect && (
                <button
                  type="button"
                  onClick={() => onInspect(flag)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
                >
                  Lihat konteks
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
