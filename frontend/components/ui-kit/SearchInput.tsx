"use client";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  shortcut?: string;
}

export function SearchInput({ value, onChange, placeholder = "Cari…", className, shortcut }: SearchInputProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-700 placeholder:text-slate-400",
          "outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10",
          "transition-all shadow-sm",
          "pl-8",
          shortcut ? "pr-16" : "pr-8"
        )}
      />
      {shortcut && !value && (
        <kbd className="pointer-events-none absolute right-2.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          {shortcut}
        </kbd>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
