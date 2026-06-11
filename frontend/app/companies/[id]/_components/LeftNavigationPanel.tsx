import React from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import type { ActiveTab } from "../_lib/company-detail-types";

interface Tab {
  key: ActiveTab;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  active: string;
  idle: string;
}

interface Props {
  tabs: Tab[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  companyId: string;
}

export function LeftNavigationPanel({ tabs, activeTab, onTabChange, companyId }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800 mb-0.5">Navigasi Analisis</p>
      <p className="text-xs text-slate-400 mb-4">Pilih area kerja untuk perusahaan ini.</p>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tab Halaman</p>
        <div className="grid gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
                  isActive
                    ? "border-violet-300 bg-violet-50 text-violet-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${isActive ? tab.active : tab.idle} ring-current/20`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{tab.label}</p>
                  <p className={`truncate text-[10px] ${isActive ? "text-violet-600" : "text-slate-400"}`}>
                    {tab.helper}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Halaman Penuh</p>
          <Link
            href={`/companies/${companyId}/memo`}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 bg-amber-50 text-amber-600 ring-amber-200/60">
              <ScrollText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700 group-hover:text-amber-800">Credit Memo</p>
              <p className="truncate text-[10px] text-slate-400 group-hover:text-amber-600">Fasilitas, 5C, sumber pembayaran, dan status</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
