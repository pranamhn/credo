import { cn } from "@/lib/utils";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type GlowVariant = "primary" | "secondary" | "ghost" | "danger";
export type GlowSize    = "xs" | "sm" | "md" | "lg";

interface BaseProps {
  variant?:   GlowVariant;
  size?:      GlowSize;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
  loading?:   boolean;
  disabled?:  boolean;
  className?: string;
  children?:  React.ReactNode;
}

type AsButton = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink   = BaseProps & { href: string; target?: string };
type GlowButtonProps = AsButton | AsLink;

const variantCls: Record<GlowVariant, string> = {
  primary:
    "bg-violet-600 text-white shadow-sm hover:bg-violet-700 active:bg-violet-800",
  secondary:
    "bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400",
  ghost:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-400",
  danger:
    "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 hover:border-red-400",
};

const sizeCls: Record<GlowSize, string> = {
  xs: "h-7  px-2.5 text-xs  gap-1.5 rounded-lg",
  sm: "h-8  px-3   text-xs  gap-1.5 rounded-lg",
  md: "h-9  px-4   text-sm  gap-2   rounded-lg",
  lg: "h-10 px-5   text-sm  gap-2   rounded-xl",
};

const iconSizeCls: Record<GlowSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

export function GlowButton(props: GlowButtonProps) {
  const {
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    loading,
    disabled,
    className,
    children,
    ...rest
  } = props;

  const baseClass = cn(
    "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    variantCls[variant],
    sizeCls[size],
    className
  );

  const content = (
    <>
      {loading ? (
        <Loader2 className={cn("animate-spin shrink-0", iconSizeCls[size])} />
      ) : icon ? (
        <span className={cn("shrink-0", iconSizeCls[size])}>{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && (
        <span className={cn("shrink-0", iconSizeCls[size])}>{iconRight}</span>
      )}
    </>
  );

  if ("href" in props && props.href) {
    const { href, target, ...linkRest } = rest as AsLink;
    return (
      <Link href={href} target={target} className={baseClass} {...(linkRest as object)}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...btnRest } = rest as AsButton;
  return (
    <button type={type} disabled={disabled || loading} className={baseClass} {...btnRest}>
      {content}
    </button>
  );
}
