"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "@/components/ui-kit/CommandPalette";
import { KeyboardHelp } from "./KeyboardHelp";
import {
  ChevronDown, ChevronRight, CircleHelp,
  List, Menu, Search, Shield, X, Bell,
  CheckCircle2, AlertTriangle, FileText, Building2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  companies:      "Portfolio Debitur",
  statements:     "Bank Statement",
  upload:         "Upload Dokumen",
  analytics:      "Insights",
  admin:          "Pengaturan",
  "idebt-parser": "iDEB Parser",
  loans:          "Fasilitas Kredit",
  watchlist:      "Watch List",
  memo:           "Credit Memo",
  npl:            "NPL Tracker",
};

interface Notif {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconText: string;
}

const MOCK_NOTIFS: Notif[] = [
  { id: "1", title: "Statement gagal diparse", body: "BCA — rekening_jan.pdf tidak dapat dibaca. Coba re-parse.", time: "5 menit lalu", unread: true, icon: AlertTriangle, iconBg: "bg-red-50", iconText: "text-red-500" },
  { id: "2", title: "Parsing selesai", body: "Mandiri — statement_feb.pdf berhasil diparse (243 transaksi).", time: "18 menit lalu", unread: true, icon: CheckCircle2, iconBg: "bg-emerald-50", iconText: "text-emerald-500" },
  { id: "3", title: "Statement perlu review", body: "BNI — saldo akhir tidak sesuai. Delta Rp 450.000.", time: "1 jam lalu", unread: false, icon: AlertTriangle, iconBg: "bg-amber-50", iconText: "text-amber-500" },
  { id: "4", title: "Perusahaan baru ditambahkan", body: "PT Maju Bersama berhasil dibuat dan siap menerima dokumen.", time: "2 jam lalu", unread: false, icon: Building2, iconBg: "bg-violet-50", iconText: "text-violet-500" },
  { id: "5", title: "5 statement diupload", body: "Batch upload selesai — 4 berhasil, 1 gagal.", time: "3 jam lalu", unread: false, icon: FileText, iconBg: "bg-indigo-50", iconText: "text-indigo-500" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useBreadcrumbs(path: string): { label: string; href: string }[] {
  const segments = path.split("/").filter(Boolean);
  const result: { label: string; href: string }[] = [];
  let cumulativePath = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    cumulativePath += "/" + seg;
    if (UUID_RE.test(seg)) continue; // skip UUIDs
    const label = ROUTE_LABELS[seg] ?? seg;
    result.push({ label, href: cumulativePath });
  }
  return result;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const breadcrumbs = useBreadcrumbs(path);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setPaletteOpen(true); return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); setPaletteOpen(true); return;
      }
      if ((e.key === "u" || e.key === "U") && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        router.push("/upload"); return;
      }
      // R7 — Keyboard shortcut help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); setHelpOpen(true); return;
      }
      if (e.key === "Escape") { setMobileOpen(false); setHelpOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ── Header (full width, on top) ── */}
      <header className="sticky top-0 z-20 h-14 w-full border-b border-gray-200 bg-white shadow-sm">
        <div className="h-full w-full flex items-center pl-0 pr-4 sm:pr-6">

          {/* Left */}
          <div className="flex items-center flex-1 min-w-0 gap-1 pl-6">
            <Link href="/" className="mr-2 shrink-0">
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-2 rounded-lg hover:shadow-md transition-shadow">
                <Shield className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
            </Link>

            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title="Collapse Sidebar"
              className="hidden xl:flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 mr-1"
            >
              <List className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              onClick={() => setMobileOpen(true)}
              className="xl:hidden flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 mr-1"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <nav aria-label="Breadcrumb" className="text-gray-700 min-w-0">
              <ol className="flex items-center gap-1.5 text-sm">
                <li className="flex items-center">
                  <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors text-sm">
                    CREDO
                  </Link>
                </li>
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-gray-900 font-medium truncate" aria-current="page">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="text-gray-500 hover:text-gray-700 transition-colors truncate">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center w-72 h-9 bg-gray-50 rounded-md border border-gray-200 px-3 cursor-pointer hover:bg-gray-100 transition-colors gap-2"
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm text-gray-500 text-left">Search...</span>
              <kbd className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">⌘K</kbd>
            </button>

            <button
              onClick={() => setPaletteOpen(true)}
              className="md:hidden flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              aria-label="Help"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* X6 — Notification bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                aria-label="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">Notifikasi</p>
                      <button onClick={() => setNotifOpen(false)}>
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                      {MOCK_NOTIFS.map((n) => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${n.unread ? "bg-violet-50/40" : ""}`}>
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.iconBg}`}>
                            <n.icon className={`h-3.5 w-3.5 ${n.iconText}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 leading-snug">{n.title}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                            <p className="text-[10px] text-gray-300 mt-1">{n.time}</p>
                          </div>
                          {n.unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-violet-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                      <p className="text-[11px] text-gray-400 text-center">Notifikasi real-time aktif setelah integrasi webhook</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="flex items-center gap-2 h-9 px-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
              <div className="h-6 w-6 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-white">RM</span>
              </div>
              <p className="hidden lg:block text-sm font-medium text-gray-700 whitespace-nowrap">Rachmad Mahendra</p>
            </button>
          </div>
        </div>
      </header>

      {/* ── Below header: sidebar + content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            fixed inset-y-0 left-0 z-40 pt-14 transition-transform duration-200
            lg:relative lg:z-auto lg:translate-x-0 lg:pt-0
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="relative h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} collapsed={!sidebarOpen} />
          </div>
        </div>

        {/* Page content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 md:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
