"use client";
import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Trash2, ChevronDown, ChevronUp, AlertCircle, Building2, Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit";
import { slikApi, cbiApi, companiesApi, SlikReport, CbiReport, CompanySummary } from "@/lib/api";
import { toast } from "sonner";

function formatIDR(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const KUALITAS_LABEL: Record<string, string> = { "1": "Lancar", "2": "DPK", "3": "Kurang Lancar", "4": "Diragukan", "5": "Macet" };
const KUALITAS_COLOR: Record<string, string> = { "1": "bg-emerald-100 text-emerald-800", "2": "bg-yellow-100 text-yellow-800", "3": "bg-orange-100 text-orange-800", "4": "bg-red-100 text-red-700", "5": "bg-red-200 text-red-900" };
const KOL_COLORS: Record<number, string> = { 1: "bg-emerald-500", 2: "bg-yellow-400", 3: "bg-orange-500", 4: "bg-red-500", 5: "bg-red-800" };

type ParseType = "slik" | "clik" | "cbi";

function KolBadge({ val }: { val: string }) {
  const k = val.replace(/\D.*/g, "");
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${KUALITAS_COLOR[k] ?? "bg-gray-100 text-gray-600"}`}>{k} – {KUALITAS_LABEL[k] ?? val}</span>;
}

export default function IdebtParserPage() {
  const [parseType, setParseType] = useState<ParseType>("slik");
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [slikReports, setSlikReports] = useState<SlikReport[]>([]);
  const [cbiReports, setCbiReports] = useState<CbiReport[]>([]);
  const [selectedSlik, setSelectedSlik] = useState<SlikReport | null>(null);
  const [selectedCbi, setSelectedCbi] = useState<CbiReport | null>(null);
  const [loadedSlik, setLoadedSlik] = useState(false);
  const [loadedCbi, setLoadedCbi] = useState(false);

  // Upload modal
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState("");
  const [uploadType, setUploadType] = useState<ParseType>("slik");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFilename, setUploadFilename] = useState("");

  useEffect(() => { companiesApi.list().then(({ data }) => setCompanies(data)).catch(() => { }); }, []);
  useEffect(() => { slikApi.list().then(({ data }) => { setSlikReports(data); setLoadedSlik(true); }).catch(() => setLoadedSlik(true)); }, []);
  useEffect(() => { cbiApi.list().then(({ data }) => { setCbiReports(data); setLoadedCbi(true); }).catch(() => setLoadedCbi(true)); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true); setUploadPct(0); setUploadFilename(file.name);
    try {
      if (uploadType === "slik") {
        const { data } = await slikApi.upload(file, uploadCompanyId || undefined, (e) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 90)); });
        setUploadPct(100);
        setSlikReports((prev) => [data, ...prev]);
        setSelectedSlik(data);
        setParseType("slik");
        toast.success("SLIK berhasil diunggah & diparse");
      } else {
        const { data } = await cbiApi.upload(file, uploadCompanyId || undefined, (e) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 90)); });
        setUploadPct(100);
        setCbiReports((prev) => [data, ...prev]);
        setSelectedCbi(data);
        setParseType("cbi");
        toast.success("CBI berhasil diunggah & diparse");
      }
      setModalOpen(false);
      setUploadCompanyId("");
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Upload gagal");
    } finally { setUploading(false); }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files[0]) handleUpload(files[0]); },
    accept: { "application/pdf": [".pdf"] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: uploadType === "clik" || uploading,
  });

  const handleDeleteSlik = async (id: string) => { if (!confirm("Hapus laporan SLIK?")) return; await slikApi.delete(id); setSlikReports((p) => p.filter((r) => r.id !== id)); if (selectedSlik?.id === id) setSelectedSlik(null); toast.success("Dihapus"); };
  const handleDeleteCbi = async (id: string) => { if (!confirm("Hapus laporan CBI?")) return; await cbiApi.delete(id); setCbiReports((p) => p.filter((r) => r.id !== id)); if (selectedCbi?.id === id) setSelectedCbi(null); toast.success("Dihapus"); };

  const reports = parseType === "slik" ? slikReports : cbiReports;
  const loaded = parseType === "slik" ? loadedSlik : loadedCbi;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Confidential"
          title="iDeb Parser"
          description="SLIK, CBI, CLIK — OJK Credit Bureau Report Parser"
          actions={
            <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors shadow-sm">
              <Plus className="h-4 w-4" /> Upload Laporan
            </button>
          }
        />

        {/* Upload Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm" onClick={() => { if (!uploading) { setModalOpen(false); setUploadCompanyId(""); } }}>
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-bold text-slate-900">Upload Laporan iDeb</h2>
                <button onClick={() => { if (!uploading) { setModalOpen(false); setUploadCompanyId(""); } }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Company selector */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5">Perusahaan</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <select value={uploadCompanyId} onChange={(e) => setUploadCompanyId(e.target.value)} className="flex-1 text-sm text-slate-700 outline-none bg-transparent cursor-pointer" disabled={uploading}>
                      <option value="">— Pilih perusahaan (opsional) —</option>
                      {companies.map((c) => (<option key={c.company.id} value={c.company.id}>{c.company.name}</option>))}
                    </select>
                  </div>
                </div>

                {/* Type selector */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5">Jenis Laporan</label>
                  <div className="flex gap-2">
                    {([["slik", "SLIK"], ["cbi", "CBI"], ["clik", "CLIK"]] as [ParseType, string][]).map(([key, label]) => (
                      <button key={key} onClick={() => setUploadType(key)} disabled={key === "clik" || uploading}
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${uploadType === key ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm" : key === "clik" ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                        {label}{key === "clik" ? " (Soon)" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload area */}
                <div {...getRootProps()} className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${isDragActive ? "border-indigo-400 bg-indigo-50" : uploading ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/20"}`}>
                  <input {...getInputProps()} />
                  {uploading ? (
                    <div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-2"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${uploadPct}%` }} /></div>
                      <p className="text-xs text-slate-500">{uploadFilename}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{uploadPct < 100 ? `Mengupload ${uploadPct}%…` : "Memproses…"}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-600">{isDragActive ? "Lepas file di sini" : "Drag & drop atau klik untuk pilih"}</p>
                      <p className="text-xs text-slate-400 mt-1">PDF, maks 50 MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {([["slik", "SLIK"], ["cbi", "CBI"]] as [ParseType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setParseType(key)} className={`relative px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${parseType === key ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {label} <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">{(key === "slik" ? slikReports.length : cbiReports.length)}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Report list */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 mb-2">Laporan ({reports.length})</p>
            {!loaded ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat...</div>
            ) : reports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Belum ada laporan</div>
            ) : (
              reports.map((r: any) => {
                const isSelected = parseType === "slik" ? selectedSlik?.id === r.id : selectedCbi?.id === r.id;
                const name = r.parsed_data?.debitur?.nama ?? r.nama_debitur ?? "—";
                const nomor = r.nomor_laporan || r.id?.slice(0, 8) || "—";
                return (
                  <button key={r.id} onClick={() => parseType === "slik" ? setSelectedSlik(r) : setSelectedCbi(r)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${isSelected ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{nomor}</p>
                      </div>
                      <span onClick={(e) => { e.stopPropagation(); parseType === "slik" ? handleDeleteSlik(r.id) : handleDeleteCbi(r.id); }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Analysis */}
          <div className="lg:col-span-2">
            {parseType === "slik" && selectedSlik ? (
              <SlikAnalysis report={selectedSlik} />
            ) : parseType === "cbi" && selectedCbi ? (
              <CbiAnalysis report={selectedCbi} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Pilih laporan untuk melihat analisis</p>
                <p className="text-xs text-slate-400 mt-1">Upload laporan SLIK atau CBI untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── SLIK Analysis ──
function SlikFasilitasRow({ f, i }: { f: any; i: number }) {
  const [open, setOpen] = useState(false);
  const fKols = f.kualitas_history?.length ? f.kualitas_history.map(Number).filter((n: number) => n >= 1 && n <= 5) : (f.kualitas ? [parseInt(f.kualitas[0])].filter((n: number) => !isNaN(n) && n >= 1 && n <= 5) : [1]);
  const fWorst = fKols.length ? Math.max(...fKols) : 1;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-xs font-bold shrink-0">{i + 1}</span>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{f.kreditur || "—"}</p><p className="text-xs text-slate-500">{f.jenis_kredit || "—"}</p></div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block"><p className="text-[11px] text-slate-400">Plafon</p><p className="text-xs font-medium text-slate-700">{formatIDR(f.plafon)}</p></div>
          <div className="text-right hidden sm:block"><p className="text-[11px] text-slate-400">Baki Debet</p><p className="text-xs font-medium text-slate-700">{formatIDR(f.baki_debet)}</p></div>
          <KolBadge val={String(fWorst)} />
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[["Plafon", formatIDR(f.plafon)], ["Baki Debet", formatIDR(f.baki_debet)], ["Tgl Mulai", f.tanggal_mulai || "—"], ["Jatuh Tempo", f.tanggal_jatuh_tempo || "—"], ["Bunga", f.bunga || "—"], ["Agunan", f.agunan || "—"], ["Nilai Agunan", formatIDR(f.nilai_agunan)], ["Penjamin", f.penjamin || "—"]].map(([l, v]) => (
            <div key={String(l)} className="bg-slate-50 rounded-lg px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{String(l)}</p><p className="text-xs text-slate-700 mt-0.5 font-medium truncate">{String(v)}</p></div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlikAnalysis({ report }: { report: SlikReport }) {
  const fasilitas = report.parsed_data?.fasilitas ?? [];
  const d = report.parsed_data?.debitur;
  const kols: number[] = [];
  for (const f of fasilitas) {
    if (f.kualitas_history.length) kols.push(...f.kualitas_history.map(Number).filter((n) => n >= 1 && n <= 5));
    else if (f.kualitas) { const v = parseInt(f.kualitas[0]); if (!isNaN(v) && v >= 1 && v <= 5) kols.push(v); }
  }
  const worst = kols.length ? Math.max(...kols) : 1;
  const cfg = { 1: { color: "bg-emerald-500", ring: "ring-emerald-200", label: "Lancar", text: "text-emerald-700" }, 2: { color: "bg-yellow-400", ring: "ring-yellow-200", label: "DPK", text: "text-yellow-700" }, 3: { color: "bg-orange-500", ring: "ring-orange-200", label: "Kurang Lancar", text: "text-orange-700" }, 4: { color: "bg-red-500", ring: "ring-red-200", label: "Diragukan", text: "text-red-700" }, 5: { color: "bg-red-800", ring: "ring-red-300", label: "Macet", text: "text-red-900" } }[worst]!;

  return (
    <div className="space-y-5">
      {report.parse_error && (<div className="flex gap-3 items-start rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><div><p className="font-semibold">Parse error</p><p className="text-xs mt-0.5 font-mono">{report.parse_error}</p></div></div>)}

      {/* Traffic light */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Indikator Kualitas Kredit</h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${cfg.ring} ${cfg.text}`}><span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${cfg.color}`} />Terburuk: Kol {worst} – {cfg.label}</span>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            {[1, 2, 3, 4, 5].map((lvl) => (<div key={lvl} className="flex flex-col items-center gap-1"><div className={`h-8 w-8 rounded-full ${KOL_COLORS[lvl]} ${lvl === worst ? "opacity-100 ring-2 ring-offset-2 ring-slate-300 scale-110" : "opacity-20"}`} /><span className={`text-[9px] font-semibold ${lvl === worst ? "text-slate-700" : "text-slate-300"}`}>Kol {lvl}</span></div>))}
            <div className="ml-4 flex-1"><p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p><p className="text-xs text-slate-500 mt-0.5">{worst <= 1 ? "Semua fasilitas dalam kondisi Lancar." : worst === 2 ? "Ada fasilitas yang perlu dipantau." : "Fasilitas bermasalah terdeteksi."}</p></div>
          </div>
        </div>
      </div>

      {/* Risk summary */}
      <div className={`rounded-xl border px-5 py-4 ${worst <= 1 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : worst === 2 ? "bg-yellow-50 border-yellow-200 text-yellow-900" : "bg-red-50 border-red-200 text-red-900"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-2">Ringkasan Risiko Otomatis — SLIK</p>
        <p className="text-sm leading-relaxed">
          Berdasarkan laporan SLIK atas nama <strong>{d?.nama ?? report.nama_debitur ?? "debitur"}</strong>, tercatat <strong>{fasilitas.length} fasilitas</strong> kredit{report.jumlah_kreditur ? ` dari ${report.jumlah_kreditur} kreditur` : ""}.
          {report.parsed_data?.total_plafon ? <> Total plafon <strong>{formatIDR(report.parsed_data.total_plafon)}</strong> dengan outstanding <strong>{formatIDR(report.parsed_data.total_baki_debet)}</strong>.</> : null}
          {" "}Kolektibilitas terburuk: <strong>Kol {worst} — {cfg.label}</strong>.
          {worst >= 3 ? " Diperlukan mitigasi risiko." : worst === 2 ? " Perlu pemantauan." : " Tidak ada indikasi risiko kredit signifikan."}
          {fasilitas.length > 10 ? " Jumlah fasilitas tinggi dapat mengindikasikan ketergantungan pada pembiayaan eksternal." : ""}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Nomor Laporan", report.nomor_laporan || "—", "blue"], ["Tanggal Laporan", report.tanggal_laporan || "—", "amber"], ["Pemohon", report.pemohon || "—", "blue"], ["Halaman PDF", String(report.raw_pages ?? "—"), "slate"]].map(([l, v, t]) => (
          <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{String(l)}</p>
            <p className="text-sm font-bold text-slate-800 mt-2 truncate">{String(v)}</p>
          </div>
        ))}
      </div>

      {/* Debitur Data */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Data Pokok Debitur</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
          {[["Nama", d?.nama ?? report.nama_debitur], ["No. Identitas", d?.no_identitas ?? report.no_identitas], ["NPWP", d?.npwp ?? report.npwp], ["Tempat Lahir", d?.tempat_lahir], ["Tanggal Lahir", d?.tanggal_lahir ?? report.tanggal_lahir], ["Alamat", d?.alamat]].filter(([, v]) => v).map(([l, v]) => (
            <div key={String(l)}><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{String(l)}</p><p className="text-sm text-slate-800 mt-0.5">{String(v)}</p></div>
          ))}
        </div>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Total Plafon", formatIDR(report.parsed_data?.total_plafon), "blue"], ["Total Baki Debet", formatIDR(report.parsed_data?.total_baki_debet), "amber"], ["Jumlah Kreditur", String(report.jumlah_kreditur ?? fasilitas.length), "slate"], ["Jumlah Fasilitas", String(report.jumlah_fasilitas ?? fasilitas.length), "emerald"]].map(([l, v, t]) => (
          <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{String(l)}</p><p className="text-sm font-bold text-slate-800 mt-2">{String(v)}</p></div>
        ))}
      </div>

      {/* Fasilitas list */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Detail Fasilitas ({fasilitas.length})</h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {fasilitas.map((f, i) => (<SlikFasilitasRow key={i} f={f} i={i} />))}
        </div>
      </div>
    </div>
  );
}

