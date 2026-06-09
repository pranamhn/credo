"use client";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Trash2, ChevronDown, ChevronUp, AlertCircle, Lock, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit";
import {
  slikApi, cbiApi, companiesApi,
  SlikReport, SlikFasilitas,
  CbiReport, CbiFasilitas,
  CompanySummary,
} from "@/lib/api";
import { toast } from "sonner";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatIDR(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const KUALITAS_LABEL: Record<string, string> = {
  "1": "Lancar", "2": "DPK", "3": "Kurang Lancar", "4": "Diragukan", "5": "Macet",
};
const KUALITAS_COLOR: Record<string, string> = {
  "1": "bg-emerald-100 text-emerald-800",
  "2": "bg-yellow-100 text-yellow-800",
  "3": "bg-orange-100 text-orange-800",
  "4": "bg-red-100 text-red-700",
  "5": "bg-red-200 text-red-900",
};

function KolBadge({ val }: { val: string }) {
  const k = val.replace(/\D.*/g, "");
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${KUALITAS_COLOR[k] ?? "bg-gray-100 text-gray-600"}`}>
      {k} – {KUALITAS_LABEL[k] ?? val}
    </span>
  );
}

function trafficLightConfig(worst: number) {
  if (worst <= 1) return { color: "bg-emerald-500", ring: "ring-emerald-200", label: "Lancar", desc: "Semua fasilitas dalam kondisi Lancar.", text: "text-emerald-700" };
  if (worst === 2) return { color: "bg-yellow-400", ring: "ring-yellow-200", label: "DPK", desc: "Dalam Perhatian Khusus — ada fasilitas yang perlu dipantau.", text: "text-yellow-700" };
  if (worst === 3) return { color: "bg-orange-500", ring: "ring-orange-200", label: "Kurang Lancar", desc: "Fasilitas Kurang Lancar terdeteksi — risiko moderat.", text: "text-orange-700" };
  if (worst === 4) return { color: "bg-red-500", ring: "ring-red-200", label: "Diragukan", desc: "Fasilitas Diragukan terdeteksi — risiko tinggi.", text: "text-red-700" };
  return { color: "bg-red-800", ring: "ring-red-300", label: "Macet", desc: "Fasilitas Macet (NPL) terdeteksi — risiko sangat tinggi.", text: "text-red-900" };
}

const KOL_COLORS: Record<number, string> = { 1: "bg-emerald-500", 2: "bg-yellow-400", 3: "bg-orange-500", 4: "bg-red-500", 5: "bg-red-800" };

function TrafficLightWidget({ kols }: { kols: number[] }) {
  const values = kols.length > 0 ? kols : [1];
  const worst = Math.max(...values);
  const best = Math.min(...values);
  const cfg = trafficLightConfig(worst);
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Indikator Kualitas Kredit</h3>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${cfg.ring} ${cfg.text}`}>
          <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${cfg.color}`} />
          Terburuk: Kol {worst} – {cfg.label}
        </span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <div key={lvl} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full transition-all ${KOL_COLORS[lvl]} ${lvl === worst ? "opacity-100 ring-2 ring-offset-2 ring-slate-300 scale-110" : "opacity-20"}`} />
              <span className={`text-[9px] font-semibold ${lvl === worst ? "text-slate-700" : "text-slate-300"}`}>Kol {lvl}</span>
            </div>
          ))}
          <div className="ml-4 flex-1">
            <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
          </div>
        </div>
        {best < worst && (
          <p className="text-[11px] text-slate-400">Rentang: Kol {best} – Kol {worst} dari {values.length} data poin</p>
        )}
      </div>
    </div>
  );
}

type BureauCardTone = "blue" | "amber" | "emerald" | "rose" | "slate";
const bureauCardTone: Record<BureauCardTone, string> = {
  blue: "bg-blue-600",
  amber: "bg-amber-500",
  emerald: "bg-emerald-600",
  rose: "bg-rose-600",
  slate: "bg-slate-600",
};

function BureauStatCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: BureauCardTone;
}) {
  const accent = bureauCardTone[tone];
  return (
    <div className="group relative h-full cursor-default overflow-hidden rounded-2xl border-2 border-blue-100 bg-white p-5 transition-all duration-500 ease-out hover:-translate-y-2 hover:border-blue-300 hover:shadow-2xl">
      <div className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${accent}`} />
      <div className={`absolute bottom-0 right-0 h-24 w-24 translate-x-6 translate-y-6 rounded-full opacity-5 transition-transform duration-500 group-hover:scale-125 ${accent}`} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <div className={`h-6 w-1 rounded-full ${accent}`} />
            <h6 className="text-xs font-bold uppercase tracking-wider text-blue-600">{label}</h6>
          </div>
          <div className="mt-3 min-w-0">
            <p className="truncate text-xl font-black leading-none text-slate-950" title={value}>{value}</p>
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-slate-400">total keseluruhan</span>
          </div>
        </div>
        <div className={`shrink-0 rounded-2xl p-3 text-white shadow-lg ${accent}`}>
          {icon ?? <FileText className="h-[22px] w-[22px]" />}
        </div>
      </div>
    </div>
  );
}

// ── SLIK ─────────────────────────────────────────────────────────────────────

function buildSlikRiskSummary(report: SlikReport): string {
  const d = report.parsed_data?.debitur;
  const fasilitas = report.parsed_data?.fasilitas ?? [];
  const nama = d?.nama ?? report.nama_debitur ?? "debitur";
  const nFas = report.jumlah_fasilitas ?? fasilitas.length;
  const nKred = report.jumlah_kreditur ?? 0;
  const kols: number[] = [];
  for (const f of fasilitas) {
    if (f.kualitas_history.length) kols.push(...f.kualitas_history.map(Number).filter(Boolean));
    else if (f.kualitas) { const v = parseInt(f.kualitas[0]); if (!isNaN(v)) kols.push(v); }
  }
  const worst = kols.length ? Math.max(...kols) : null;
  const totalPlafon = report.parsed_data?.total_plafon ?? 0;
  const totalBaki = report.parsed_data?.total_baki_debet ?? 0;
  const util = totalPlafon > 0 ? Math.round((totalBaki / totalPlafon) * 100) : null;
  const parts: string[] = [];
  parts.push(`Berdasarkan laporan SLIK OJK atas nama ${nama}, tercatat ${nFas} fasilitas kredit${nKred > 0 ? ` dari ${nKred} kreditur` : ""}.`);
  if (totalPlafon > 0) parts.push(`Total plafon ${formatIDR(totalPlafon)} dengan outstanding ${formatIDR(totalBaki)}${util !== null ? ` (utilisasi ${util}%)` : ""}.`);
  if (worst !== null) {
    if (worst === 1) parts.push("Seluruh fasilitas berstatus Lancar (Kol 1) — tidak ada indikasi risiko kredit signifikan.");
    else if (worst === 2) parts.push(`Kolektibilitas terburuk DPK (Kol ${worst}) — debitur perlu dipantau namun belum NPL.`);
    else if (worst === 3) parts.push(`Terdapat fasilitas Kurang Lancar (Kol ${worst}) — analisis mendalam diperlukan.`);
    else if (worst === 4) parts.push(`Fasilitas Diragukan (Kol ${worst}) — risiko gagal bayar tinggi.`);
    else parts.push(`Fasilitas Macet (Kol ${worst}) — status NPL. Rekomendasikan penolakan atau penjaminan penuh.`);
  }
  if (nFas > 5) parts.push(`Jumlah fasilitas tinggi (${nFas}) dapat mengindikasikan ketergantungan pada pembiayaan eksternal.`);
  return parts.join(" ");
}

function SlikFasilitasCard({ f, idx }: { f: SlikFasilitas; idx: number }) {
  const [open, setOpen] = useState(false);
  const worstKol = f.kualitas_history.length
    ? Math.max(...f.kualitas_history.map(Number)).toString()
    : f.kualitas ? f.kualitas[0] : "1";
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-xs font-bold shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{f.kreditur || "—"}</p>
          <p className="text-xs text-slate-500">{f.jenis_kredit || "—"}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-slate-400">Plafon</p>
            <p className="text-xs font-medium text-slate-700">{formatIDR(f.plafon)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-slate-400">Baki Debet</p>
            <p className="text-xs font-medium text-slate-700">{formatIDR(f.baki_debet)}</p>
          </div>
          {worstKol && <KolBadge val={worstKol} />}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Plafon", value: formatIDR(f.plafon) },
              { label: "Baki Debet", value: formatIDR(f.baki_debet) },
              { label: "Tgl Mulai", value: f.tanggal_mulai || "—" },
              { label: "Jatuh Tempo", value: f.tanggal_jatuh_tempo || "—" },
              { label: "Bunga", value: f.bunga || "—" },
              { label: "Agunan", value: f.agunan || "—" },
              { label: "Nilai Agunan", value: formatIDR(f.nilai_agunan) },
              { label: "Penjamin", value: f.penjamin || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
                <p className="text-xs text-slate-700 mt-0.5 font-medium truncate">{value}</p>
              </div>
            ))}
          </div>
          {f.kualitas_history.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Riwayat Kualitas ({f.kualitas_history.length} bulan)</p>
              <div className="flex flex-wrap gap-1">
                {f.kualitas_history.map((k, i) => (
                  <span key={i} title={`Bulan -${f.kualitas_history.length - i}: Kol ${k}`}
                    className={`h-6 w-6 flex items-center justify-center rounded text-[10px] font-bold ${KUALITAS_COLOR[k] ?? "bg-gray-100 text-gray-500"}`}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SlikDetail({ report }: { report: SlikReport }) {
  const d = report.parsed_data?.debitur;
  const fasilitas = report.parsed_data?.fasilitas ?? [];
  const kols: number[] = [];
  for (const f of fasilitas) {
    if (f.kualitas_history.length) kols.push(...f.kualitas_history.map(Number).filter(Boolean));
    else if (f.kualitas) { const v = parseInt(f.kualitas[0]); if (!isNaN(v)) kols.push(v); }
  }
  const worst = kols.length ? Math.max(...kols) : 1;
  const summary = buildSlikRiskSummary(report);
  const bgMap: Record<number, string> = {
    1: "bg-emerald-50 border-emerald-200 text-emerald-900",
    2: "bg-yellow-50 border-yellow-200 text-yellow-900",
    3: "bg-orange-50 border-orange-200 text-orange-900",
    4: "bg-red-50 border-red-200 text-red-900",
    5: "bg-red-100 border-red-300 text-red-900",
  };
  return (
    <div className="space-y-5">
      {report.parse_error && (
        <div className="flex gap-3 items-start rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div><p className="font-semibold">Parse error</p><p className="text-xs mt-0.5 font-mono">{report.parse_error}</p></div>
        </div>
      )}
      <TrafficLightWidget kols={kols} />
      {fasilitas.length > 0 && (
        <div className={`rounded-xl border px-5 py-4 ${bgMap[worst] ?? bgMap[1]}`}>
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-2">Ringkasan Risiko Otomatis — SLIK</p>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Nomor Laporan", value: report.nomor_laporan || "—", tone: "blue" as const },
          { label: "Tanggal Laporan", value: report.tanggal_laporan || "—", tone: "amber" as const },
          { label: "Pemohon", value: report.pemohon || "—", tone: "blue" as const },
          { label: "Halaman PDF", value: report.raw_pages?.toString() || "—", tone: "slate" as const },
        ].map(({ label, value, tone }) => (
          <BureauStatCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Data Pokok Debitur</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
          {[
            { label: "Nama", value: d?.nama ?? report.nama_debitur },
            { label: "No. Identitas (KTP/NIK)", value: d?.no_identitas ?? report.no_identitas },
            { label: "NPWP", value: d?.npwp ?? report.npwp },
            { label: "Tempat Lahir", value: d?.tempat_lahir },
            { label: "Tanggal Lahir", value: d?.tanggal_lahir ?? report.tanggal_lahir },
            { label: "Alamat", value: d?.alamat },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
              <p className="text-sm text-slate-800 mt-0.5">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Plafon", value: formatIDR(report.parsed_data?.total_plafon), tone: "blue" as const },
          { label: "Total Baki Debet", value: formatIDR(report.parsed_data?.total_baki_debet), tone: "amber" as const },
          { label: "Jumlah Kreditur", value: (report.jumlah_kreditur ?? 0).toString(), tone: "slate" as const },
          { label: "Jumlah Fasilitas", value: (report.jumlah_fasilitas ?? fasilitas.length).toString(), tone: "emerald" as const },
        ].map(({ label, value, tone }) => (
          <BureauStatCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      {fasilitas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Detail Fasilitas ({fasilitas.length})</h3>
          <div className="space-y-2">
            {fasilitas.map((f, i) => <SlikFasilitasCard key={i} f={f} idx={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CBI ──────────────────────────────────────────────────────────────────────

function CbiFasilitasCard({ f, idx }: { f: CbiFasilitas; idx: number }) {
  const [open, setOpen] = useState(false);
  const worstKol = f.kolektabilitas_history.length
    ? Math.max(...f.kolektabilitas_history.map(Number).filter(Boolean)).toString()
    : f.kolektabilitas?.replace(/\D.*/g, "") || "1";
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-xs font-bold shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{f.kreditur || "—"}</p>
          <p className="text-xs text-slate-500">{f.jenis_fasilitas || "—"}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-slate-400">Plafon</p>
            <p className="text-xs font-medium text-slate-700">{formatIDR(f.plafon)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-slate-400">Baki Debet</p>
            <p className="text-xs font-medium text-slate-700">{formatIDR(f.baki_debet)}</p>
          </div>
          {worstKol && <KolBadge val={worstKol} />}
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Plafon", value: formatIDR(f.plafon) },
              { label: "Baki Debet", value: formatIDR(f.baki_debet) },
              { label: "Tunggakan", value: formatIDR(f.tunggakan) },
              { label: "DPD (hari)", value: f.dpd != null ? f.dpd.toString() : "—" },
              { label: "Tgl Mulai", value: f.tanggal_mulai || "—" },
              { label: "Jatuh Tempo", value: f.tanggal_jatuh_tempo || "—" },
              { label: "Suku Bunga", value: f.suku_bunga || "—" },
              { label: "Kolektabilitas", value: f.kolektabilitas || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
                <p className="text-xs text-slate-700 mt-0.5 font-medium truncate">{value}</p>
              </div>
            ))}
          </div>
          {f.kolektabilitas_history.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Riwayat Kolektabilitas ({f.kolektabilitas_history.length} bulan)</p>
              <div className="flex flex-wrap gap-1">
                {f.kolektabilitas_history.map((k, i) => (
                  <span key={i} title={`Bulan -${f.kolektabilitas_history.length - i}: Kol ${k}`}
                    className={`h-6 w-6 flex items-center justify-center rounded text-[10px] font-bold ${KUALITAS_COLOR[k] ?? "bg-gray-100 text-gray-500"}`}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CbiDetail({ report }: { report: CbiReport }) {
  const d = report.parsed_data?.debitur;
  const aktif = report.parsed_data?.fasilitas_aktif ?? [];
  const selesai = report.parsed_data?.fasilitas_selesai ?? [];
  const kols: number[] = [];
  for (const f of aktif) {
    const hist = f.kolektabilitas_history.map(Number).filter((n) => n >= 1 && n <= 5);
    if (hist.length) kols.push(...hist);
    else if (f.kolektabilitas) { const n = parseInt(f.kolektabilitas); if (!isNaN(n)) kols.push(n); }
  }
  const worst = kols.length ? Math.max(...kols) : 1;
  const bgMap: Record<number, string> = {
    1: "bg-emerald-50 border-emerald-200 text-emerald-900",
    2: "bg-yellow-50 border-yellow-200 text-yellow-900",
    3: "bg-orange-50 border-orange-200 text-orange-900",
    4: "bg-red-50 border-red-200 text-red-900",
    5: "bg-red-100 border-red-300 text-red-900",
  };
  const summaryParts: string[] = [];
  const nama = d?.nama ?? report.nama_debitur ?? "debitur";
  summaryParts.push(`Berdasarkan laporan CBI atas nama ${nama}, tercatat ${report.jumlah_fasilitas_aktif ?? aktif.length} fasilitas aktif${report.jumlah_kreditur_aktif ? ` dari ${report.jumlah_kreditur_aktif} kreditur` : ""}.`);
  if (selesai.length) summaryParts.push(`Terdapat ${report.jumlah_fasilitas_selesai ?? selesai.length} fasilitas telah selesai/lunas.`);
  if (report.parsed_data?.total_plafon_aktif) {
    const util = report.parsed_data.total_baki_debet_aktif && report.parsed_data.total_plafon_aktif > 0
      ? Math.round((report.parsed_data.total_baki_debet_aktif / report.parsed_data.total_plafon_aktif) * 100) : null;
    summaryParts.push(`Total plafon aktif ${formatIDR(report.parsed_data.total_plafon_aktif)} dengan outstanding ${formatIDR(report.parsed_data.total_baki_debet_aktif)}${util !== null ? ` (utilisasi ${util}%)` : ""}.`);
  }
  if (kols.length) {
    if (worst === 1) summaryParts.push("Seluruh fasilitas aktif berstatus Lancar — tidak ada indikasi risiko kredit signifikan.");
    else if (worst === 2) summaryParts.push(`Kolektabilitas terburuk DPK (Kol ${worst}) — debitur perlu dipantau namun belum NPL.`);
    else if (worst >= 3) summaryParts.push(`Terdeteksi fasilitas dengan Kolektabilitas ${worst} — mitigasi risiko diperlukan.`);
  }
  return (
    <div className="space-y-5">
      {report.parse_error && (
        <div className="flex gap-3 items-start rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div><p className="font-semibold">Parse error</p><p className="text-xs mt-0.5 font-mono">{report.parse_error}</p></div>
        </div>
      )}
      <TrafficLightWidget kols={kols} />
      {(aktif.length > 0 || selesai.length > 0) && (
        <div className={`rounded-xl border px-5 py-4 ${bgMap[worst] ?? bgMap[1]}`}>
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-2">Ringkasan Risiko Otomatis — CBI</p>
          <p className="text-sm leading-relaxed">{summaryParts.join(" ")}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Tanggal Laporan", value: report.tanggal_laporan || "—", tone: "amber" as const },
          { label: "NPWP", value: report.npwp ?? report.npwp_query ?? "—", tone: "blue" as const },
          { label: "Halaman PDF", value: report.raw_pages?.toString() || "—", tone: "slate" as const },
        ].map(({ label, value, tone }) => (
          <BureauStatCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Identitas Debitur Badan Usaha</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
          {[
            { label: "Nama Badan Usaha", value: d?.nama ?? report.nama_debitur },
            { label: "Jenis Badan Usaha", value: d?.jenis_badan_usaha ?? report.jenis_badan_usaha },
            { label: "NPWP", value: d?.npwp ?? report.npwp },
            { label: "Alamat", value: d?.alamat },
            { label: "Kota", value: d?.kota },
            { label: "Provinsi", value: d?.provinsi },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
              <p className="text-sm text-slate-800 mt-0.5">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Plafon Aktif", value: formatIDR(report.parsed_data?.total_plafon_aktif), tone: "blue" as const },
          { label: "Baki Debet Aktif", value: formatIDR(report.parsed_data?.total_baki_debet_aktif), tone: "amber" as const },
          { label: "Fasilitas Aktif", value: (report.jumlah_fasilitas_aktif ?? aktif.length).toString(), tone: "emerald" as const },
          { label: "Fasilitas Selesai", value: (report.jumlah_fasilitas_selesai ?? selesai.length).toString(), tone: "slate" as const },
        ].map(({ label, value, tone }) => (
          <BureauStatCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      {aktif.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Fasilitas Masih Berjalan ({aktif.length})</h3>
          <div className="space-y-2">{aktif.map((f, i) => <CbiFasilitasCard key={i} f={f} idx={i} />)}</div>
        </div>
      )}
      {selesai.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Fasilitas Sudah Selesai ({selesai.length})</h3>
          <div className="space-y-2">{selesai.map((f, i) => <CbiFasilitasCard key={i} f={f} idx={i} />)}</div>
        </div>
      )}
    </div>
  );
}

// ── CLIK placeholder ─────────────────────────────────────────────────────────

function ClikPlaceholder() {
  return (
    <div className="space-y-5">
      <TrafficLightWidget kols={[1]} />
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">CLIK Parser — Coming Soon</p>
        <p className="text-xs mt-1.5 text-slate-400 max-w-xs text-center">
          Parsing dokumen CLIK (Catatan Informasi Kredit) akan tersedia segera.
        </p>
      </div>
    </div>
  );
}

// ── Shared list panel ─────────────────────────────────────────────────────────

type ParseType = "slik" | "cbi" | "clik";

interface ListItemProps {
  name: string;
  sub: string;
  companyName?: string;
  hasError?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ListItem({ name, sub, companyName, hasError, isSelected, onSelect, onDelete }: ListItemProps) {
  return (
    <button onClick={onSelect}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
        }`}
    >
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
          <p className="text-[11px] text-slate-400 truncate">{sub}</p>
          {companyName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium">
              <Building2 className="h-2.5 w-2.5" />{companyName}
            </span>
          )}
          {hasError && <span className="text-[10px] text-red-500">Parse error</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PARSE_TABS: { key: ParseType; label: string; badge?: string }[] = [
  { key: "slik", label: "SLIK" },
  { key: "cbi", label: "CBI" },
  { key: "clik", label: "CLIK", badge: "soon" },
];

export default function IDebPage() {
  const [parseType, setParseType] = useState<ParseType>("slik");

  // SLIK state
  const [slikReports, setSlikReports] = useState<SlikReport[]>([]);
  const [selectedSlik, setSelectedSlik] = useState<SlikReport | null>(null);
  const [loadedSlik, setLoadedSlik] = useState(false);

  // CBI state
  const [cbiReports, setCbiReports] = useState<CbiReport[]>([]);
  const [selectedCbi, setSelectedCbi] = useState<CbiReport | null>(null);
  const [loadedCbi, setLoadedCbi] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFilename, setUploadFilename] = useState("");
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  useEffect(() => {
    companiesApi.list().then(({ data }) => setCompanies(data)).catch(() => { });
  }, []);

  const loadSlik = useCallback(async () => {
    try { const { data } = await slikApi.list(); setSlikReports(data); setLoadedSlik(true); }
    catch { toast.error("Gagal memuat daftar laporan SLIK"); }
  }, []);

  const loadCbi = useCallback(async () => {
    try { const { data } = await cbiApi.list(); setCbiReports(data); setLoadedCbi(true); }
    catch { toast.error("Gagal memuat daftar laporan CBI"); }
  }, []);

  // Load on first switch to each tab
  useEffect(() => { if (parseType === "slik" && !loadedSlik) loadSlik(); }, [parseType, loadedSlik, loadSlik]);
  useEffect(() => { if (parseType === "cbi" && !loadedCbi) loadCbi(); }, [parseType, loadedCbi, loadCbi]);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (parseType === "clik") { toast.info("CLIK parsing belum tersedia"); return; }
    setUploading(true);
    setUploadPct(0);
    setUploadFilename(file.name);
    const onProgress = (event: { loaded: number; total?: number }) => {
      const pct = Math.min(99, Math.round((event.loaded / (event.total || file.size)) * 100));
      setUploadPct(pct);
    };
    try {
      if (parseType === "slik") {
        const { data } = await slikApi.upload(file, selectedCompanyId || undefined, onProgress);
        setUploadPct(100);
        setSlikReports((prev) => [data, ...prev]);
        setSelectedSlik(data);
        toast[data.parse_error ? "warning" : "success"](data.parse_error ? "SLIK tersimpan, parser perlu review" : "SLIK berhasil diparse");
      } else {
        const { data } = await cbiApi.upload(file, selectedCompanyId || undefined, onProgress);
        setUploadPct(100);
        setCbiReports((prev) => [data, ...prev]);
        setSelectedCbi(data);
        toast[data.parse_error ? "warning" : "success"](data.parse_error ? "CBI tersimpan, parser perlu review" : "CBI berhasil diparse");
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload gagal";
      toast.error(msg);
    } finally {
      setUploading(false);
      setTimeout(() => { setUploadPct(0); setUploadFilename(""); }, 1500);
    }
  }, [parseType, selectedCompanyId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading || parseType === "clik",
  });

  const handleDeleteSlik = async (id: string) => {
    if (!confirm("Hapus laporan SLIK ini?")) return;
    await slikApi.delete(id);
    setSlikReports((prev) => prev.filter((r) => r.id !== id));
    if (selectedSlik?.id === id) setSelectedSlik(null);
    toast.success("Laporan dihapus");
  };

  const handleDeleteCbi = async (id: string) => {
    if (!confirm("Hapus laporan CBI ini?")) return;
    await cbiApi.delete(id);
    setCbiReports((prev) => prev.filter((r) => r.id !== id));
    if (selectedCbi?.id === id) setSelectedCbi(null);
    toast.success("Laporan dihapus");
  };

  const listCount = parseType === "slik" ? slikReports.length : parseType === "cbi" ? cbiReports.length : 0;
  const listLoaded = parseType === "slik" ? loadedSlik : parseType === "cbi" ? loadedCbi : true;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Confidential"
          title="iDeb Parser"
          description="Sistem Layanan Informasi Keuangan — OJK Credit Bureau"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="text-xs text-slate-700 outline-none bg-transparent cursor-pointer min-w-[140px]"
                >
                  <option value="">— Pilih perusahaan —</option>
                  {companies.map((c) => (
                    <option key={c.company.id} value={c.company.id}>{c.company.name}</option>
                  ))}
                </select>
              </div>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-xl border border-dashed px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${isDragActive ? "border-blue-400 bg-blue-50 text-blue-700"
                    : parseType === "clik" ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "border-slate-300 bg-white hover:border-blue-300 text-slate-500 hover:text-blue-600"
                  } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                <input {...getInputProps()} />
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Mengupload…" : parseType === "clik" ? "Coming Soon" : "Upload PDF"}
              </div>
            </div>
          }
        />

        {/* Parse type tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
          {PARSE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setParseType(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${parseType === tab.key
                  ? "border-teal-500 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 align-middle">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Upload progress bar */}
        {(uploading || uploadPct > 0) && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <p className="text-xs font-medium text-slate-700 truncate max-w-[260px]">{uploadFilename}</p>
              </div>
              <span className={`text-xs font-bold tabular-nums ${uploadPct < 100 ? "text-teal-600" : "text-emerald-600"}`}>
                {uploadPct < 100 ? `${uploadPct}%` : uploadPct === 100 && uploading ? "Parsing…" : "Selesai"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${uploadPct < 100 ? "bg-teal-500" : uploading ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"}`}
                style={{ width: `${uploadPct === 100 && uploading ? 100 : uploadPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {uploadPct < 100 ? "Mengunggah file…" : uploading ? "Parsing dokumen, mohon tunggu…" : "Upload selesai"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List panel */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 mb-2">
              Laporan ({listCount})
            </p>

            {/* CLIK placeholder list */}
            {parseType === "clik" && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <p className="text-xs text-slate-400">Belum tersedia</p>
              </div>
            )}

            {/* SLIK list */}
            {parseType === "slik" && (
              <>
                {listLoaded && slikReports.length === 0 && (
                  <div {...getRootProps()} className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragActive ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400">{uploading ? "Mengupload…" : "Drop PDF SLIK di sini"}</p>
                  </div>
                )}
                {!listLoaded && <p className="text-sm text-slate-400 py-4 text-center">Memuat…</p>}
                {slikReports.map((r) => (
                  <ListItem key={r.id}
                    name={r.nama_debitur || r.original_filename}
                    sub={r.nomor_laporan || r.original_filename}
                    companyName={companies.find((c) => c.company.id === r.company_id)?.company.name}
                    hasError={!!r.parse_error}
                    isSelected={selectedSlik?.id === r.id}
                    onSelect={() => setSelectedSlik(r)}
                    onDelete={() => handleDeleteSlik(r.id)}
                  />
                ))}
              </>
            )}

            {/* CBI list */}
            {parseType === "cbi" && (
              <>
                {listLoaded && cbiReports.length === 0 && (
                  <div {...getRootProps()} className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragActive ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400">{uploading ? "Mengupload…" : "Drop PDF CBI di sini"}</p>
                  </div>
                )}
                {!listLoaded && <p className="text-sm text-slate-400 py-4 text-center">Memuat…</p>}
                {cbiReports.map((r) => (
                  <ListItem key={r.id}
                    name={r.nama_debitur || r.original_filename}
                    sub={r.npwp || r.tanggal_laporan || r.original_filename}
                    companyName={companies.find((c) => c.company.id === r.company_id)?.company.name}
                    hasError={!!r.parse_error}
                    isSelected={selectedCbi?.id === r.id}
                    onSelect={() => setSelectedCbi(r)}
                    onDelete={() => handleDeleteCbi(r.id)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {parseType === "slik" && (selectedSlik
              ? <SlikDetail report={selectedSlik} />
              : <EmptyState />
            )}
            {parseType === "cbi" && (selectedCbi
              ? <CbiDetail report={selectedCbi} />
              : <EmptyState />
            )}
            {parseType === "clik" && <ClikPlaceholder />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed border-slate-200 bg-white text-slate-400">
      <Lock className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-sm">Pilih laporan untuk melihat detail</p>
    </div>
  );
}
