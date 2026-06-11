import { cn } from "@/lib/utils";

export type StatColor = "cyan" | "emerald" | "red" | "amber" | "indigo" | "violet" | "default";
export type GradientColor = "purple" | "red" | "green" | "amber";

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: StatColor;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  subtitleValue?: string | number;
  variant?: "default" | "gradient";
  gradient?: GradientColor;
  className?: string;
}

const palette: Record<StatColor, { iconWrap: string; value: string; accent: string }> = {
  cyan:    { iconWrap: "bg-violet-50 text-violet-600",  value: "text-violet-700",  accent: "bg-violet-500" },
  emerald: { iconWrap: "bg-emerald-50 text-emerald-600",value: "text-emerald-700", accent: "bg-emerald-500" },
  red:     { iconWrap: "bg-red-50 text-red-600",        value: "text-red-700",     accent: "bg-red-500" },
  amber:   { iconWrap: "bg-amber-50 text-amber-600",    value: "text-amber-700",   accent: "bg-amber-500" },
  indigo:  { iconWrap: "bg-indigo-50 text-indigo-600",  value: "text-indigo-700",  accent: "bg-indigo-500" },
  violet:  { iconWrap: "bg-violet-50 text-violet-600",  value: "text-violet-700",  accent: "bg-violet-500" },
  default: { iconWrap: "bg-slate-100 text-slate-500",   value: "text-slate-900",   accent: "bg-slate-400" },
};

const gradients: Record<GradientColor, string> = {
  purple: "linear-gradient(135deg, #7c3aed, #9333ea)",
  red:    "linear-gradient(135deg, #ef4444, #f97316)",
  green:  "linear-gradient(135deg, #10b981, #059669)",
  amber:  "linear-gradient(135deg, #f59e0b, #d97706)",
};

export function StatCard({
  icon, value, label, color = "default",
  trend, trendUp, subtitle, subtitleValue,
  variant = "default", gradient,
  className,
}: StatCardProps) {
  if (variant === "gradient" && gradient) {
    return (
      <div
        className={cn("rounded-2xl p-5 text-white shadow-sm", className)}
        style={{ background: gradients[gradient] }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-3xl font-bold leading-tight">{value}</p>
            <p className="text-sm mt-1 opacity-80 truncate">{label}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="[&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-white">{icon}</span>
          </div>
        </div>
      </div>
    );
  }

  const p = palette[color];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md",
        className
      )}
    >
      {/* Top accent line */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", p.accent)} />

      <div className="p-4 pt-5">
        {/* Header: label + icon */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", p.iconWrap)}>
            {icon}
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-3">
          <p className={cn("text-xl font-bold leading-none tracking-tight", p.value)}>{value}</p>
          {trend && (
            <span className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
            )}>
              {trend}
            </span>
          )}
        </div>

        {/* Subtitle row */}
        {subtitle && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
            {subtitleValue !== undefined && (
              <span className="text-[11px] font-semibold text-slate-600 shrink-0 ml-2">{subtitleValue}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
