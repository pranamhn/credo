"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { companiesApi } from "@/lib/api";
import { formatIDR } from "@/lib/utils";
import {
  localData, CreditMemo, Collateral,
} from "@/lib/localData";
import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Clock, AlertTriangle,
  FileText, Shield, User, TrendingUp, Globe, Building,
} from "lucide-react";
import { toast } from "sonner";

const MAX_BANK_CAPITAL = 50_000_000_000_000; // 50T example — update if admin config added
const BMPK_LIMIT = MAX_BANK_CAPITAL * 0.20;

function emptyMemo(companyId: string): CreditMemo {
  return {
    companyId, loanPurpose: "", loanAmount: 0, tenor: 12, facilityType: "KMK",
    proposedRate: 10, repaymentSource: "", conditions: "",
    characterScore: 3, characterNotes: "",
    capacityScore: 3,  capacityNotes: "",
    capitalScore: 3,   capitalNotes: "",
    collateralScore: 3, collateralNotes: "",
    conditionScore: 3,  conditionNotes: "",
    collaterals: [],
    status: "draft",
    analystName: "", analystDate: "", checkerName: "", checkerNotes: "", checkerDate: "",
    committeeDecision: "", committeeDate: "",
    updatedAt: new Date().toISOString(),
  };
}

function emptyCollateral(): Collateral {
  return {
    id: crypto.randomUUID(), type: "Properti", description: "", marketValue: 0,
    liquidationValue: 0, ltvLimit: 80, legalStatus: "clear", appraisalDate: "",
  };
}

const FACILITY_TYPES = ["KMK", "KI", "KPR", "KUK", "Kredit Sindikasi", "Lainnya"];
const COLLATERAL_TYPES = ["Properti", "Kendaraan", "Piutang", "Persediaan", "Garansi Bank", "Deposito", "Lainnya"];

const STATUS_META: Record<CreditMemo["status"], { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: "Draft",      color: "bg-slate-100 text-slate-600",   icon: <FileText className="h-3 w-3" /> },
  diajukan:  { label: "Diajukan",   color: "bg-blue-100 text-blue-700",     icon: <Clock className="h-3 w-3" /> },
  review:    { label: "Review",     color: "bg-amber-100 text-amber-700",   icon: <Clock className="h-3 w-3" /> },
  komite:    { label: "Komite",     color: "bg-purple-100 text-purple-700", icon: <Clock className="h-3 w-3" /> },
  disetujui: { label: "Disetujui",  color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  ditolak:   { label: "Ditolak",    color: "bg-red-100 text-red-700",       icon: <AlertTriangle className="h-3 w-3" /> },
};

const SCORE_LABELS = ["", "Sangat Lemah", "Lemah", "Cukup", "Baik", "Sangat Baik"];
const SCORE_COLORS = ["", "text-red-600", "text-red-500", "text-amber-600", "text-emerald-600", "text-emerald-700"];

