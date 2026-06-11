"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DropZone } from "@/components/upload/DropZone";
import { PageHeader, DataCard, SectionLabel } from "@/components/ui-kit";
import {
  BadgeCheck, BookOpen, FileSpreadsheet, FileStack, FileText,
  Gauge, Scale, ScanLine, TrendingUp, Building2, ArrowRight, ScrollText, FileCheck, type LucideIcon,
} from "lucide-react";
import { DocumentType, companiesApi, Statement, CompanySummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
    key: "bank_statement",
    label: "Bank Statement",
    sub: "Akan diparse transaksinya",
    icon: FileText,
    iconBg: "bg-violet-50",
    iconText: "text-violet-700",
  },
  {
    key: "profit_loss",
    label: "Profit & Loss",
    sub: "Disimpan sebagai dokumen",
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
  },
  {
    key: "cash_flow",
    label: "Cash Flow",
    sub: "Disimpan sebagai dokumen",
    icon: Scale,
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
  },
  {
    key: "balance_sheet",
    label: "Balance Sheet",
    sub: "Disimpan sebagai dokumen",
    icon: FileSpreadsheet,
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
  },
  {
    key: "other",
    label: "Dokumen Lain",
    sub: "Disimpan sebagai dokumen",
    icon: BookOpen,
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
  },
  {
    key: "nib",
    label: "Dokumen NIB",
    sub: "Disimpan sebagai dokumen",
    icon: ScrollText,
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
  },
  {
    key: "ahu",
    label: "Dokumen AHU",
    sub: "Disimpan sebagai dokumen",
    icon: Building2,
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
  },
  {
    key: "akta",
    label: "Akta Pendirian / Perubahan",
    sub: "Disimpan sebagai dokumen",
    icon: FileCheck,
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
  },
];

type GuideItem = { icon: LucideIcon; title: string; desc: string };

