import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-1 select-none">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
