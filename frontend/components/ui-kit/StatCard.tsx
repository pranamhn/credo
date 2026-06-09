import { cn } from "@/lib/utils";

export type StatColor = "cyan" | "emerald" | "red" | "amber" | "indigo" | "violet" | "default";

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: StatColor;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

const palette: Record<StatColor, { iconWrap: string; value: string }> = {
  cyan:    { iconWrap: "bg-teal-100 text-teal-700",     value: "text-teal-700" },
  emerald: { iconWrap: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  red:     { iconWrap: "bg-red-100 text-red-700",        value: "text-red-700" },
  amber:   { iconWrap: "bg-amber-100 text-amber-700",    value: "text-amber-700" },
  indigo:  { iconWrap: "bg-indigo-100 text-indigo-700",  value: "text-indigo-700" },
  violet:  { iconWrap: "bg-violet-100 text-violet-700",  value: "text-violet-700" },
  default: { iconWrap: "bg-slate-100 text-slate-600",    value: "text-slate-900" },
};

export function StatCard({ icon, value, label, color = "default", trend, trendUp, className }: StatCardProps) {
  const p = palette[color];
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-300 bg-white px-4 py-4 flex items-center gap-3.5 shadow-sm",
        className
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", p.iconWrap)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className={cn("text-xl font-bold leading-tight", p.value)}>{value}</p>
          {trend && (
            <span className={cn("text-[10px] font-semibold", trendUp ? "text-emerald-600" : "text-red-500")}>
              {trend}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate">{label}</p>
      </div>
    </div>
  );
}
