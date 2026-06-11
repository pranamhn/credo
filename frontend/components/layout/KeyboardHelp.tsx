"use client";

import { Command, Search, Upload, X } from "lucide-react";

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    keys: ["⌘", "K"],
    title: "Command palette",
    description: "Cari halaman atau perintah cepat.",
    icon: Command,
  },
  {
    keys: ["/"],
    title: "Search",
    description: "Buka command palette dari halaman mana pun.",
    icon: Search,
  },
  {
    keys: ["U"],
    title: "Upload dokumen",
    description: "Masuk langsung ke halaman upload.",
    icon: Upload,
  },
  {
    keys: ["?"],
    title: "Keyboard help",
    description: "Tampilkan daftar shortcut ini.",
    icon: Command,
  },
  {
    keys: ["Esc"],
    title: "Tutup overlay",
    description: "Menutup panel, modal, dan navigasi mobile.",
    icon: X,
  },
];

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Tutup keyboard help"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Keyboard shortcuts</p>
            <p className="text-xs text-slate-400">Navigasi cepat untuk workflow analis.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.keys.map((key) => (
                    <kbd key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
