"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, FileText, BarChart3, Settings,
  ChevronDown, Lock, Home, CreditCard, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubItem = { href: string; label: string };
type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: SubItem[];
};
type Section = { title: string; items: NavItem[] };

const SECTIONS: Section[] = [
  {
    title: "Dashboard",
    items: [
      { label: "Home", icon: Home, href: "/" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
    ],
  },
  {
    title: "Operation",
    items: [
      { label: "Companies", icon: Building2, href: "/companies" },
      { label: "Documents", icon: FileText, href: "/statements" },
      { label: "iDeb Parser", icon: Lock, href: "/idebt-parser" },
      { label: "Fasilitas", icon: CreditCard, href: "/loans" },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Watch List", icon: AlertTriangle, href: "/watchlist" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings", icon: Settings, href: "/admin" },
    ],
  },
];

function isChildActive(children: SubItem[], path: string) {
  return children.some((c) => path === c.href || path.startsWith(c.href + "/"));
}

function NavLeaf({ item, path, onNavigate }: { item: NavItem & { href: string }; path: string; onNavigate?: () => void }) {
  const active = item.href === "/"
    ? path === "/"
    : path === item.href || path.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-gray-400")} />
      {item.label}
    </Link>
  );
}

function NavAccordion({ item, path, onNavigate }: { item: NavItem & { children: SubItem[] }; path: string; onNavigate?: () => void }) {
  const defaultOpen = isChildActive(item.children, path);
  const [open, setOpen] = useState(defaultOpen);

  // R2 — Sync accordion open state when path changes
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
          defaultOpen
            ? "text-blue-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", defaultOpen ? "text-blue-600" : "text-gray-400")} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="relative ml-[22px] mt-0.5 space-y-0.5 pl-4 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-gray-200">
          {item.children.map((child) => {
            const childActive = path === child.href || path.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors",
                  childActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", childActive ? "bg-blue-500" : "bg-gray-300")} />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto bg-white border-r border-gray-200 lg:flex sticky top-14 h-[calc(100vh-3.5rem)]">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) =>
                item.children ? (
                  <NavAccordion key={item.label} item={item as NavItem & { children: SubItem[] }} path={path} onNavigate={onNavigate} />
                ) : (
                  <NavLeaf key={item.href} item={item as NavItem & { href: string }} path={path} onNavigate={onNavigate} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-500 text-[11px] font-bold text-white shrink-0">
            RL
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">Rachmad Mahendra</p>
            <p className="text-[10px] text-gray-400 truncate">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
