"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, DataCard } from "@/components/ui-kit";
import {
  Users, Activity, ShieldCheck, Trash2, Plus, CheckCircle2,
  AlertTriangle, XCircle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// AD1 — Mock user data
type Role = "Administrator" | "Analis Senior" | "Analis" | "Viewer";
interface User { id: string; name: string; email: string; role: Role; lastActive: string; active: boolean }

const INITIAL_USERS: User[] = [
  { id: "1", name: "Rachmad Mahendra", email: "rachmad@credo.id",  role: "Administrator",  lastActive: "Baru saja",   active: true },
  { id: "2", name: "Andi Wijaya",      email: "andi@credo.id",     role: "Analis Senior",  lastActive: "2 jam lalu",  active: true },
  { id: "3", name: "Siti Rahayu",      email: "siti@credo.id",     role: "Analis",         lastActive: "Kemarin",     active: true },
  { id: "4", name: "Budi Santoso",     email: "budi@credo.id",     role: "Viewer",         lastActive: "3 hari lalu", active: false },
];

const ROLE_BADGE: Record<Role, string> = {
  "Administrator": "bg-red-50 text-red-700 ring-red-200",
  "Analis Senior": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Analis":        "bg-teal-50 text-teal-700 ring-teal-200",
  "Viewer":        "bg-slate-100 text-slate-600 ring-slate-200",
};

const ROLES: Role[] = ["Administrator", "Analis Senior", "Analis", "Viewer"];

// AD2 — Mock parser health data
interface BankHealth { bank: string; status: "ok" | "degraded" | "down"; successRate: number; avgParseSec: number; lastChecked: string }
const BANK_HEALTH: BankHealth[] = [
  { bank: "BCA",        status: "ok",       successRate: 98.5, avgParseSec: 4.2,  lastChecked: "1 min lalu" },
  { bank: "Mandiri",    status: "ok",       successRate: 97.1, avgParseSec: 5.8,  lastChecked: "1 min lalu" },
  { bank: "BNI",        status: "ok",       successRate: 96.4, avgParseSec: 6.1,  lastChecked: "2 min lalu" },
  { bank: "BRI",        status: "degraded", successRate: 82.0, avgParseSec: 12.4, lastChecked: "2 min lalu" },
  { bank: "CIMB Niaga", status: "ok",       successRate: 95.8, avgParseSec: 5.2,  lastChecked: "3 min lalu" },
  { bank: "Danamon",    status: "ok",       successRate: 93.2, avgParseSec: 7.4,  lastChecked: "3 min lalu" },
  { bank: "Permata",    status: "degraded", successRate: 78.5, avgParseSec: 15.1, lastChecked: "5 min lalu" },
  { bank: "BTN",        status: "ok",       successRate: 91.0, avgParseSec: 8.0,  lastChecked: "5 min lalu" },
  { bank: "Maybank",    status: "ok",       successRate: 90.5, avgParseSec: 8.3,  lastChecked: "6 min lalu" },
  { bank: "Panin",      status: "down",     successRate: 0,    avgParseSec: 0,    lastChecked: "10 min lalu" },
];

const STATUS_META = {
  ok:       { label: "OK",       icon: CheckCircle2,   cls: "text-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  degraded: { label: "Degraded", icon: AlertTriangle,  cls: "text-amber-500",   badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  down:     { label: "Down",     icon: XCircle,        cls: "text-red-500",     badge: "bg-red-50 text-red-700 ring-red-200" },
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "health">("users");

  // AD1 state
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole]   = useState<Role>("Analis");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // AD2 state
  const [refreshing, setRefreshing] = useState(false);

  const handleAddUser = () => {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Nama dan email wajib diisi"); return; }
    const id = Date.now().toString();
    setUsers((prev) => [...prev, { id, name: newName.trim(), email: newEmail.trim(), role: newRole, lastActive: "Baru saja", active: true }]);
    setNewName(""); setNewEmail(""); setShowAdd(false);
    toast.success(`User ${newName} ditambahkan`);
  };

  const handleToggleActive = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !u.active } : u));
  };

  const handleDelete = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setConfirmDeleteId(null);
    toast.success("User dihapus");
  };

  const handleChangeRole = (id: string, role: Role) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
  };

  const handleRefreshHealth = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); toast.success("Status parser diperbarui"); }, 1500);
  };

  const okCount       = BANK_HEALTH.filter((b) => b.status === "ok").length;
  const degradedCount = BANK_HEALTH.filter((b) => b.status === "degraded").length;
  const downCount     = BANK_HEALTH.filter((b) => b.status === "down").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operations"
          title="Admin & Parser Quality"
          description="Manajemen user, role, dan monitoring kualitas parser per bank"
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { key: "users",  label: "Manajemen User", icon: Users },
            { key: "health", label: "Parser Health",  icon: Activity },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as "users" | "health")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── AD1: User Management ── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-500">{users.filter((u) => u.active).length} aktif · {users.filter((u) => !u.active).length} nonaktif</p>
              </div>
              <button onClick={() => setShowAdd((v) => !v)}
                className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors shadow-sm">
                <Plus className="h-4 w-4" /> Tambah User
              </button>
            </div>

            {showAdd && (
              <DataCard accent>
                <p className="text-sm font-semibold text-slate-800 mb-4">User Baru</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama lengkap"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-400 transition-all" />
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-400 transition-all" />
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 transition-all cursor-pointer">
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <button onClick={handleAddUser}
                    className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors">
                    Tambah
                  </button>
                </div>
              </DataCard>
            )}

            <DataCard padding="flush">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Nama / Email", "Role", "Status", "Last Active", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-[11px] font-bold text-white">
                            {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value as Role)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 outline-none cursor-pointer ${ROLE_BADGE[u.role]}`}>
                          {ROLES.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleActive(u.id)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition-all ${
                            u.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                          }`}>
                          {u.active ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{u.lastActive}</td>
                      <td className="px-4 py-3">
                        {u.role !== "Administrator" && (
                          confirmDeleteId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-red-400">Hapus?</span>
                              <button onClick={() => handleDelete(u.id)}
                                className="text-xs px-2 py-0.5 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100">Ya</button>
                              <button onClick={() => setConfirmDeleteId(null)}
                                className="text-xs px-2 py-0.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">Batal</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(u.id)}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-500 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataCard>
          </div>
        )}

        {/* ── AD2: Parser Health ── */}
        {activeTab === "health" && (
          <div className="space-y-4">
            {/* Summary chips */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">{okCount} Bank OK</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">{degradedCount} Degraded</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 ring-1 ring-red-200">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700">{downCount} Down</span>
              </div>
              <button onClick={handleRefreshHealth} disabled={refreshing}
                className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BANK_HEALTH.map((b) => {
                const meta = STATUS_META[b.status];
                const StatusIcon = meta.icon;
                return (
                  <div key={b.bank} className={`rounded-xl border bg-white p-4 shadow-sm ring-1 transition-all ${
                    b.status === "ok" ? "border-slate-200 ring-transparent" :
                    b.status === "degraded" ? "border-amber-200 ring-amber-100" :
                    "border-red-200 ring-red-100"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">{b.bank}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </div>
                    {b.status !== "down" ? (
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Success Rate</span>
                            <span className="font-semibold text-slate-700">{b.successRate}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${b.successRate >= 95 ? "bg-emerald-500" : b.successRate >= 85 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${b.successRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Avg. parse time</span>
                          <span className="font-semibold text-slate-600">{b.avgParseSec}s</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-red-400">Parser tidak merespons</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-3">Checked {b.lastChecked}</p>
                  </div>
                );
              })}
            </div>

            <DataCard padding="compact">
              <p className="text-xs font-semibold text-slate-600">Catatan</p>
              <p className="text-xs text-slate-400 mt-1 leading-5">
                Data ini merupakan simulasi. Integrasi monitoring real-time memerlukan endpoint <code className="bg-slate-100 px-1 rounded">/api/v1/admin/parser-health</code> pada backend.
              </p>
            </DataCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}
