import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "red" | "blue" | "default";
  icon?: React.ReactNode;
}

const highlightConfig = {
  green: {
    bar:   "bg-emerald-500",
    value: "text-emerald-700",
    icon:  "text-emerald-600",
  },
  red: {
    bar:   "bg-red-500",
    value: "text-red-600",
    icon:  "text-red-500",
  },
  blue: {
    bar:   "bg-teal-500",
    value: "text-teal-700",
    icon:  "text-teal-600",
  },
  default: {
    bar:   "bg-slate-300",
    value: "text-slate-800",
    icon:  "text-slate-400",
  },
};

export function MetricCard({ label, value, sub, highlight = "default", icon }: MetricCardProps) {
  const h = highlightConfig[highlight];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r", h.bar)} />
      <div className="pl-3">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          {icon && <span className={h.icon}>{icon}</span>}
        </div>
        <p className={cn("text-xl font-bold mt-1.5", h.value)}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
