import { cn } from "@/lib/utils";

interface HealthScoreCardProps {
  score: number;
  className?: string;
}

function getStatus(score: number): { label: string; color: string; ring: string; bg: string } {
  if (score >= 75) return { label: "Portofolio Sehat",   color: "text-emerald-600", ring: "#10b981", bg: "bg-emerald-50" };
  if (score >= 50) return { label: "Perlu Monitoring",   color: "text-amber-600",   ring: "#f59e0b", bg: "bg-amber-50"  };
  return              { label: "Risiko Tinggi",          color: "text-red-600",     ring: "#ef4444", bg: "bg-red-50"    };
}

export function HealthScoreCard({ score, className }: HealthScoreCardProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const status = getStatus(clamped);

  // SVG ring: r=36, circumference ≈ 226
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-5", className)}>
      <div className="relative h-28 w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={status.ring} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-black text-slate-900 leading-none">{clamped}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">/ 100</p>
        </div>
      </div>

      <div className="text-center">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", status.bg, status.color)}>
          {status.label}
        </span>
        <p className="mt-2 text-[11px] text-slate-400">Health Score Portofolio</p>
      </div>
    </div>
  );
}
