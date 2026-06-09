import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p className={cn("text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400", className)}>
      {children}
    </p>
  );
}
