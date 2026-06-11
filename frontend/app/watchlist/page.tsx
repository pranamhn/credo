"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { localData, WatchlistEntry, LoanFacility } from "@/lib/localData";
import { Plus, Trash2, Search, AlertTriangle, Target, Calendar, TrendingDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const TIER_META = {
  kuning: { label: "Perhatian Khusus", color: "text-amber-700",  bg: "bg-amber-50 ring-amber-200", dot: "bg-amber-400",   icon: "⚠" },
  merah:  { label: "Kredit Bermasalah", color: "text-red-700",    bg: "bg-red-50 ring-red-200",     dot: "bg-red-500",    icon: "🔴" },
};

function emptyEntry(): WatchlistEntry {
  return {
    id: crypto.randomUUID(), companyId: "", companyName: "", ewsTier: "kuning",
    reasons: [], addedDate: new Date().toISOString().slice(0, 10),
    actionPlan: "", targetDate: "", assignee: "", notes: "",
  };
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loans, setLoans] = useState<LoanFacility[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "kuning" | "merah">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WatchlistEntry>(emptyEntry());
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    setEntries(localData.getWatchlist());
    setLoans(localData.getLoans());
  }, []);

  const filtered = useMemo(() => entries.filter((e) => {
    const matchSearch = !search || e.companyName.toLowerCase().includes(search.toLowerCase());
    const matchTier   = tierFilter === "all" || e.ewsTier === tierFilter;
    return matchSearch && matchTier;
  }), [entries, search, tierFilter]);

  const saveEntry = () => {
    if (!draft.companyName.trim()) { toast.error("Nama perusahaan wajib diisi"); return; }
    const updated = editId
      ? entries.map((e) => (e.id === editId ? draft : e))
      : [...entries, draft];
    setEntries(updated);
    localData.saveWatchlist(updated);
    setEditId(null);
    setDraft(emptyEntry());
    toast.success("Watchlist diperbarui");
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    localData.saveWatchlist(updated);
    toast.success("Dihapus dari watchlist");
  };

  const startEdit = (e: WatchlistEntry) => {
    setDraft({ ...e });
    setEditId(e.id);
  };

  const setDraftField = <K extends keyof WatchlistEntry>(k: K, v: WatchlistEntry[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const addReason = () => {
    if (!newReason.trim()) return;
    setDraftField("reasons", [...draft.reasons, newReason.trim()]);
    setNewReason("");
  };

  const removeReason = (idx: number) =>
    setDraftField("reasons", draft.reasons.filter((_, i) => i !== idx));

  const merahCount  = entries.filter((e) => e.ewsTier === "merah").length;
  const kuningCount = entries.filter((e) => e.ewsTier === "kuning").length;

  const overdueEntries = entries.filter((e) => e.targetDate && new Date(e.targetDate) < new Date()).length;

  const watchlistCompanyIds = new Set(entries.map((e) => e.companyId));
  const nplNotWatchlisted = loans.filter(
    (l) => l.kolektibilitas >= 3 && !watchlistCompanyIds.has(l.companyId)
  ).length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Monitoring</p>
            <h1 className="text-xl font-bold text-slate-900">Watch List — Early Warning Signal</h1>
          </div>
          <button onClick={() => { setDraft(emptyEntry()); setEditId("new"); }}
            className="flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-600 transition-all">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Watchlist",       v: String(entries.length),  color: "text-slate-700" },
            { label: "Kredit Bermasalah",      v: String(merahCount),      color: merahCount > 0 ? "text-red-600" : "text-slate-500" },
            { label: "Rencana Aksi Terlambat", v: String(overdueEntries), color: overdueEntries > 0 ? "text-amber-600" : "text-slate-500" },
          ].map(({ label, v, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`text-2xl font-black ${color}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* NPL Banner */}
        {nplNotWatchlisted > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{nplNotWatchlisted} debitur</span> dengan Kolektibilitas ≥ 3 belum masuk Watch List
              </p>
            </div>
            <Link href="/npl" className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              Lihat NPL Tracker <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari perusahaan…"
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
          </div>
          {(["all","kuning","merah"] as const).map((t) => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tierFilter === t ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "text-slate-500 hover:bg-slate-100 border border-slate-200"}`}>
              {t === "all" ? `Semua (${entries.length})` : t === "kuning" ? `Perhatian (${kuningCount})` : `Bermasalah (${merahCount})`}
            </button>
          ))}
        </div>

        {/* Add/Edit form */}
        {editId !== null && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold text-slate-800">{editId === "new" ? "Tambah ke Watch List" : "Edit Entri"}</p>
              <button onClick={() => setEditId(null)} className="text-xs text-slate-400 hover:text-slate-600">Batal</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: "Nama Perusahaan *", node: <input value={draft.companyName} onChange={(e) => setDraftField("companyName", e.target.value)} placeholder="PT ..." className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" /> },
                { label: "Company ID (opsional)", node: <input value={draft.companyId} onChange={(e) => setDraftField("companyId", e.target.value)} placeholder="UUID dari Companies" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" /> },
                { label: "Tier EWS", node: (
                  <select value={draft.ewsTier} onChange={(e) => setDraftField("ewsTier", e.target.value as WatchlistEntry["ewsTier"])}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white">
                    <option value="kuning">⚠ Kuning — Perhatian Khusus</option>
                    <option value="merah">🔴 Merah — Kredit Bermasalah</option>
                  </select>
                )},
                { label: "PIC / Assignee", node: <input value={draft.assignee} onChange={(e) => setDraftField("assignee", e.target.value)} placeholder="Nama analis" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" /> },
                { label: "Tanggal Ditambahkan", node: <input type="date" value={draft.addedDate} onChange={(e) => setDraftField("addedDate", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" /> },
                { label: "Target Penyelesaian", node: <input type="date" value={draft.targetDate} onChange={(e) => setDraftField("targetDate", e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" /> },
              ].map(({ label, node }) => (
                <div key={label}>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">{label}</label>
                  {node}
                </div>
              ))}

              {/* Reasons */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 block mb-2">Alasan / Indikator Risiko</label>
                <div className="flex gap-2 mb-2">
                  <input value={newReason} onChange={(e) => setNewReason(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addReason()}
                    placeholder="Tambah indikator risiko… (Enter untuk tambah)"
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white" />
                  <button onClick={addReason} className="text-xs bg-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-300 transition-all">Tambah</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.reasons.map((r, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 text-xs text-slate-700 px-3 py-1 rounded-full">
                      {r}
                      <button onClick={() => removeReason(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Rencana Aksi</label>
                <textarea value={draft.actionPlan} onChange={(e) => setDraftField("actionPlan", e.target.value)} rows={2}
                  placeholder="Langkah penyelesaian yang direncanakan..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white resize-none placeholder:text-slate-300" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Catatan</label>
                <textarea value={draft.notes} onChange={(e) => setDraftField("notes", e.target.value)} rows={2}
                  placeholder="Catatan tambahan..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-violet-400 bg-white resize-none placeholder:text-slate-300" />
              </div>
            </div>
            <button onClick={saveEntry}
              className="mt-4 flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-600 transition-all">
              <Target className="h-3.5 w-3.5" /> Simpan
            </button>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-400">
            {entries.length === 0
              ? <><AlertTriangle className="h-10 w-10 mx-auto mb-3 text-slate-300" /><p className="font-medium">Watch list kosong</p><p className="text-xs mt-1">Tambahkan perusahaan yang memerlukan pemantauan khusus</p></>
              : <p className="font-medium">Tidak ada hasil yang cocok</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const meta = TIER_META[e.ewsTier];
              const isOverdue = e.targetDate && new Date(e.targetDate) < new Date();
              return (
                <div key={e.id} className={`rounded-xl border bg-white p-5 shadow-sm ${e.ewsTier === "merah" ? "border-red-200" : "border-amber-200"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 ${meta.bg} ${meta.color} shrink-0 mt-0.5`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm">{e.companyName}</p>
                          {e.companyId && (
                            <Link href={`/companies/${e.companyId}`} className="text-[10px] text-violet-600 hover:underline">→ Profil</Link>
                          )}
                        </div>
                        {e.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {e.reasons.map((r, i) => (
                              <span key={i} className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{r}</span>
                            ))}
                          </div>
                        )}
                        {e.actionPlan && <p className="text-xs text-slate-500 mt-2">Aksi: {e.actionPlan}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.targetDate && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg ${isOverdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                          <Calendar className="h-3 w-3" />
                          {e.targetDate}
                          {isOverdue && " (Terlambat)"}
                        </span>
                      )}
                      {e.assignee && <span className="text-[10px] text-slate-400">@{e.assignee}</span>}
                      <button onClick={() => startEdit(e)} className="text-xs text-violet-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => deleteEntry(e.id)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {e.notes && <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">{e.notes}</p>}
                  <p className="text-[10px] text-slate-300 mt-2">Ditambahkan: {e.addedDate}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
