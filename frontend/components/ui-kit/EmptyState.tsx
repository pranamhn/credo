import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "dashed" | "solid";
  className?: string;
}

export function EmptyState({ icon, title, description, action, variant = "dashed", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 text-center",
        variant === "dashed"
          ? "rounded-xl border border-dashed border-slate-200 bg-slate-50/50"
          : "rounded-xl",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200 text-slate-400">
        {icon}
      </div>
      <p className="text-base font-semibold text-slate-600">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-slate-400 leading-6">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
