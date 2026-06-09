"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Building2, CloudUpload, Command, FileText,
  Search, Settings, ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  shortcut?: string;
}

const COMMANDS: CommandItem[] = [
  { id: "companies",  label: "Companies",  description: "Portofolio perusahaan & dokumen", icon: <Building2  className="h-4 w-4" />, href: "/companies" },
  { id: "statements", label: "Statements", description: "Library rekening koran",           icon: <FileText   className="h-4 w-4" />, href: "/statements" },
  { id: "upload",     label: "Upload",     description: "Upload dokumen baru",              icon: <CloudUpload className="h-4 w-4" />, href: "/upload",     shortcut: "U" },
  { id: "analytics",  label: "Analytics",  description: "Tren risiko portofolio",           icon: <BarChart3  className="h-4 w-4" />, href: "/analytics" },
  { id: "admin",      label: "Admin",      description: "Parser & operations console",      icon: <Settings   className="h-4 w-4" />, href: "/admin" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query,     setQuery]     = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = query.trim()
    ? COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const navigate = (item: CommandItem) => {
    router.push(item.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((v) => Math.min(v + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered[activeIdx]) navigate(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman atau perintah…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="py-1.5 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => navigate(item)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === activeIdx ? "bg-teal-50" : "hover:bg-slate-50"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    idx === activeIdx
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${idx === activeIdx ? "text-teal-700" : "text-slate-900"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{item.description}</p>
                </div>
                {item.shortcut && (
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {item.shortcut}
                  </kbd>
                )}
                {idx === activeIdx && (
                  <ArrowRight className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 bg-slate-50">
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">↑↓</kbd>
              navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">⏎</kbd>
              buka
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">ESC</kbd>
              tutup
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
