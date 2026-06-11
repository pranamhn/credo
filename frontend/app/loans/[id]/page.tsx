"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { formatIDR } from "@/lib/utils";
import { localData, LoanFacility, Covenant, Installment, CKPN_RATES } from "@/lib/localData";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Save } from "lucide-react";
import { toast } from "sonner";

const KOLK_META: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Lancar",           color: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-200" },
  2: { label: "Dalam Perhatian",  color: "text-amber-700",   bg: "bg-amber-50 ring-amber-200" },
  3: { label: "Kurang Lancar",    color: "text-orange-700",  bg: "bg-orange-50 ring-orange-200" },
  4: { label: "Diragukan",        color: "text-red-700",     bg: "bg-red-50 ring-red-200" },
  5: { label: "Macet",            color: "text-red-900",     bg: "bg-red-100 ring-red-300" },
};

type Tab = "overview" | "installments" | "covenants";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanFacility | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const all = localData.getLoans();
    setLoan(all.find((l) => l.id === id) ?? null);
  }, [id]);

  const save = (updated: LoanFacility) => {
    const all = localData.getLoans();
    const next = all.map((l) => (l.id === id ? updated : l));
    localData.saveLoans(next);
    setLoan(updated);
    toast.success("Data fasilitas disimpan");
  };

  const addInstallment = () => {
    if (!loan) return;
    const item: Installment = {
      id: crypto.randomUUID(), dueDate: "", principal: 0, interest: 0,
      paidDate: null, paidAmount: null, status: "pending",
    };
    save({ ...loan, installments: [...loan.installments, item] });
  };

  const updateInstallment = (idx: number, patch: Partial<Installment>) => {
    if (!loan) return;
    save({ ...loan, installments: loan.installments.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
  };

  const removeInstallment = (idx: number) => {
    if (!loan) return;
    save({ ...loan, installments: loan.installments.filter((_, i) => i !== idx) });
  };

  const addCovenant = () => {
    if (!loan) return;
    const item: Covenant = {
      id: crypto.randomUUID(), type: "financial", description: "", threshold: "", actual: "",
      status: "ok", lastChecked: "",
    };
    save({ ...loan, covenants: [...loan.covenants, item] });
  };

  const updateCovenant = (idx: number, patch: Partial<Covenant>) => {
    if (!loan) return;
    save({ ...loan, covenants: loan.covenants.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });
  };

  const removeCovenant = (idx: number) => {
    if (!loan) return;
    save({ ...loan, covenants: loan.covenants.filter((_, i) => i !== idx) });
  };

  const covenantBreaches = loan?.covenants.filter((c) => c.status === "breach").length ?? 0;
  const lateInstallments = loan?.installments.filter((i) => i.status === "terlambat" || i.status === "macet").length ?? 0;
  const paidInstallments = loan?.installments.filter((i) => i.status === "lunas").length ?? 0;
  const totalInstallments = loan?.installments.length ?? 0;
  const progressPct = totalInstallments > 0 ? Math.round((paidInstallments / totalInstallments) * 100) : 0;
  const ckpnAmount = loan ? loan.outstanding * CKPN_RATES[loan.kolektibilitas] : 0;

  if (!loan) {
    return (
      <AppShell>
        <div className="py-24 text-center text-slate-400">
          <p className="font-medium">Fasilitas tidak ditemukan.</p>
          <Link href="/loans" className="text-sm text-violet-600 hover:underline mt-2 block">← Kembali ke daftar</Link>
        </div>
      </AppShell>
    );
  }

  const meta = KOLK_META[loan.kolektibilitas];
  const daysToMaturity = Math.ceil((new Date(loan.maturityDate).getTime() - Date.now()) / 86400000);

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",     label: "Overview" },
    { key: "installments", label: `Cicilan (${totalInstallments})` },
    { key: "covenants",    label: `Covenant (${loan.covenants.length})` },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Detail Fasilitas</p>
            <h1 className="text-xl font-bold text-slate-900">{loan.companyName}</h1>
            <p className="text-sm text-slate-500">{loan.facilityName} · {loan.facilityType}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ring-1 ${meta.bg} ${meta.color}`}>
            {KOLK_META[loan.kolektibilitas].label}
          </span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Outstanding",  v: formatIDR(loan.outstanding), color: "text-slate-700" },
            { label: "Plafon",       v: formatIDR(loan.plafon),      color: "text-violet-700" },
            { label: "Suku Bunga",   v: `${loan.interestRate}% p.a.`, color: "text-slate-700" },
            { label: "CKPN Provisi", v: formatIDR(ckpnAmount),       color: "text-amber-700" },
          ].map(({ label, v, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`text-base font-bold ${color}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Alert banners */}
        {daysToMaturity < 90 && (
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${daysToMaturity < 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${daysToMaturity < 0 ? "text-red-500" : "text-amber-500"}`} />
            <p className={`text-xs font-medium ${daysToMaturity < 0 ? "text-red-700" : "text-amber-700"}`}>
              {daysToMaturity < 0 ? `Jatuh tempo sudah lewat ${Math.abs(daysToMaturity)} hari lalu (${loan.maturityDate})` : `Jatuh tempo dalam ${daysToMaturity} hari (${loan.maturityDate})`}
            </p>
          </div>
        )}
        {covenantBreaches > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">{covenantBreaches} covenant breach terdeteksi. Tindak lanjut diperlukan.</p>
          </div>
        )}
        {loan.dpd > 0 && (
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${loan.dpd > 90 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <Clock className={`h-4 w-4 shrink-0 ${loan.dpd > 90 ? "text-red-500" : "text-amber-500"}`} />
            <p className={`text-xs font-medium ${loan.dpd > 90 ? "text-red-700" : "text-amber-700"}`}>DPD: {loan.dpd} hari keterlambatan pembayaran</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-slate-100 px-4 py-3 flex items-center gap-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "text-slate-500 hover:bg-slate-50"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Info Fasilitas</p>
                {[
                  ["Perusahaan", loan.companyName],
                  ["Nomor Fasilitas", loan.facilityName],
                  ["Jenis", loan.facilityType],
                  ["Tanggal Mulai", loan.startDate],
                  ["Jatuh Tempo", loan.maturityDate],
                  ["Pembayaran Terakhir", loan.lastPaymentDate || "—"],
                  ["DPD", `${loan.dpd} hari`],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between py-2 border-b border-slate-50 text-xs">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Progres Pembayaran</p>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-500">Cicilan Lunas</span>
                      <span className="font-semibold text-slate-700">{paidInstallments}/{totalInstallments}</span>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-3 bg-violet-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{progressPct}% selesai</p>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Terlambat</span>
                    <span className={`font-bold ${lateInstallments > 0 ? "text-red-600" : "text-emerald-600"}`}>{lateInstallments} cicilan</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Covenant Breach</span>
                    <span className={`font-bold ${covenantBreaches > 0 ? "text-red-600" : "text-emerald-600"}`}>{covenantBreaches}</span>
                  </div>
                </div>

                {/* Edit key fields */}
                <div className="mt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Update Kolektibilitas & DPD</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Kolektibilitas</label>
                      <select value={loan.kolektibilitas}
                        onChange={(e) => save({ ...loan, kolektibilitas: Number(e.target.value) as LoanFacility["kolektibilitas"] })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400">
                        {[1,2,3,4,5].map((k) => <option key={k} value={k}>{k} — {KOLK_META[k].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Kolk Periode Lalu</label>
                      <select value={loan.previousKolektibilitas ?? ""}
                        onChange={(e) => save({ ...loan, previousKolektibilitas: e.target.value ? Number(e.target.value) as LoanFacility["kolektibilitas"] : undefined })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400">
                        <option value="">— Tidak ada</option>
                        {[1,2,3,4,5].map((k) => <option key={k} value={k}>{k} — {KOLK_META[k].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">DPD (hari)</label>
                      <input type="number" value={loan.dpd}
                        onChange={(e) => save({ ...loan, dpd: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Pembayaran Terakhir</label>
                    <input type="date" value={loan.lastPaymentDate}
                      onChange={(e) => save({ ...loan, lastPaymentDate: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INSTALLMENTS ── */}
          {tab === "installments" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Jadwal Cicilan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Lacak pembayaran pokok dan bunga per periode</p>
                </div>
                <button onClick={addInstallment}
                  className="flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-violet-600 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Tambah
                </button>
              </div>

              {loan.installments.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Belum ada jadwal cicilan.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Jatuh Tempo","Pokok","Bunga","Total","Tgl Bayar","Jml Dibayar","Status",""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loan.installments.map((inst, idx) => (
                        <tr key={inst.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2"><input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, { dueDate: e.target.value })} className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400" /></td>
                          <td className="px-3 py-2"><input type="number" value={inst.principal || ""} onChange={(e) => updateInstallment(idx, { principal: Number(e.target.value) })} placeholder="0" className="w-28 text-right text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400 tabular-nums" /></td>
                          <td className="px-3 py-2"><input type="number" value={inst.interest || ""} onChange={(e) => updateInstallment(idx, { interest: Number(e.target.value) })} placeholder="0" className="w-28 text-right text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400 tabular-nums" /></td>
                          <td className="px-3 py-2 tabular-nums font-semibold text-slate-700">{formatIDR(inst.principal + inst.interest)}</td>
                          <td className="px-3 py-2"><input type="date" value={inst.paidDate ?? ""} onChange={(e) => updateInstallment(idx, { paidDate: e.target.value || null })} className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400" /></td>
                          <td className="px-3 py-2"><input type="number" value={inst.paidAmount ?? ""} onChange={(e) => updateInstallment(idx, { paidAmount: Number(e.target.value) || null })} placeholder="0" className="w-28 text-right text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400 tabular-nums" /></td>
                          <td className="px-3 py-2">
                            <select value={inst.status} onChange={(e) => updateInstallment(idx, { status: e.target.value as Installment["status"] })}
                              className={`text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-violet-400 font-semibold ${inst.status === "lunas" ? "text-emerald-700" : inst.status === "terlambat" || inst.status === "macet" ? "text-red-600" : "text-amber-700"}`}>
                              <option value="pending">Pending</option>
                              <option value="lunas">Lunas</option>
                              <option value="terlambat">Terlambat</option>
                              <option value="macet">Macet</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeInstallment(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"><Trash2 className="h-3 w-3" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── COVENANTS ── */}
          {tab === "covenants" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Covenant Monitoring</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pantau covenant finansial dan non-finansial</p>
                </div>
                <button onClick={addCovenant}
                  className="flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-violet-600 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Tambah Covenant
                </button>
              </div>

              {loan.covenants.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Belum ada covenant yang dipantau.</div>
              ) : (
                <div className="space-y-3">
                  {loan.covenants.map((cov, idx) => (
                    <div key={cov.id} className={`rounded-xl border p-4 ${cov.status === "breach" ? "border-red-200 bg-red-50" : cov.status === "watch" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {cov.status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {cov.status === "watch" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {cov.status === "breach" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1 grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Tipe</label>
                            <select value={cov.type} onChange={(e) => updateCovenant(idx, { type: e.target.value as Covenant["type"] })}
                              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:border-violet-400 bg-white">
                              <option value="financial">Financial</option>
                              <option value="non_financial">Non-Financial</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Status</label>
                            <select value={cov.status} onChange={(e) => updateCovenant(idx, { status: e.target.value as Covenant["status"] })}
                              className={`text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-violet-400 bg-white font-semibold ${cov.status === "ok" ? "text-emerald-700" : cov.status === "watch" ? "text-amber-700" : "text-red-700"}`}>
                              <option value="ok">OK</option>
                              <option value="watch">Watch</option>
                              <option value="breach">Breach</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-500 block mb-1">Deskripsi Covenant</label>
                            <input value={cov.description} onChange={(e) => updateCovenant(idx, { description: e.target.value })}
                              placeholder="e.g. DER tidak melebihi 2.5x"
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Threshold</label>
                            <input value={cov.threshold} onChange={(e) => updateCovenant(idx, { threshold: e.target.value })}
                              placeholder="≤ 2.5x" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Aktual</label>
                            <input value={cov.actual} onChange={(e) => updateCovenant(idx, { actual: e.target.value })}
                              placeholder="2.1x" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Terakhir Diperiksa</label>
                            <input type="date" value={cov.lastChecked} onChange={(e) => updateCovenant(idx, { lastChecked: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" />
                          </div>
                        </div>
                        <button onClick={() => removeCovenant(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