function ScoreInput({ label, icon: Icon, value, notes, onScore, onNotes, description }: {
  label: string; icon: React.FC<{ className?: string }>;
  value: number; notes: string;
  onScore: (v: number) => void; onNotes: (v: string) => void;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-teal-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onScore(s)}
            className={`h-9 w-9 rounded-lg font-bold text-sm transition-all border-2 ${value === s ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
            {s}
          </button>
        ))}
        <span className={`text-xs font-semibold ml-1 ${SCORE_COLORS[value]}`}>{SCORE_LABELS[value]}</span>
      </div>
      <textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={2}
        placeholder="Catatan analisis..."
        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 resize-none placeholder:text-slate-300" />
    </div>
  );
}

type Tab = "proposal" | "5c" | "agunan" | "workflow";

export default function MemoPage() {
  const { id } = useParams<{ id: string }>();
  const [companyName, setCompanyName] = useState("");
  const [memo, setMemo] = useState<CreditMemo>(() => emptyMemo(id));
  const [tab, setTab] = useState<Tab>("proposal");

  useEffect(() => {
    companiesApi.get(id).then(({ data: s }) => setCompanyName(s.company.name)).catch(() => {});
    const saved = localData.getMemo(id);
    if (saved) setMemo(saved);
  }, [id]);

  const set = <K extends keyof CreditMemo>(k: K, v: CreditMemo[K]) =>
    setMemo((prev) => ({ ...prev, [k]: v }));

  const save = (nextStatus?: CreditMemo["status"]) => {
    const updated: CreditMemo = { ...memo, updatedAt: new Date().toISOString(), ...(nextStatus ? { status: nextStatus } : {}) };
    setMemo(updated);
    localData.saveMemo(id, updated);
    toast.success("Memo kredit disimpan");
  };

  const addCollateral = () => set("collaterals", [...memo.collaterals, emptyCollateral()]);
  const updateCollateral = (idx: number, patch: Partial<Collateral>) =>
    set("collaterals", memo.collaterals.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeCollateral = (idx: number) =>
    set("collaterals", memo.collaterals.filter((_, i) => i !== idx));

  const totalMarketValue = memo.collaterals.reduce((s, c) => s + c.marketValue, 0);
  const totalLiqValue   = memo.collaterals.reduce((s, c) => s + c.liquidationValue, 0);
  const collateralCover = memo.loanAmount > 0 ? totalLiqValue / memo.loanAmount : 0;

  const avg5CScore = ((memo.characterScore + memo.capacityScore + memo.capitalScore + memo.collateralScore + memo.conditionScore) / 5);
  const overallGrade = avg5CScore >= 4.5 ? "AAA" : avg5CScore >= 4 ? "AA" : avg5CScore >= 3.5 ? "A" : avg5CScore >= 3 ? "BBB" : avg5CScore >= 2.5 ? "BB" : avg5CScore >= 2 ? "B" : "CCC";
  const gradeColor = ["AAA","AA","A"].includes(overallGrade) ? "text-emerald-700" : overallGrade === "BBB" ? "text-teal-700" : ["BB","B"].includes(overallGrade) ? "text-amber-700" : "text-red-700";

  const exceedsBMPK = memo.loanAmount > BMPK_LIMIT;
  const statusMeta = STATUS_META[memo.status];

  const TABS: { key: Tab; label: string }[] = [
    { key: "proposal", label: "Proposal" },
    { key: "5c",       label: "5C Assessment" },
    { key: "agunan",   label: "Agunan" },
    { key: "workflow", label: "Workflow" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/companies/${id}`} className="text-slate-400 hover:text-teal-600 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Memo Kredit</p>
              <h1 className="text-xl font-bold text-slate-900">{companyName || "…"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusMeta.color}`}>
              {statusMeta.icon} {statusMeta.label}
            </span>
            <button onClick={() => save()} className="flex items-center gap-2 bg-teal-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-teal-600 transition-all">
              <Save className="h-3.5 w-3.5" /> Simpan
            </button>
          </div>
        </div>

        {/* Quick KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Plafon Kredit",   v: formatIDR(memo.loanAmount),        color: exceedsBMPK ? "text-red-600" : "text-slate-700" },
            { label: "Tenor",           v: `${memo.tenor} bulan`,             color: "text-slate-700" },
            { label: "Nilai Agunan",    v: formatIDR(totalLiqValue),          color: collateralCover >= 1.2 ? "text-emerald-700" : "text-amber-700" },
            { label: "Rating 5C",       v: overallGrade,                       color: gradeColor },
          ].map(({ label, v, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{v}</p>
            </div>
          ))}
        </div>

        {exceedsBMPK && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">Plafon melebihi BMPK 20% modal bank ({formatIDR(BMPK_LIMIT)}). Perlu persetujuan OJK.</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-slate-100 px-4 py-3 flex items-center gap-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "text-slate-500 hover:bg-slate-50"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── PROPOSAL ── */}
          {tab === "proposal" && (
            <div className="p-6 grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Detail Fasilitas</p>
                {[
                  { label: "Tujuan Kredit", node: <textarea value={memo.loanPurpose} onChange={(e) => set("loanPurpose", e.target.value)} rows={2} placeholder="Deskripsikan tujuan penggunaan kredit…" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 resize-none placeholder:text-slate-300" /> },
                  { label: "Jenis Fasilitas", node: (
                    <select value={memo.facilityType} onChange={(e) => set("facilityType", e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400">
                      {FACILITY_TYPES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  )},
                  { label: "Plafon (Rp)", node: <input type="number" value={memo.loanAmount || ""} onChange={(e) => set("loanAmount", Number(e.target.value))} placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 tabular-nums" /> },
                  { label: "Tenor (bulan)", node: <input type="number" value={memo.tenor} onChange={(e) => set("tenor", Number(e.target.value))} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /> },
                  { label: "Suku Bunga (% p.a.)", node: <input type="number" value={memo.proposedRate} onChange={(e) => set("proposedRate", Number(e.target.value))} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" step="0.1" /> },
                ].map(({ label, node }) => (
                  <div key={label}>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">{label}</label>
                    {node}
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sumber Pelunasan & Syarat</p>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Sumber Pelunasan</label>
                  <textarea value={memo.repaymentSource} onChange={(e) => set("repaymentSource", e.target.value)} rows={3}
                    placeholder="Pendapatan operasional, refinancing, dll."
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 resize-none placeholder:text-slate-300" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Syarat & Kondisi Khusus</label>
                  <textarea value={memo.conditions} onChange={(e) => set("conditions", e.target.value)} rows={5}
                    placeholder="Syarat pencairan, covenant, dll."
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 resize-none placeholder:text-slate-300" />
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-[10px] font-semibold text-slate-400 mb-2">Simulasi Cicilan (anuitas)</p>
                  {memo.loanAmount > 0 && memo.tenor > 0 && memo.proposedRate > 0 ? (() => {
                    const r = memo.proposedRate / 100 / 12;
                    const n = memo.tenor;
                    const cicilan = memo.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Cicilan/bulan</span><span className="font-bold text-teal-700">{formatIDR(cicilan)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Total bunga</span><span className="text-slate-700">{formatIDR(cicilan * n - memo.loanAmount)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Total pembayaran</span><span className="text-slate-700">{formatIDR(cicilan * n)}</span></div>
                      </div>
                    );
                  })() : <p className="text-xs text-slate-400">Isi plafon, tenor, dan suku bunga</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── 5C ── */}
          {tab === "5c" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">5C Credit Assessment</p>
                  <p className="text-xs text-slate-400 mt-0.5">Skor 1–5 per dimensi. Rating keseluruhan otomatis dihitung.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Overall Rating</p>
                  <p className={`text-3xl font-black ${gradeColor}`}>{overallGrade}</p>
                  <p className="text-[10px] text-slate-400">{avg5CScore.toFixed(1)} / 5.0</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ScoreInput label="Character — Karakter Debitur" icon={User}
                  value={memo.characterScore} notes={memo.characterNotes}
                  onScore={(v) => set("characterScore", v)} onNotes={(v) => set("characterNotes", v)}
                  description="Riwayat kredit, reputasi, integritas manajemen, track record" />
                <ScoreInput label="Capacity — Kemampuan Bayar" icon={TrendingUp}
                  value={memo.capacityScore} notes={memo.capacityNotes}
                  onScore={(v) => set("capacityScore", v)} onNotes={(v) => set("capacityNotes", v)}
                  description="DSCR, cashflow, proyeksi pendapatan, kemampuan operasional" />
                <ScoreInput label="Capital — Modal & Keuangan" icon={Building}
                  value={memo.capitalScore} notes={memo.capitalNotes}
                  onScore={(v) => set("capitalScore", v)} onNotes={(v) => set("capitalNotes", v)}
                  description="Ekuitas, DER, DAR, struktur permodalan, investasi pemilik" />
                <ScoreInput label="Collateral — Agunan" icon={Shield}
                  value={memo.collateralScore} notes={memo.collateralNotes}
                  onScore={(v) => set("collateralScore", v)} onNotes={(v) => set("collateralNotes", v)}
                  description="Nilai likuidasi, LTV, legalitas, jenis agunan" />
                <ScoreInput label="Condition — Kondisi Makro & Industri" icon={Globe}
                  value={memo.conditionScore} notes={memo.conditionNotes}
                  onScore={(v) => set("conditionScore", v)} onNotes={(v) => set("conditionNotes", v)}
                  description="Siklus industri, risiko regulasi, kondisi ekonomi, persaingan" />
              </div>

              {/* Score bar visualization */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Radar 5C</p>
                <div className="space-y-2">
                  {[
                    { label: "Character",  val: memo.characterScore },
                    { label: "Capacity",   val: memo.capacityScore },
                    { label: "Capital",    val: memo.capitalScore },
                    { label: "Collateral", val: memo.collateralScore },
                    { label: "Condition",  val: memo.conditionScore },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div className="h-2 rounded-full bg-teal-400 transition-all" style={{ width: `${(val / 5) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-4 ${SCORE_COLORS[val]}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── AGUNAN ── */}
          {tab === "agunan" && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Daftar Agunan / Jaminan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Coverage rasio agunan terhadap plafon</p>
                </div>
                <button onClick={addCollateral}
                  className="flex items-center gap-2 bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-teal-600 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Tambah Agunan
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Nilai Pasar", v: formatIDR(totalMarketValue) },
                  { label: "Total Nilai Likuidasi", v: formatIDR(totalLiqValue) },
                  { label: "Coverage Ratio", v: `${(collateralCover * 100).toFixed(0)}%`, color: collateralCover >= 1.2 ? "text-emerald-700" : collateralCover >= 1 ? "text-amber-700" : "text-red-600" },
                ].map(({ label, v, color }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                    <p className={`text-sm font-bold ${color ?? "text-slate-700"}`}>{v}</p>
                  </div>
                ))}
              </div>

              {memo.collaterals.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Belum ada agunan. Klik "Tambah Agunan" untuk mulai.</div>
              ) : (
                <div className="space-y-4">
                  {memo.collaterals.map((c, idx) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-700">Agunan #{idx + 1}</p>
                        <button onClick={() => removeCollateral(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {[
                          { label: "Jenis", node: (
                            <select value={c.type} onChange={(e) => updateCollateral(idx, { type: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400">
                              {COLLATERAL_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          )},
                          { label: "Deskripsi", node: <input value={c.description} onChange={(e) => updateCollateral(idx, { description: e.target.value })} placeholder="Alamat/Detail aset..." className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /> },
                          { label: "Nilai Pasar (Rp)", node: <input type="number" value={c.marketValue || ""} onChange={(e) => updateCollateral(idx, { marketValue: Number(e.target.value) })} placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 tabular-nums" /> },
                          { label: "Nilai Likuidasi (Rp)", node: <input type="number" value={c.liquidationValue || ""} onChange={(e) => updateCollateral(idx, { liquidationValue: Number(e.target.value) })} placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 tabular-nums" /> },
                          { label: "LTV Limit (%)", node: <input type="number" value={c.ltvLimit} onChange={(e) => updateCollateral(idx, { ltvLimit: Number(e.target.value) })} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /> },
                          { label: "Status Legal", node: (
                            <select value={c.legalStatus} onChange={(e) => updateCollateral(idx, { legalStatus: e.target.value as Collateral["legalStatus"] })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400">
                              <option value="clear">Clear / Bersih</option>
                              <option value="in_progress">Dalam Proses</option>
                              <option value="dispute">Sengketa</option>
                            </select>
                          )},
                          { label: "Tanggal Appraisal", node: <input type="date" value={c.appraisalDate} onChange={(e) => updateCollateral(idx, { appraisalDate: e.target.value })} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /> },
                        ].map(({ label, node }) => (
                          <div key={label}>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-1">{label}</label>
                            {node}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── WORKFLOW ── */}
          {tab === "workflow" && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-bold text-slate-800">Approval Workflow</p>
                <p className="text-xs text-slate-400 mt-0.5">4-eyes principle: Analis → Checker → Komite Kredit</p>
              </div>

              {/* Progress stepper */}
              <div className="flex items-center gap-0">
                {(["draft","diajukan","review","komite","disetujui"] as CreditMemo["status"][]).map((s, i, arr) => {
                  const active = memo.status === s;
                  const done = ["disetujui","komite","review","diajukan"].indexOf(memo.status) >= ["disetujui","komite","review","diajukan"].indexOf(s) || memo.status === "disetujui";
                  return (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${active ? "bg-teal-500 text-white" : done ? "bg-emerald-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                        {i + 1}
                      </div>
                      <p className={`text-[10px] font-semibold ml-1.5 ${active ? "text-teal-700" : "text-slate-400"}`}>{STATUS_META[s].label}</p>
                      {i < arr.length - 1 && <div className={`flex-1 h-px mx-2 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />}
                    </div>
                  );
                })}
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {/* Analis */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analis</p>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Nama Analis</label>
                    <input value={memo.analystName} onChange={(e) => set("analystName", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /></div>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Tanggal</label>
                    <input type="date" value={memo.analystDate} onChange={(e) => set("analystDate", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /></div>
                  {memo.status === "draft" && (
                    <button onClick={() => save("diajukan")} className="w-full text-xs font-semibold bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition-all">
                      Ajukan ke Checker →
                    </button>
                  )}
                </div>

                {/* Checker */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Checker / Review</p>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Nama Checker</label>
                    <input value={memo.checkerName} onChange={(e) => set("checkerName", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /></div>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Catatan Review</label>
                    <textarea value={memo.checkerNotes} onChange={(e) => set("checkerNotes", e.target.value)} rows={2} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 resize-none" /></div>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Tanggal</label>
                    <input type="date" value={memo.checkerDate} onChange={(e) => set("checkerDate", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /></div>
                  {memo.status === "diajukan" && (
                    <button onClick={() => save("komite")} className="w-full text-xs font-semibold bg-purple-50 text-purple-700 py-2 rounded-lg hover:bg-purple-100 transition-all">
                      Naikkan ke Komite →
                    </button>
                  )}
                </div>

                {/* Komite */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Komite Kredit</p>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Keputusan Komite</label>
                    <textarea value={memo.committeeDecision} onChange={(e) => set("committeeDecision", e.target.value)} rows={3}
                      placeholder="Setuju / Tolak dengan catatan..." className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400 resize-none placeholder:text-slate-300" /></div>
                  <div><label className="text-[10px] text-slate-500 block mb-1">Tanggal Keputusan</label>
                    <input type="date" value={memo.committeeDate} onChange={(e) => set("committeeDate", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-teal-400" /></div>
                  {memo.status === "komite" && (
                    <div className="flex gap-2">
                      <button onClick={() => save("disetujui")} className="flex-1 text-xs font-semibold bg-emerald-50 text-emerald-700 py-2 rounded-lg hover:bg-emerald-100 transition-all">Setuju</button>
                      <button onClick={() => save("ditolak")} className="flex-1 text-xs font-semibold bg-red-50 text-red-700 py-2 rounded-lg hover:bg-red-100 transition-all">Tolak</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-400">
                Terakhir diperbarui: {new Date(memo.updatedAt).toLocaleString("id-ID")}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
