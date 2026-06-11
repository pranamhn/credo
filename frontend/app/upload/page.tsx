"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DropZone } from "@/components/upload/DropZone";
import { PageHeader, SectionLabel } from "@/components/ui-kit";
import {
  BookOpen, Building2, CheckCircle2, FileCheck, FileSpreadsheet,
  FileStack, FileText, ScrollText, TrendingUp, Scale, ScanLine,
  ArrowRight, type LucideIcon,
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
  { key: "bank_statement", label: "Bank Statement",           sub: "Diparse otomatis",        icon: FileText,        iconBg: "bg-violet-50",  iconText: "text-violet-700" },
  { key: "profit_loss",    label: "Profit & Loss",            sub: "Dokumen keuangan",        icon: TrendingUp,      iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  { key: "cash_flow",      label: "Cash Flow",                sub: "Dokumen keuangan",        icon: Scale,           iconBg: "bg-amber-50",   iconText: "text-amber-600" },
  { key: "balance_sheet",  label: "Balance Sheet",            sub: "Dokumen keuangan",        icon: FileSpreadsheet, iconBg: "bg-indigo-50",  iconText: "text-indigo-600" },
  { key: "nib",            label: "Dokumen NIB",              sub: "Legalitas usaha",         icon: ScrollText,      iconBg: "bg-sky-50",     iconText: "text-sky-600" },
  { key: "ahu",            label: "Dokumen AHU",              sub: "Badan hukum",             icon: Building2,       iconBg: "bg-violet-50",  iconText: "text-violet-600" },
  { key: "akta",           label: "Akta Pendirian",           sub: "Perubahan perusahaan",    icon: FileCheck,       iconBg: "bg-rose-50",    iconText: "text-rose-600" },
  { key: "other",          label: "Dokumen Lain",             sub: "Pendukung lainnya",       icon: BookOpen,        iconBg: "bg-slate-100",  iconText: "text-slate-500" },
];

// Next-step CTAs per doc type after upload completes
const NEXT_STEPS: Record<DocumentType, { title: string; desc: string; links: { label: string; href: string; primary?: boolean }[] }> = {
  bank_statement: {
    title: "Statement berhasil diupload",
    desc: "Parsing berjalan otomatis. Buka statement untuk melihat transaksi, flag anomali, dan ringkasan cashflow.",
    links: [
      { label: "Lihat Semua Statement", href: "/documents", primary: true },
      { label: "Dashboard", href: "/" },
    ],
  },
  profit_loss: {
    title: "Laporan P&L tersimpan",
    desc: "Dokumen bisa diakses melalui halaman perusahaan di tab Dokumen.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  cash_flow: {
    title: "Cash Flow tersimpan",
    desc: "Dokumen bisa diakses melalui halaman perusahaan di tab Dokumen.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  balance_sheet: {
    title: "Balance Sheet tersimpan",
    desc: "Dokumen bisa diakses melalui halaman perusahaan di tab Dokumen.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  nib: {
    title: "Dokumen NIB tersimpan",
    desc: "NIB tersedia di profil perusahaan untuk kelengkapan data legalitas.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  ahu: {
    title: "Dokumen AHU tersimpan",
    desc: "Dokumen AHU tersedia di profil perusahaan.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  akta: {
    title: "Akta tersimpan",
    desc: "Akta pendirian/perubahan tersedia di profil perusahaan.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
  other: {
    title: "Dokumen tersimpan",
    desc: "Dokumen bisa diakses melalui halaman perusahaan di tab Dokumen.",
    links: [
      { label: "Lihat Portfolio Debitur", href: "/companies", primary: true },
    ],
  },
};

export default function UploadPage() {
  const [docType, setDocType] = useState<DocumentType>("bank_statement");
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [completedStatements, setCompletedStatements] = useState<Statement[]>([]);
  const [detectedCompany, setDetectedCompany] = useState<{ company: CompanySummary; statement: Statement } | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const active = DOC_TYPES.find((d) => d.key === docType)!;
  const nextStep = NEXT_STEPS[docType];
  const hasCompleted = completedStatements.length > 0;

  useEffect(() => {
    companiesApi.list().then(({ data }) => setCompanies(data)).catch(() => {});
  }, []);

  // Reset completed state when doc type changes
  useEffect(() => {
    setCompletedStatements([]);
    setDetectedCompany(null);
  }, [docType]);

  const handleStatementReady = (statement: Statement) => {
    setCompletedStatements((prev) => [statement, ...prev]);

    if (!statement.account_holder || docType !== "bank_statement") return;
    const holder = statement.account_holder.toLowerCase().trim();
    const match = companies.find((c) => {
      const name = c.company.name.toLowerCase();
      return name.includes(holder) || holder.includes(name) ||
        name.split(/\s+/).some((w) => w.length > 3 && holder.includes(w));
    });
    if (match) setDetectedCompany({ company: match, statement });
  };

  const handleUploadMore = () => {
    setCompletedStatements([]);
    setDetectedCompany(null);
    setUploadKey((k) => k + 1);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Analisis"
          title="Upload Dokumen"
          description="Pilih jenis dokumen, upload file, lalu sistem akan memandu langkah selanjutnya"
        />

        {/* Post-upload: Next steps panel */}
        {hasCompleted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-800">{nextStep.title}</p>
                <p className="mt-1 text-xs text-emerald-600 leading-relaxed">{nextStep.desc}</p>

                {/* Detected company */}
                {detectedCompany && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2">
                    <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-700 min-w-0">
                      Terdeteksi: <span className="font-semibold">{detectedCompany.company.company.name}</span>
                    </p>
                    <Link
                      href={`/companies/${detectedCompany.company.company.id}`}
                      className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 shrink-0"
                    >
                      Buka Profil <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {/* CTA buttons */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {nextStep.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors shadow-sm",
                        link.primary
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                      )}
                    >
                      {link.label} {link.primary && <ArrowRight className="h-3.5 w-3.5" />}
                    </Link>
                  ))}
                  <button
                    onClick={handleUploadMore}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Upload File Lain
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info banner — hanya saat belum ada hasil */}
        {!hasCompleted && (
          <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            <ScanLine className="h-4 w-4 shrink-0" />
            <span>
              {docType === "bank_statement"
                ? "Pilih banyak file sekaligus — sistem identifikasi bank dan parsing otomatis."
                : "Dokumen akan disimpan dan bisa diakses melalui halaman perusahaan."}
            </span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
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

            {/* Quick links */}
            <div className="pt-3 space-y-1 border-t border-slate-100">
              <SectionLabel className="mb-2">Lihat Hasil</SectionLabel>
              {[
                { label: "Bank Statement", href: "/documents", icon: FileText },
                { label: "Portfolio Debitur", href: "/companies", icon: Building2 },
                { label: "Dashboard", href: "/", icon: FileStack },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  <ArrowRight className="h-3 w-3 ml-auto opacity-40" />
                </Link>
              ))}
            </div>
          </div>

          {/* Center: Drop zone */}
          <div className="min-w-0">
            <SectionLabel className="mb-2">{active.label}</SectionLabel>
            <DropZone
              key={`${docType}-${uploadKey}`}
              documentType={docType}
              onStatementReady={handleStatementReady}
            />

            {/* Format hint */}
            <p className="mt-3 text-center text-[11px] text-slate-400">
              {docType === "bank_statement"
                ? "PDF · CSV · XLSX — max 50 MB · multiple file didukung · 20+ format bank"
                : "PDF · XLSX · CSV — max 50 MB per file"}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
