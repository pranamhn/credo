"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DropZone } from "@/components/upload/DropZone";
import { PageHeader, DataCard, SectionLabel } from "@/components/ui-kit";
import {
  BadgeCheck, BookOpen, FileSpreadsheet, FileStack, FileText,
  Gauge, Scale, ScanLine, TrendingUp, type LucideIcon,
} from "lucide-react";
import { DocumentType } from "@/lib/api";
import { cn } from "@/lib/utils";

type DocOption = {
  key: DocumentType;
  label: string;
  sub: string;
  icon: LucideIcon;
  iconBg: string;
  iconText: string;
};

const DOC_TYPES: DocOption[] = [
  {
    key:      "bank_statement",
    label:    "Bank Statement",
    sub:      "Akan diparse transaksinya",
    icon:     FileText,
    iconBg:   "bg-teal-50",
    iconText: "text-teal-700",
  },
  {
    key:      "profit_loss",
    label:    "Profit & Loss",
    sub:      "Disimpan sebagai dokumen",
    icon:     TrendingUp,
    iconBg:   "bg-emerald-50",
    iconText: "text-emerald-600",
  },
  {
    key:      "cash_flow",
    label:    "Cash Flow",
    sub:      "Disimpan sebagai dokumen",
    icon:     Scale,
    iconBg:   "bg-amber-50",
    iconText: "text-amber-600",
  },
  {
    key:      "balance_sheet",
    label:    "Balance Sheet",
    sub:      "Disimpan sebagai dokumen",
    icon:     FileSpreadsheet,
    iconBg:   "bg-indigo-50",
    iconText: "text-indigo-600",
  },
  {
    key:      "other",
    label:    "Dokumen Lain",
    sub:      "Disimpan sebagai dokumen",
    icon:     BookOpen,
    iconBg:   "bg-slate-100",
    iconText: "text-slate-500",
  },
];

type GuideItem = { icon: LucideIcon; title: string; desc: string };

const GUIDES: Record<DocumentType, GuideItem[]> = {
  bank_statement: [
    { icon: FileStack, title: "Upload file",     desc: "PDF, CSV, XLSX bisa diproses bersamaan." },
    { icon: Gauge,     title: "Pantau progres",  desc: "Halaman, row, dan ETA tampil real-time." },
    { icon: BadgeCheck,title: "Review hasil",    desc: "Buka statement untuk transaksi, red flag, export." },
  ],
  profit_loss: [
    { icon: TrendingUp, title: "Upload P&L",    desc: "Laporan laba rugi dalam format PDF/Excel." },
    { icon: FileStack,  title: "Multi-file",    desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan",     desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  cash_flow: [
    { icon: Scale,     title: "Upload Cash Flow", desc: "Laporan arus kas dalam format PDF/Excel." },
    { icon: FileStack, title: "Multi-file",       desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck,title: "Tersimpan",        desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  balance_sheet: [
    { icon: FileSpreadsheet, title: "Upload Balance Sheet", desc: "Neraca dalam format PDF/Excel." },
    { icon: FileStack,       title: "Multi-file",           desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck,      title: "Tersimpan",            desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  other: [
    { icon: BookOpen,  title: "Upload Dokumen", desc: "SKU, SIUP, akta, atau dokumen pendukung lainnya." },
    { icon: FileStack, title: "Multi-file",     desc: "Upload banyak file sekaligus." },
    { icon: BadgeCheck,title: "Tersimpan",      desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
};

const INFOBANNER: Record<DocumentType, string> = {
  bank_statement: "Pilih banyak file sekaligus — sistem identifikasi bank dan mulai parsing otomatis.",
  profit_loss:    "Laporan P&L akan disimpan sebagai dokumen pendukung perusahaan.",
  cash_flow:      "Laporan Cash Flow akan disimpan sebagai dokumen pendukung perusahaan.",
  balance_sheet:  "Balance Sheet akan disimpan sebagai dokumen pendukung perusahaan.",
  other:          "Dokumen akan disimpan dan bisa diakses melalui halaman perusahaan.",
};

export default function UploadPage() {
  const [docType, setDocType] = useState<DocumentType>("bank_statement");
  const active = DOC_TYPES.find((d) => d.key === docType)!;
  const guide = GUIDES[docType];

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Parser workspace"
          title="Upload Dokumen"
          description="Pilih jenis dokumen lalu upload file"
        />

        {/* Info banner */}
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          <ScanLine className="h-4 w-4 shrink-0" />
          <span>{INFOBANNER[docType]}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr_260px]">
          {/* Left: Document type selector */}
          <div className="space-y-1.5">
            <SectionLabel className="mb-2">Jenis Dokumen</SectionLabel>
            {DOC_TYPES.map((opt) => {
              const isActive = docType === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setDocType(opt.key)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg border p-2.5 text-left transition-all",
                    isActive
                      ? "border-teal-300 bg-teal-50 text-teal-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
                    opt.iconBg, opt.iconText,
                    isActive ? "ring-current/20" : "ring-slate-200"
                  )}>
                    <opt.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className={cn("text-[10px]", isActive ? "text-teal-600" : "text-slate-400")}>
                      {opt.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center: Drop zone for selected type */}
          <div className="min-w-0">
            <SectionLabel className="mb-2">{active.label}</SectionLabel>
            <DropZone documentType={docType} key={docType} />
          </div>

          {/* Right: Guide for selected type */}
          <aside className="space-y-3">
            <DataCard padding="compact">
              <SectionLabel className="mb-4">Panduan</SectionLabel>
              <div className="space-y-4">
                {guide.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
                      active.iconBg, active.iconText, "ring-current/20"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{title}</p>
                      <p className="text-xs leading-5 text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>

            {docType === "bank_statement" && (
              <div className="grid grid-cols-3 gap-2">
                {[["20+", "Bank"], ["OCR", "Ready"], ["Auto", "Format"]].map(([v, l]) => (
                  <div key={v} className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-sm">
                    <p className="text-sm font-bold text-teal-600">{v}</p>
                    <p className="text-[10px] text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
            )}

            {docType === "bank_statement" ? (
              [
                ["Format terbaik", "Gunakan file asli dari internet/mobile banking."],
                ["File besar", "Transaksi diambil bertahap sampai semua row tampil."],
              ].map(([t, d]) => (
                <DataCard key={String(t)} padding="compact">
                  <p className="text-xs font-semibold text-slate-600">{String(t)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{String(d)}</p>
                </DataCard>
              ))
            ) : (
              <DataCard padding="compact">
                <p className="text-xs font-semibold text-slate-600">Format yang didukung</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">PDF, Excel (XLSX/XLS), dan CSV diterima.</p>
              </DataCard>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
