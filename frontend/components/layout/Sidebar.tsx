"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, FileText, BarChart3, Settings,
  Home, CreditCard, AlertTriangle, TrendingDown,
  FileSearch, Upload, ScrollText, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { label: "Dashboard",  icon: Home,     href: "/" },
      { label: "Insights",   icon: BarChart3, href: "/analytics" },
    ],
  },
  {
    title: "Debitur",
    items: [
      { label: "Portfolio Debitur", icon: Building2,  href: "/companies" },
      { label: "Fasilitas Kredit",  icon: CreditCard, href: "/loans" },
      { label: "Credit Memo",       icon: ScrollText, href: "/memo" },
    ],
  },
  {
    title: "Analisis",
    items: [
      { label: "Bank Statement",  icon: FileText,    href: "/statements" },
      { label: "iDEB Parser",     icon: FileSearch,  href: "/idebt-parser" },
      { label: "Upload Dokumen",  icon: Upload,      href: "/upload" },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Watch List",   icon: AlertTriangle, href: "/watchlist" },
      { label: "NPL Tracker",  icon: TrendingDown,  href: "/npl" },
    ],
  },
  {
    title: "Pengaturan",
    items: [
      { label: "Pengaturan", icon: Shield, href: "/admin" },
    ],
  },
];

function NavLeaf({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = item.href === "/"
    ? path === "/"
    : path === item.href || path.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-violet-100 text-violet-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "text-gray-400")} />
      {item.label}
    </Link>
  );
}

export function Sidebar({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const path = usePathname();
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-white border-r border-gray-200 lg:flex sticky top-14 h-[calc(100vh-3.5rem)] transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
        {collapsed ? (
          <div className="space-y-0.5">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
              const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 mx-auto rounded-xl transition-colors",
                    active ? "bg-violet-100 text-violet-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLeaf key={item.href} item={item} path={path} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 py-3 px-2">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-[11px] font-bold text-white">
              RM
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-2">
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-[11px] font-bold text-white shrink-0">
                RM
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">Rachmad Mahendra</p>
                <p className="text-[10px] text-gray-400 truncate">Administrator</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-300 text-center">© 2024 CREDO · Risk Analyst Intelligent</p>
          </div>
        )}
      </div>
    </aside>
  );
}