// ── CBI Analysis ──
function CbiAnalysis({ report }: { report: CbiReport }) {
  const aktif = report.parsed_data?.fasilitas_aktif ?? [];
  const selesai = report.parsed_data?.fasilitas_selesai ?? [];
  const d = report.parsed_data?.debitur;
  const kols: number[] = [];
  for (const f of aktif) {
    const hist = f.kolektabilitas_history.map(Number).filter((n) => n >= 1 && n <= 5);
    if (hist.length) kols.push(...hist);
    else if (f.kolektabilitas) { const n = parseInt(f.kolektabilitas); if (!isNaN(n) && n >= 1 && n <= 5) kols.push(n); }
  }
  const worst = kols.length ? Math.max(...kols) : 1;
  const cfg = { 1: { color: "bg-emerald-500", ring: "ring-emerald-200", label: "Lancar", text: "text-emerald-700" }, 2: { color: "bg-yellow-400", ring: "ring-yellow-200", label: "DPK", text: "text-yellow-700" }, 3: { color: "bg-orange-500", ring: "ring-orange-200", label: "Kurang Lancar", text: "text-orange-700" }, 4: { color: "bg-red-500", ring: "ring-red-200", label: "Diragukan", text: "text-red-700" }, 5: { color: "bg-red-800", ring: "ring-red-300", label: "Macet", text: "text-red-900" } }[worst]!;

  return (
    <div className="space-y-5">
      {report.parse_error && (<div className="flex gap-3 items-start rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><div><p className="font-semibold">Parse error</p><p className="text-xs mt-0.5 font-mono">{report.parse_error}</p></div></div>)}

      {/* Traffic light */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Indikator Kualitas Kredit</h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${cfg.ring} ${cfg.text}`}><span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${cfg.color}`} />Terburuk: Kol {worst} – {cfg.label}</span>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            {[1, 2, 3, 4, 5].map((lvl) => (<div key={lvl} className="flex flex-col items-center gap-1"><div className={`h-8 w-8 rounded-full ${KOL_COLORS[lvl]} ${lvl === worst ? "opacity-100 ring-2 ring-offset-2 ring-slate-300 scale-110" : "opacity-20"}`} /><span className={`text-[9px] font-semibold ${lvl === worst ? "text-slate-700" : "text-slate-300"}`}>Kol {lvl}</span></div>))}
            <div className="ml-4 flex-1"><p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p><p className="text-xs text-slate-500 mt-0.5">{worst <= 1 ? "Semua fasilitas dalam kondisi Lancar." : "Fasilitas bermasalah terdeteksi."}</p></div>
          </div>
        </div>
      </div>

      {/* Risk summary */}
      <div className={`rounded-xl border px-5 py-4 ${worst <= 1 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-2">Ringkasan Risiko Otomatis — CBI</p>
        <p className="text-sm leading-relaxed">
          Berdasarkan laporan CBI atas nama <strong>{d?.nama ?? report.nama_debitur ?? "debitur"}</strong>, tercatat <strong>{aktif.length} fasilitas aktif</strong>{report.jumlah_kreditur_aktif ? ` dari ${report.jumlah_kreditur_aktif} kreditur` : ""}.
          {report.parsed_data?.total_plafon_aktif ? <> Total plafon aktif <strong>{formatIDR(report.parsed_data.total_plafon_aktif)}</strong> dengan outstanding <strong>{formatIDR(report.parsed_data.total_baki_debet_aktif)}</strong>.</> : null}
          {selesai.length > 0 ? <> Terdapat <strong>{selesai.length} fasilitas</strong> telah selesai/lunas.</> : null}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Total Plafon Aktif", formatIDR(report.parsed_data?.total_plafon_aktif), "blue"], ["Total Baki Debet", formatIDR(report.parsed_data?.total_baki_debet_aktif), "amber"], ["Fasilitas Aktif", String(aktif.length), "emerald"], ["Fasilitas Selesai", String(selesai.length), "slate"]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{String(l)}</p><p className="text-sm font-bold text-slate-800 mt-2">{String(v)}</p></div>
        ))}
      </div>

      {/* Debitur info */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Identitas Debitur</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
          {[["Nama", d?.nama ?? report.nama_debitur], ["NPWP", d?.npwp ?? report.npwp], ["Jenis Badan Usaha", d?.jenis_badan_usaha ?? report.jenis_badan_usaha]].filter(([, v]) => v).map(([l, v]) => (
            <div key={String(l)}><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{String(l)}</p><p className="text-sm text-slate-800 mt-0.5">{String(v)}</p></div>
          ))}
        </div>
      </div>

      {/* Fasilitas Aktif */}
      {aktif.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Fasilitas Aktif ({aktif.length})</h3>
          <div className="space-y-2">
            {aktif.slice(0, 10).map((f, i) => {
              const fKols = f.kolektabilitas_history?.length ? f.kolektabilitas_history.map(Number).filter((n: number) => n >= 1 && n <= 5) : (f.kolektabilitas ? [parseInt(f.kolektabilitas)].filter((n: number) => !isNaN(n)) : [1]);
              const fW = fKols.length ? Math.max(...fKols) : 1;
              return (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-700 truncate">{f.kreditur || "—"}</p>
                    <p className="text-[10px] text-slate-400">{f.jenis_fasilitas || "—"} · Plafon {formatIDR(f.plafon)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 shrink-0 ml-2 ${fW <= 1 ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : fW === 2 ? "bg-yellow-100 text-yellow-700 ring-yellow-200" : "bg-red-100 text-red-700 ring-red-200"}`}>Kol {fW}</span>
                </div>
              );
            })}
            {aktif.length > 10 && <p className="text-[10px] text-slate-400 text-center">+{aktif.length - 10} fasilitas lainnya</p>}
          </div>
        </div>
      )}

      {/* Fasilitas Selesai */}
      {selesai.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Fasilitas Selesai ({selesai.length})</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {selesai.slice(0, 6).map((f, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-700 truncate">{f.kreditur || "—"}</p>
                <p className="text-[10px] text-slate-400">{f.jenis_fasilitas || "—"} · {formatIDR(f.plafon)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}