const GUIDES: Record<DocumentType, GuideItem[]> = {
  bank_statement: [
    { icon: FileStack, title: "Upload file", desc: "PDF, CSV, XLSX bisa diproses bersamaan." },
    { icon: Gauge, title: "Pantau progres", desc: "Halaman, row, dan ETA tampil real-time." },
    { icon: BadgeCheck, title: "Review hasil", desc: "Buka statement untuk transaksi, red flag, export." },
  ],
  profit_loss: [
    { icon: TrendingUp, title: "Upload P&L", desc: "Laporan laba rugi dalam format PDF/Excel." },
    { icon: FileStack, title: "Multi-file", desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  cash_flow: [
    { icon: Scale, title: "Upload Cash Flow", desc: "Laporan arus kas dalam format PDF/Excel." },
    { icon: FileStack, title: "Multi-file", desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  balance_sheet: [
    { icon: FileSpreadsheet, title: "Upload Balance Sheet", desc: "Neraca dalam format PDF/Excel." },
    { icon: FileStack, title: "Multi-file", desc: "Upload beberapa periode sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  other: [
    { icon: BookOpen, title: "Upload Dokumen", desc: "SKU, SIUP, akta, atau dokumen pendukung lainnya." },
    { icon: FileStack, title: "Multi-file", desc: "Upload banyak file sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  nib: [
    { icon: ScrollText, title: "Upload NIB", desc: "Nomor Induk Berusaha atau dokumen legalitas usaha." },
    { icon: FileStack, title: "Multi-file", desc: "Upload banyak file sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  ahu: [
    { icon: Building2, title: "Upload AHU", desc: "Dokumen legalitas badan hukum dari Kemenkumham." },
    { icon: FileStack, title: "Multi-file", desc: "Upload banyak file sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
  akta: [
    { icon: FileCheck, title: "Upload Akta", desc: "Akta pendirian atau perubahan terakhir perusahaan." },
    { icon: FileStack, title: "Multi-file", desc: "Upload banyak file sekaligus." },
    { icon: BadgeCheck, title: "Tersimpan", desc: "Dokumen bisa diakses di halaman perusahaan." },
  ],
};

const INFOBANNER: Record<DocumentType, string> = {
  bank_statement: "Pilih banyak file sekaligus — sistem identifikasi bank dan mulai parsing otomatis.",
  profit_loss: "Laporan P&L akan disimpan sebagai dokumen pendukung perusahaan.",
  cash_flow: "Laporan Cash Flow akan disimpan sebagai dokumen pendukung perusahaan.",
  balance_sheet: "Balance Sheet akan disimpan sebagai dokumen pendukung perusahaan.",
  other: "Dokumen akan disimpan dan bisa diakses melalui halaman perusahaan.",
  nib: "Upload NIB untuk kelengkapan data legalitas perusahaan.",
  ahu: "Upload dokumen AHU sebagai bukti badan hukum perusahaan.",
  akta: "Upload akta pendirian atau perubahan terakhir perusahaan.",
};

export default function UploadPage() {
  const [docType, setDocType] = useState<DocumentType>("bank_statement");
  const active = DOC_TYPES.find((d) => d.key === docType)!;
  const guide = GUIDES[docType];

  // UP1 — auto-detect perusahaan dari account holder
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [suggestedCompany, setSuggestedCompany] = useState<{ company: CompanySummary; statement: Statement } | null>(null);

  // UP3 — Upload history
  const [uploadHistory, setUploadHistory] = useState<{ name: string; status: string; time: string }[]>([]);

  useEffect(() => {
    companiesApi.list().then(({ data }) => setCompanies(data)).catch(() => { });
  }, []);

  const handleStatementReady = (statement: Statement) => {
    // UP3 — add to upload history
    setUploadHistory((prev) => [{ name: statement.original_filename, status: statement.status, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) }, ...prev].slice(0, 5));

    if (!statement.account_holder || docType !== "bank_statement") return;
    const holder = statement.account_holder.toLowerCase().trim();
    const match = companies.find((c) => {
      const name = c.company.name.toLowerCase();
      // Match by name similarity — company name contains account holder or vice versa
      return name.includes(holder) || holder.includes(name) ||
        name.split(/\s+/).some((w) => w.length > 3 && holder.includes(w));
    });
    if (match) {
      setSuggestedCompany({ company: match, statement });
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Parser workspace"
          title="Upload Dokumen"
          description="Pilih jenis dokumen lalu upload file"
        />

        {/* Info banner */}
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          <ScanLine className="h-4 w-4 shrink-0" />
          <span>{INFOBANNER[docType]}</span>
        </div>

        {/* UP1 — Auto-detect suggestion */}
        {suggestedCompany && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800">
                  Perusahaan terdeteksi: <span className="font-bold">{suggestedCompany.company.company.name}</span>
                </p>
                <p className="text-xs text-emerald-600 mt-0.5 truncate">
                  Account holder "{suggestedCompany.statement.account_holder}" cocok dengan perusahaan yang sudah terdaftar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/companies/${suggestedCompany.company.company.id}`}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Buka Profil <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                onClick={() => setSuggestedCompany(null)}
                className="text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

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
                      ? "border-violet-300 bg-violet-50 text-violet-800 shadow-sm"
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
                    <p className={cn("text-[10px]", isActive ? "text-violet-600" : "text-slate-400")}>
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
            <DropZone documentType={docType} key={docType} onStatementReady={handleStatementReady} />
          </div>

          {/* Right: Guide for selected type */}
          <aside className="space-y-3">
            {/* UP3 — Upload history */}
            {uploadHistory.length > 0 && (
              <DataCard padding="compact">
                <SectionLabel className="mb-3">Upload Terakhir</SectionLabel>
                <div className="space-y-2">
                  {uploadHistory.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${h.status === "done" ? "bg-emerald-400" : h.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                      <span className="text-slate-600 truncate flex-1">{h.name.slice(0, 24)}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{h.time}</span>
                    </div>
                  ))}
                </div>
              </DataCard>
            )}
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
                    <p className="text-sm font-bold text-violet-600">{v}</p>
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
