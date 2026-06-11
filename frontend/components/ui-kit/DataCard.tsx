import { cn } from "@/lib/utils";

interface DataCardProps {
  accent?: boolean;
  hoverable?: boolean;
  padding?: "default" | "compact" | "flush";
  className?: string;
  children: React.ReactNode;
}

export function DataCard({ accent = false, hoverable = false, padding = "default", className, children }: DataCardProps) {
  const paddingCls = {
    default: "p-5",
    compact: "p-4",
    flush: "",
  }[padding];

  return (
    <div
      className={cn(
        "relative rounded-xl border border-slate-200 bg-white shadow-sm",
        hoverable && "transition-all duration-200 hover:border-violet-300 hover:shadow-md",
        paddingCls,
        className
      )}
    >
      {accent && (
        <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
      )}
      {children}
    </div>
  );
}

interface DataCardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}
export function DataCardHeader({ title, subtitle, actions }: DataCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
