import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateStr));
}

export function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

export function severityColor(s: "high" | "medium" | "low"): string {
  return s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";
}

// S6 — Human-readable parse error mapping
const PARSE_ERROR_MAP: [RegExp, string][] = [
  [/password.?protected/i, "PDF diproteksi password. Gunakan file tanpa enkripsi."],
  [/encrypt/i, "File terenkripsi. Simpan ulang PDF tanpa password."],
  [/corrupt/i, "File rusak atau tidak lengkap. Download ulang dari sumber."],
  [/timeout/i, "Proses parsing terlalu lama. Coba file yang lebih kecil atau split halaman."],
  [/unsupported.*format/i, "Format file tidak didukung. Gunakan PDF, XLSX, atau CSV."],
  [/no.*text/i, "PDF tidak mengandung teks (mungkin hasil scan). Gunakan PDF dengan text layer."],
  [/page.*limit/i, "Jumlah halaman melebihi batas. Maksimal 500 halaman per file."],
  [/table.*not.*found/i, "Struktur tabel tidak dikenali. Pastikan format sesuai template bank."],
  [/invalid.*header/i, "Header kolom tidak dikenali. Periksa format kolom CSV/XLSX."],
  [/missing.*column/i, "Kolom wajib tidak ditemukan. Pastikan file memiliki kolom tanggal, deskripsi, nominal."],
  [/cannot.*read/i, "File tidak dapat dibaca. Periksa apakah file bisa dibuka manual."],
  [/not.*pdf/i, "Bukan file PDF. Konversi ke PDF sebelum upload."],
  [/empty/i, "File kosong atau tidak berisi data. Periksa isi file."],
  [/pars(e|ing).*fail/i, "Gagal membaca data transaksi. Coba format ulang file atau hubungi support."],
  [/unrecognized/i, "Format tidak dikenali. Upload ulang dengan format standar internet banking."],
];

export function humanizeParseError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  for (const [pattern, message] of PARSE_ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }
  // Return shortened version if no match
  return raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
}
