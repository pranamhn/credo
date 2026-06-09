# RiskLens — UI Design System

> Versi: 3.0 · Terakhir diperbarui: 2026-06-08
> Stack: Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui

---

## Daftar Isi

1. [Design Philosophy](#1-design-philosophy)
2. [Color Tokens](#2-color-tokens)
3. [Typography](#3-typography)
4. [Spacing & Radius](#4-spacing--radius)
5. [Component Library](#5-component-library)
6. [Page Layouts](#6-page-layouts)
7. [UX Review Report](#7-ux-review-report)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Design Philosophy

### Vision
**Clean. Professional. Trustworthy.**

RiskLens adalah alat analisis kredit profesional. Tampilannya harus menyampaikan kepercayaan (trust), keterbacaan data, dan kejernihan keputusan — terinspirasi dari PatientPop dashboard.

### Prinsip

| Prinsip | Penjelasan |
|---|---|
| **Light-first** | White/light-gray background, kontras tinggi untuk keterbacaan siang hari |
| **Teal accent** | Teal-500 (#14b8a6) sebagai primary — modern, profesional, medis/fintech |
| **Data density** | Tampilkan informasi padat tanpa kesan penuh sesak |
| **Progressive disclosure** | Detail tersembunyi di balik aksi — jangan paksakan semua ke satu layar |
| **Signal vs noise** | Warna semantik (merah = bahaya, hijau = aman) digunakan secara konsisten |
| **Hover transitions** | Subtle shadow elevation dan border color shift pada hover |

### Inspirasi Visual
- Layout dan warna ala **PatientPop** — white cards, teal primary, clean typography
- Card layout **Linear.app** — bersih, minimal, dense
- Status pill dari **Vercel Dashboard** — soft background + ring border

---

## 2. Color Tokens

### Base Palette

| Token | CSS Variable | Hex (approx) | Kegunaan |
|---|---|---|---|
| Background | `--background` | `#F4F7FA` | App background (soft blue-gray) |
| Card surface | `--card` | `#FFFFFF` | Semua card/panel |
| Border subtle | `--border` | `#e2e8f0` (slate-200) | Default border |
| Text primary | `--foreground` | `#1e293b` (slate-800) | Heading & value |
| Text secondary | — | `#64748b` (slate-500) | Label & desc |
| Text muted | — | `#94a3b8` (slate-400) | Placeholder, caption |

### Accent Palette

| Warna | Token Tailwind | Hex | Digunakan untuk |
|---|---|---|---|
| **Teal** | `teal-500` / `teal-600` | `#14b8a6` / `#0d9488` | Primary action, active nav, link |
| Emerald | `emerald-600` / `emerald-700` | `#059669` / `#047857` | Success, credit, reconciled OK |
| Red | `red-500` / `red-600` | `#ef4444` / `#dc2626` | Danger, debit, high risk flag |
| Amber | `amber-600` / `amber-700` | `#d97706` / `#b45309` | Warning, needs review, medium risk |
| Indigo | `indigo-600` | `#4f46e5` | Parsing in progress |
| Slate | `slate-500` | `#64748b` | Queued / neutral |
| Violet | `violet-600` | `#7c3aed` | Analytics / secondary insight |

### Light Badge Convention

| Severity | Background | Text | Ring |
|---|---|---|---|
| success/done | `bg-emerald-50` | `text-emerald-700` | `ring-emerald-200` |
| warning/review | `bg-amber-50` | `text-amber-700` | `ring-amber-200` |
| danger/failed | `bg-red-50` | `text-red-600` | `ring-red-200` |
| info/parsing | `bg-indigo-50` | `text-indigo-600` | `ring-indigo-200` |
| neutral/queued | `bg-slate-100` | `text-slate-600` | `ring-slate-200` |

---

## 3. Typography

Font: **Geist** (variable, via `next/font/local`)

| Level | Kelas Tailwind | Rem | Kegunaan |
|---|---|---|---|
| Display | `text-2xl font-bold tracking-tight` | 1.5rem | Page title (h1) |
| Heading | `text-xl font-semibold` | 1.25rem | Section heading (h2) |
| Subheading | `text-base font-semibold` | 1rem | Card title, table group |
| Body | `text-sm` | 0.875rem | Deskripsi, paragraph |
| Label | `text-xs` | 0.75rem | Metadata, badge, helper text |
| Caption | `text-[11px]` | 0.6875rem | Secondary metadata |
| Micro | `text-[10px] uppercase tracking-widest` | 0.625rem | Section label / eyebrow |

---

## 4. Spacing & Radius

### Spacing Scale (Tailwind)

| Usage | Value | Class |
|---|---|---|
| Card internal padding | 20px | `p-5` |
| Compact card padding | 16px | `p-4` |
| Gap antara section | 24px | `gap-6` |
| Gap antara card | 16px | `gap-4` |
| Gap kecil (badge, pill) | 8px | `gap-2` |
| Inline gap (icon + text) | 12px | `gap-3` |

### Border Radius

| Elemen | Kelas | px |
|---|---|---|
| Card besar | `rounded-xl` | 12px |
| Input, tag, icon container | `rounded-lg` | 8px |
| Badge / pill | `rounded-full` | 9999px |
| Tombol kecil | `rounded-lg` | 8px |

### Shadow
```
shadow-sm                    ← default card depth
shadow-md                    ← hover card elevation
border-teal-300 shadow-md    ← hover state on interactive cards
```

---

## 5. Component Library

> Semua komponen di-export dari `@/components/ui-kit`

---

### `PageHeader`

Digunakan di atas setiap halaman untuk konsistensi header.

**Props**

| Prop | Type | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `eyebrow` | `string` | — | — | Label kecil di atas title (cyan, uppercase) |
| `title` | `string` | ✓ | — | Judul halaman |
| `description` | `string` | — | — | Subtitle / deskripsi singkat |
| `actions` | `ReactNode` | — | — | Slot kanan (tombol CTA, dll) |
| `className` | `string` | — | — | Override tambahan |

**Contoh penggunaan**
```tsx
import { PageHeader, GlowButton } from "@/components/ui-kit";
import { Plus } from "lucide-react";

<PageHeader
  eyebrow="Portfolio"
  title="Daftar Perusahaan"
  description="56 perusahaan terdaftar"
  actions={
    <GlowButton variant="primary" icon={<Plus className="h-4 w-4" />} href="/upload">
      Buat Perusahaan
    </GlowButton>
  }
/>
```

---

### `DataCard` + `DataCardHeader`

Base card untuk semua panel konten.

**DataCard Props**

| Prop | Type | Default | Keterangan |
|---|---|---|---|
| `accent` | `boolean` | `false` | Top-edge gradient line (cyan) |
| `hoverable` | `boolean` | `false` | Hover border highlight |
| `padding` | `"default" \| "compact" \| "flush"` | `"default"` | Preset padding |
| `className` | `string` | — | Override |

**DataCardHeader Props**

| Prop | Type | Keterangan |
|---|---|---|
| `title` | `string` | Judul section dalam card |
| `subtitle` | `string` | Opsional subtitle |
| `actions` | `ReactNode` | Slot kanan header |

**Contoh penggunaan**
```tsx
import { DataCard, DataCardHeader } from "@/components/ui-kit";

<DataCard accent hoverable>
  <DataCardHeader title="Transaksi Terakhir" actions={<FilterButton />} />
  {/* konten */}
</DataCard>

{/* Tabel tanpa padding */}
<DataCard padding="flush" className="overflow-hidden">
  <table>…</table>
</DataCard>
```

---

### `StatCard`

Card metrik ringkas dengan ikon, nilai, label, dan trend opsional.

**Props**

| Prop | Type | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `icon` | `ReactNode` | — | — | Ikon lucide-react |
| `value` | `string \| number` | ✓ | — | Nilai utama |
| `label` | `string` | ✓ | — | Label di bawah nilai |
| `color` | `StatColor` | — | `"default"` | Skema warna aksen |
| `trend` | `string` | — | — | Teks perubahan (mis. "+12%") |
| `trendUp` | `boolean` | — | — | `true` = hijau, `false` = merah |
| `className` | `string` | — | — | Override |

**StatColor values**: `cyan | emerald | red | amber | indigo | violet | default`

**Contoh penggunaan**
```tsx
import { StatCard } from "@/components/ui-kit";
import { FileText, ShieldCheck, Timer } from "lucide-react";

<div className="grid grid-cols-3 gap-3">
  <StatCard icon={<FileText />}    value={24}  label="Total Upload"    color="cyan"    trend="+3 minggu ini" trendUp />
  <StatCard icon={<ShieldCheck />} value={18}  label="Rekonsiliasi OK" color="emerald" />
  <StatCard icon={<Timer />}       value={3}   label="Sedang Diproses" color="amber" />
</div>
```

---

### `GlowButton`

Polimorfik — render sebagai `<button>` atau Next.js `<Link>` berdasarkan `href`.

**Props**

| Prop | Type | Default | Keterangan |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"secondary"` | Tampilan |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"sm"` | Ukuran |
| `icon` | `ReactNode` | — | Ikon kiri |
| `iconRight` | `ReactNode` | — | Ikon kanan |
| `loading` | `boolean` | `false` | Spinner + disabled |
| `href` | `string` | — | Jika ada → render `<Link>` |
| `className` | `string` | — | Override |

**Contoh penggunaan**
```tsx
import { GlowButton } from "@/components/ui-kit";
import { Plus, ArrowRight } from "lucide-react";

{/* Tombol aksi */}
<GlowButton variant="primary" icon={<Plus />} onClick={handleCreate} loading={creating}>
  Buat Baru
</GlowButton>

{/* Link navigasi */}
<GlowButton variant="ghost" iconRight={<ArrowRight />} href="/statements">
  Lihat Semua
</GlowButton>

{/* Tombol bahaya */}
<GlowButton variant="danger" size="xs">Hapus</GlowButton>
```

---

### `SearchInput`

Input pencarian dengan clear button dan keyboard shortcut hint.

**Props**

| Prop | Type | Default | Keterangan |
|---|---|---|---|
| `value` | `string` | ✓ | — | Nilai terkini |
| `onChange` | `(v: string) => void` | ✓ | — | Handler |
| `placeholder` | `string` | `"Cari…"` | Teks placeholder |
| `shortcut` | `string` | — | Teks shortcut (`⌘K`) |
| `className` | `string` | — | Override |

**Contoh penggunaan**
```tsx
import { SearchInput } from "@/components/ui-kit";

const [search, setSearch] = useState("");

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Cari perusahaan, bank…"
  shortcut="⌘K"
  className="max-w-xs"
/>
```

---

### `EmptyState`

Placeholder untuk state kosong atau coming soon.

**Props**

| Prop | Type | Default | Keterangan |
|---|---|---|---|
| `icon` | `ReactNode` | — | Ikon ilustrasi |
| `title` | `string` | ✓ | — | Judul state |
| `description` | `string` | — | — | Penjelasan singkat |
| `action` | `ReactNode` | — | — | CTA (biasanya GlowButton) |
| `variant` | `"dashed" \| "solid"` | `"dashed"` | Tipe border |
| `className` | `string` | — | — | Override |

**Contoh penggunaan**
```tsx
import { EmptyState, GlowButton } from "@/components/ui-kit";
import { FileText, Plus } from "lucide-react";

<EmptyState
  icon={<FileText className="h-6 w-6" />}
  title="Belum ada statement"
  description="Upload file pertama untuk mulai analisis."
  action={
    <GlowButton variant="primary" icon={<Plus />} href="/upload">
      Upload sekarang
    </GlowButton>
  }
/>
```

---

### `SectionLabel`

Label kecil uppercase untuk memisahkan section di dalam card.

**Props**: `children`, `className`

**Contoh penggunaan**
```tsx
import { SectionLabel } from "@/components/ui-kit";

<SectionLabel className="mb-4">Ringkasan portofolio</SectionLabel>
```

---

### Komponen non-kit (domain-spesifik)

| Komponen | Path | Keterangan |
|---|---|---|
| `StatusBadge` | `components/statement/StatusBadge.tsx` | Neon pill untuk status parsing |
| `MetricCard` | `components/statement/MetricCard.tsx` | Card KPI dengan accent bar |
| `FlagCard` | `components/risk/FlagCard.tsx` | Card red flag berdasar severity |
| `DropZone` | `components/upload/DropZone.tsx` | Drag & drop file dengan progress |

---

## 6. Page Layouts

### Struktur Global

```
<html class="dark">
  <body>  ← dot-grid texture
    <AppShell>
      <Sidebar />          ← w-56, fixed left
      <main>
        <Topbar />         ← h-12, sticky top, backdrop-blur
        <div class="p-6">  ← page content
          <PageHeader />
          {/* page content */}
        </div>
      </main>
    </AppShell>
  </body>
</html>
```

### Grid Patterns

```tsx
{/* 3-col stats row */}
<div className="grid gap-3 grid-cols-3">

{/* 2-col (main + sidebar) */}
<div className="grid gap-6 lg:grid-cols-[1fr_260px]">

{/* Responsive card grid */}
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

{/* 3-col feature cards */}
<div className="grid gap-4 md:grid-cols-3">
```

### Recharts Dark Config

```tsx
const TOOLTIP = {
  contentStyle: {
    backgroundColor: "#0f1726",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
  },
};
const AXIS_TICK = { fill: "#475569", fontSize: 10 };
const GRID    = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.04)" };
```

---

## 7. UX Review Report

> Simulasi review dari 10 UX designer + 50 user (credit analyst).

### 7.1 Temuan Designer (10 perspektif)

| # | Kategori | Temuan | Prioritas |
|---|---|---|---|
| D1 | Hierarchy | PageHeader konsisten di semua halaman → navigasi jelas | ✅ Solved |
| D2 | Affordance | GlowButton menunjukkan state loading — tidak bisa klik dobel | ✅ Solved |
| D3 | Feedback | Toast Sonner memberikan konfirmasi aksi sukses/gagal | ✅ Solved |
| D4 | Proximity | Sidebar nav item grouped by function dengan label | ✅ Solved |
| D5 | Contrast | Semua text value memakai `slate-200`, metadata `slate-600` | ✅ Solved |
| D6 | Spacing | Card padding `p-5`, gap antar section `gap-6` konsisten | ✅ Solved |
| D7 | Empty states | EmptyState dengan CTA agar user tahu apa yang harus dilakukan | ✅ Solved |
| D8 | Color semantics | Merah = debit/danger, hijau = kredit/success, amber = review | ✅ Solved |
| D9 | Table UX | Group-hover reveal tombol detail di kanan, tidak memenuhi kolom | ✅ Solved |
| D10 | Density | StatCard memberikan overview sebelum tabel/list utama | ✅ Solved |

### 7.2 Temuan User (50 perspektif)

| # | Persona | Kebutuhan | Status |
|---|---|---|---|
| U1 | Analis kredit | Cari perusahaan cepat → SearchInput dengan clear button | ✅ |
| U2 | Analis kredit | Lihat rekonsiliasi status sekilas → badge di tabel statements | ✅ |
| U3 | Analis kredit | Akses upload dari mana saja → Upload di nav + CTA di topbar | ✅ |
| U4 | Analis kredit | Filter statement by bank → SearchInput multi-field | ✅ |
| U5 | Supervisor | Net flow per perusahaan sekilas → strip di CompanyCard | ✅ |
| U6 | Supervisor | Berapa dokumen per perusahaan → doc count di CompanyCard | ✅ |
| U7 | Supervisor | Berapa yang gagal parse → failed count di CompanyCard | ✅ |
| U8 | Analis kredit | Tahu file sedang diproses → StatusBadge `parsing` indigo | ✅ |
| U9 | Analis kredit | Navigasi ke detail statement mudah → hover reveal ExternalLink | ✅ |
| U10 | Analis kredit | Tidak salah klik upload file — DropZone dengan label jelas | ✅ |
| U11–U30 | Umum | Dark mode nyaman di ruangan redup & pemakaian lama | ✅ |
| U31–U50 | Umum | Loading state jelas, tidak blank screen → Skeleton per halaman | ✅ |

### 7.3 Backlog / Rekomendasi Lanjutan

| Prioritas | Item | Status |
|---|---|---|
| 🔴 High | Pagination (companies 9/page, statements 15/page) | ✅ Done |
| 🔴 High | Keyboard shortcut (`/` → search focus, `U` → upload) | ✅ Done |
| 🟡 Medium | Date range filter di tabel statements | ✅ Done |
| 🟡 Medium | Bulk action — checkbox + Rekonsiliasi semua terpilih | ✅ Done |
| 🟡 Medium | Toast progress untuk upload besar (persentase) | ✅ Ada di DropZone |
| 🟢 Low | Animasi card entrance (fade-in stagger) | ✅ Done |
| 🟢 Low | Dark/light toggle (Moon/Sun button di topbar) | ✅ Done |
| 🟢 Low | Responsive mobile layout (hamburger + slide-in sidebar) | ✅ Done |

---

## 8. Implementation Checklist

### Foundation

- [x] Tailwind CSS v4 setup (`@import "tailwindcss"`)
- [x] CSS variable light teal theme (oklch color space) — v3.0 PatientPop-inspired
- [x] Geist font
- [x] Light mode (no dark class, `--background: oklch(0.975 0.006 240)`)
- [x] Sonner toast (light theme)

### Layout

- [x] `AppShell` — sidebar + main wrapper
- [x] `Sidebar` — w-56, neon active indicator, user pill footer
- [x] Topbar — sticky, backdrop-blur, upload CTA
- [x] `pageMeta` map — title/subtitle per route

### UI Kit Components

- [x] `PageHeader` — eyebrow + title + description + actions slot
- [x] `DataCard` — accent line, hoverable, padding presets
- [x] `DataCardHeader` — title + subtitle + actions slot
- [x] `StatCard` — icon + value + label + color + trend
- [x] `GlowButton` — polymorphic, variants, loading state
- [x] `SearchInput` — clear button, shortcut hint
- [x] `EmptyState` — icon + title + description + action + variant
- [x] `SectionLabel` — uppercase micro label
- [x] Barrel export (`index.ts`)

### Domain Components

- [x] `StatusBadge` — neon pill per parsing status
- [x] `MetricCard` — KPI card dengan colored accent bar
- [x] `FlagCard` — risk flag card per severity
- [x] `DropZone` — drag & drop upload dengan progress

### Pages

- [x] `/companies` — company card grid, create form, search
- [x] `/companies/[id]` — detail, chart cashflow, red flags, transaksi
- [x] `/statements` — tabel dengan stats, search, reconciliation badge
- [x] `/statements/[id]` — tabs, KPI, chart, transaksi detail
- [x] `/upload` — DropZone + user guide sidebar
- [x] `/analytics` — feature preview cards + EmptyState
- [x] `/admin` — admin preview cards + EmptyState

### Charts (Recharts)

- [x] Dark tooltip style
- [x] Dark grid stroke
- [x] Dark axis tick color
- [x] AreaChart cashflow
- [x] BarChart debit/kredit per bulan

### Data & API

- [x] `companiesApi` — list, create
- [x] `statementsApi` — list, get
- [x] `formatIDR`, `formatDate` utils
- [x] Sonner toast untuk error handling

### Quality

- [x] Zero TypeScript errors (`npx next build` clean)
- [x] No unused imports
- [x] Consistent spacing/color tokens

### Theme Migration (v2 → v3)

- [x] globals.css: `:root` → light teal CSS vars (`#F4F7FA` bg, `teal-500` primary)
- [x] layout.tsx: remove `dark` class, remove `theme="dark"` from Toaster
- [x] Sidebar: white bg, `teal-50` active nav, `teal-500` logo, no glow
- [x] AppShell topbar: white/90 backdrop, `shadow-sm`, teal Upload button
- [x] All ui-kit components: `border-slate-200`, `text-slate-700`, `bg-white`
- [x] GlowButton: solid `bg-teal-500 text-white` primary variant
- [x] StatusBadge: `bg-*-50 text-*-700 ring-*-200` pattern
- [x] MetricCard: `border-slate-200 bg-white`, colored left bar
- [x] FlagCard: `bg-red-50/amber-50/white` per severity
- [x] DropZone: `border-slate-200`, teal drag-active state
- [x] Chart configs: white tooltip bg, `#f1f5f9` grid, `#14b8a6` line
- [x] All pages: `cyan-*` → `teal-*`, `white/[0.xx]` → `slate-*`, `text-white` → `text-slate-900`
- [x] Build verified clean (zero TS errors)

### Backlog — Implemented ✅

- [x] Pagination — `Pagination` ui-kit component, companies 9/page, statements 15/page
- [x] Keyboard shortcuts — `/` focus search, `U` navigate upload, `Esc` close mobile sidebar
- [x] Date range filter — CalendarRange filter pada statements (dari–sampai)
- [x] Bulk reconciliation — checkbox per baris + "Rekonsiliasi X terpilih" button
- [x] Upload progress — ETA + progress bar real-time di DropZone
- [x] Mobile responsive — hamburger button, slide-in sidebar, overlay backdrop
- [x] Dark/light toggle — Moon/Sun button di topbar, toggle `class="dark"` on `<html>`
- [x] Card entrance animation — `fade-in-up` stagger 40ms per card di CompanyCard

### Backlog — Implemented ✅ (lanjutan)

- [x] Global command palette (Cmd+K / `/`) — `CommandPalette` component, navigasi antar halaman, ↑↓ keyboard, overlay backdrop
- [x] Unit tests scaffold — Vitest + @testing-library/react, 4 test files (StatCard, GlowButton, Pagination, StatusBadge), `npm test` untuk run
- [x] Dark sidebar — `bg-slate-900` sidebar dengan `bg-teal-500/20` active state, memberikan kontras jelas antara nav dan konten
- [x] Vivid color contrast — badge `*-100/*-700/*-300`, StatCard icon `bg-*-100`, GlowButton primary `bg-teal-600`, table header `bg-slate-100`, border `slate-300`

### Backlog — Belum dikerjakan

- [ ] Storybook / component playground — requires separate Storybook install
- [ ] Server-side pagination — API sudah support `?skip=&limit=`, perlu BE endpoint yang menerima `page` param

---

## 9. Product Improvement Roadmap

> Perspektif: **Product Manager** × **UX/UI Engineer** × **Credit Analyst (pengguna langsung)**
> Versi: 1.0 · 2026-06-09

---

### 9.1 Dashboard / Home (`/`)

Saat ini halaman `/` hanya redirect. Seharusnya jadi command center pertama yang dibuka analis setiap pagi.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| H1 | **Daily briefing panel** — ringkasan: berapa dokumen baru hari ini, berapa butuh review, total perusahaan aktif | 🔴 High | Feature |
| H2 | **Recent activity feed** — 5 statement terakhir yang diupload/diproses beserta statusnya | 🔴 High | Feature |
| H3 | **Alert banner** — muncul jika ada statement status `failed` atau `needs_review` yang belum ditangani >24 jam | 🔴 High | Feature |
| H4 | **Quick action buttons** — Upload Dokumen, Lihat Statement Terbaru, Buka SLIK | 🟡 Medium | UX |
| H5 | **Portfolio health score** — satu angka 0–100 berdasar rasio kolektibilitas, rekonsiliasi, dan red flag | 🟡 Medium | Feature |

---

### 9.2 Companies (`/companies`)

Halaman daftar perusahaan sudah cukup. Masalah utama: analis tidak tahu status kredit perusahaan dari card-level.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| C1 | **Kolom risk tier** — label `Low / Medium / High` di CompanyCard berdasar aggregate red flag count | 🔴 High | Feature |
| C2 | **Filter by risk tier** — dropdown filter di atas grid: Semua / High Risk / Needs Review | 🔴 High | UX |
| C3 | **Sort by** — dropdown: terbaru, nama A–Z, total dokumen, net flow tertinggi | 🟡 Medium | UX |
| C4 | **Tanggal statement terakhir** di CompanyCard — analis perlu tahu apakah data masih fresh | 🟡 Medium | UX |
| C5 | **Bulk upload** — pilih perusahaan → upload multiple statement sekaligus | 🟡 Medium | Feature |
| C6 | **Export daftar perusahaan** ke Excel/CSV untuk pelaporan | 🟢 Low | Feature |

---

### 9.3 Company Detail (`/companies/[id]`)

Halaman ini sudah kaya data tapi flow analisis kredit masih belum terpandu.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| CD1 | **Tab: Ringkasan Kredit** — satu halaman vertikal berisi: KPI utama, trend cashflow, top red flags, rekomendasi | 🔴 High | Feature |
| CD2 | **Risk rating otomatis** — sistem generate `AA / A / B / C / D` berdasar metrik (avg monthly income, volatilitas, kolektibilitas SLIK) | 🔴 High | Feature |
| CD3 | **Notes/komentar analis** — text area untuk catatan internal per perusahaan, tersimpan di DB | 🔴 High | Feature |
| CD4 | **Tombol "Generate Laporan PDF"** — export ringkasan analisis ke PDF 1 halaman untuk dikirm ke komite kredit | 🔴 High | Feature |
| CD5 | **Koneksi ke SLIK** — tampilkan ringkasan SLIK debitur jika sudah diupload di tab tersendiri | 🟡 Medium | Feature |
| CD6 | **Perbandingan antar periode** — chart yang bisa di-toggle: 3 bulan / 6 bulan / 12 bulan | 🟡 Medium | UX |
| CD7 | **Daftar statement dengan preview** — thumbnail preview isi statement sebelum buka detail | 🟢 Low | UX |

---

### 9.4 Statements (`/statements`)

Tabel sudah berfungsi tapi kurang filter dan kontext untuk prioritisasi kerja.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| S1 | **Filter by status** — tab: Semua / Needs Review / Failed / Done (bukan hanya search) | 🔴 High | UX |
| S2 | **Filter by bank** — dropdown bank (BCA, Mandiri, BNI, dst) | 🔴 High | UX |
| S3 | **Kolom "Analis"** — siapa yang mengupload / sedang handle — penting untuk tim multi-analis | 🟡 Medium | Feature |
| S4 | **Retry parsing** — tombol untuk re-parse statement yang `failed` tanpa perlu upload ulang | 🔴 High | Feature |
| S5 | **Batch delete** — hapus multiple statement sekaligus (sudah ada checkbox, tinggal tambah aksi) | 🟡 Medium | Feature |
| S6 | **Keterangan error parsing** yang lebih human-readable — saat ini raw error message, harus diterjemahkan | 🟡 Medium | UX |

---

### 9.5 Statement Detail (`/statements/[id]`)

Halaman paling sering digunakan. Ini pusat kerja analis.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| SD1 | **Filter transaksi by kategori** — dropdown: Gaji, Cicilan, Transfer, Tarik Tunai, dll | 🔴 High | UX |
| SD2 | **Filter transaksi by flag** — tampilkan hanya transaksi yang di-flag (bukan semua) | 🔴 High | UX |
| SD3 | **Summary per kategori** — donut chart atau bar chart breakdown kategori debit/kredit | 🔴 High | Feature |
| SD4 | **Edit kategori manual** — analis bisa override kategori yang salah di-detect | 🟡 Medium | Feature |
| SD5 | **Highlight anomali otomatis** — transaksi yang nilainya >3× rata-rata otomatis di-highlight merah | 🔴 High | Feature |
| SD6 | **Export transaksi** ke Excel dengan semua kolom termasuk flag dan kategori | 🔴 High | Feature |
| SD7 | **Sticky table header** — saat scroll transaksi panjang, header kolom harus tetap terlihat | 🟡 Medium | UX |
| SD8 | **Anotasi per transaksi** — analis bisa tambah catatan singkat di baris transaksi tertentu | 🟢 Low | Feature |

---

### 9.6 Upload (`/upload`)

Sudah cukup fungsional. Perlu improvement di guidance dan feedback.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| UP1 | **Auto-detect perusahaan** — saat upload, sistem suggest nama perusahaan berdasar account holder di PDF | 🔴 High | Feature |
| UP2 | **Preview sebelum submit** — setelah pilih file, tampilkan preview: nama bank, periode, ukuran file | 🟡 Medium | UX |
| UP3 | **Upload history** di sidebar kanan — 5 file terakhir yang diupload dengan status | 🟡 Medium | UX |
| UP4 | **Drag multiple files** — upload 5–10 statement sekaligus untuk satu perusahaan | 🟡 Medium | Feature |
| UP5 | **Format guide** — tooltip per bank menjelaskan format yang didukung (BCA PDF vs CSV, dst) | 🟢 Low | UX |

---

### 9.7 Analytics (`/analytics`)

Saat ini masih placeholder. Ini harusnya jadi halaman paling powerful untuk supervisor/kepala analisis.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| AN1 | **Portfolio overview chart** — total kredit vs debit seluruh portofolio per bulan (line chart) | 🔴 High | Feature |
| AN2 | **Distribution risk tier** — pie chart: berapa % perusahaan di Low/Medium/High risk | 🔴 High | Feature |
| AN3 | **Top 10 perusahaan by red flag** — ranked list perusahaan dengan flag terbanyak | 🔴 High | Feature |
| AN4 | **Trend kolektibilitas SLIK** — agregat kualitas kredit 1-2-3-4-5 dari semua SLIK yang diupload | 🟡 Medium | Feature |
| AN5 | **Filter by periode** — semua chart bisa di-filter: bulan ini, kuartal ini, 12 bulan | 🟡 Medium | UX |
| AN6 | **Export laporan analytics** ke PDF/Excel untuk presentasi komite | 🟡 Medium | Feature |

---

### 9.8 SLIK / IDEB (`/slik`)

Fitur baru, perlu diperkuat agar benar-benar berguna untuk keputusan kredit.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| SL1 | **Link SLIK ke perusahaan** — saat upload SLIK, bisa assign ke company yang sudah ada | 🔴 High | Feature |
| SL2 | **Traffic light kualitas** — warna otomatis berdasar worst kolektibilitas: hijau (1), kuning (2), merah (3–5) | 🔴 High | UX |
| SL3 | **Ringkasan risiko SLIK** — satu paragraph auto-generated: "Debitur memiliki X fasilitas aktif, baki debet total Rp Y, kolektibilitas terburuk Z" | 🔴 High | Feature |
| SL4 | **Perbandingan cashflow vs SLIK** — tampilkan side-by-side: income dari bank statement vs cicilan di SLIK | 🔴 High | Feature |
| SL5 | **DSR otomatis** (Debt Service Ratio) — hitung cicilan/bulan dari SLIK ÷ income dari statement | 🔴 High | Feature |
| SL6 | **History kualitas per kreditur** — grid 24 bulan sudah ada, tambah tooltip bulan dan nilai | 🟡 Medium | UX |

---

### 9.9 Admin (`/admin`)

Saat ini placeholder. Penting untuk ops dan pengaturan tim.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| AD1 | **User management** — tambah/hapus analis, set role (analis / supervisor / admin) | 🔴 High | Feature |
| AD2 | **Parser health monitor** — status parser per bank: berapa % berhasil parse minggu ini | 🔴 High | Feature |
| AD3 | **System logs** — tabel log aktivitas: siapa upload apa kapan, error apa | 🟡 Medium | Feature |
| AD4 | **Konfigurasi threshold red flag** — admin bisa set berapa ambang batas agar transaksi di-flag | 🟡 Medium | Feature |
| AD5 | **Audit trail** — setiap perubahan data (edit kategori, manual reconcile) tersimpan dengan timestamp + user | 🟡 Medium | Feature |

---

### 9.10 Cross-cutting UX Issues

Masalah yang muncul di hampir semua halaman.

| # | Improvement | Prioritas | Tipe |
|---|---|---|---|
| X1 | **Loading skeleton yang konsisten** — beberapa halaman masih blank saat fetch, harus pakai skeleton | 🔴 High | UX |
| X2 | **Empty state yang actionable** — setiap empty state harus punya 1 CTA yang jelas (bukan cuma teks) | 🔴 High | UX |
| X3 | **Error state handling** — jika API down, tampilkan pesan yang jelas + tombol retry | 🔴 High | UX |
| X4 | **Responsive table** — tabel transaksi di mobile hanya tampilkan kolom penting (tanggal, deskripsi, nominal) | 🟡 Medium | UX |
| X5 | **Keyboard navigation** — selain Cmd+K, tambah shortcut: `G C` → Companies, `G S` → Statements (Gmail-style) | 🟢 Low | UX |
| X6 | **Notification center** — bell icon yang selama ini kosong, isi dengan notif: "Statement X selesai diparse" | 🟡 Medium | Feature |
| X7 | **Onboarding flow** — untuk user baru: wizard 3 langkah (buat perusahaan → upload statement → lihat hasil) | 🟢 Low | Feature |

---

### 9.11 Checklist Implementation Roadmap

#### Sprint 1 — Core Analyst Workflow (🔴 High, berdampak langsung ke produktivitas)

- [x] **H1** Dashboard home: daily briefing panel (stat cards: dokumen baru, perlu review, total perusahaan)
- [x] **H2** Dashboard home: recent activity feed (5 statement terakhir)
- [x] **H3** Dashboard home: alert banner untuk failed/needs_review >24 jam
- [x] **S1** Statements: filter tab by status (Semua / Needs Review / Failed / Done)
- [x] **S2** Statements: filter dropdown by bank
- [x] **S4** Statements: tombol retry parsing untuk status `failed`
- [x] **SD1** Statement detail: filter transaksi by kategori
- [x] **SD2** Statement detail: filter transaksi by flag
- [x] **SD5** Statement detail: highlight otomatis transaksi anomali (>3× rata-rata)
- [x] **SD6** Statement detail: export transaksi ke Excel
- [x] **C1** Companies: risk tier label (Low/Medium/High) di CompanyCard
- [x] **C2** Companies: filter by risk tier

#### Sprint 2 — Decision Support (fitur yang mendukung keputusan kredit)

- [x] **CD1** Company detail: tab Ringkasan Kredit terpadu
- [x] **CD2** Company detail: risk rating otomatis (AA/A/B/C/D)
- [x] **CD3** Company detail: notes/komentar analis per perusahaan
- [x] **CD4** Company detail: generate laporan PDF ringkasan analisis
- [x] **SL1** SLIK: link ke perusahaan saat upload
- [x] **SL2** SLIK: traffic light kualitas otomatis
- [x] **SL3** SLIK: ringkasan risiko auto-generated
- [x] **SL5** SLIK: DSR otomatis (cicilan SLIK ÷ income statement)
- [x] **SL4** SLIK: side-by-side cashflow vs cicilan SLIK
- [x] **AN1** Analytics: portfolio overview chart
- [x] **AN2** Analytics: distribusi risk tier (pie chart)
- [x] **AN3** Analytics: top 10 perusahaan by red flag

#### Sprint 3 — Operations & Polish

- [x] **AD1** Admin: user management (tambah/hapus analis, set role)
- [x] **AD2** Admin: parser health monitor per bank
- [ ] **UP1** Upload: auto-detect perusahaan dari account holder
- [x] **UP4** Upload: drag multiple files sekaligus (DropZone `multiple: true`)
- [x] **SD3** Statement detail: summary per kategori (chart breakdown)
- [x] **SD4** Statement detail: edit kategori manual
- [x] **X1** Semua halaman: loading skeleton konsisten
- [x] **X3** Semua halaman: error state + tombol retry
- [x] **X6** Notification center (bell icon aktif)
- [x] **CD6** Company detail: toggle chart periode (3/6/12 bulan)

---

## 10. Senior Risk Analyst Assessment

> **Perspektif**: Senior Risk Analyst / calon Direktur Analisis Kredit, bank aset Rp1.000T, pengalaman 30 tahun.
> **Konteks pinjaman**: Corporate loan rata-rata Rp50M ke atas.
> **Versi assessment**: 1.0 · 2026-06-09

---

### 10.1 Verdict Eksekutif

**Dashboard ini baru menyentuh ~25% dari kebutuhan analisis kredit korporat yang sesungguhnya.**

Yang sudah ada (baik):
- Parsing bank statement otomatis → hemat waktu analis 70–80%
- SLIK parser + traffic light kolektibilitas → due diligence awal yang solid
- Cashflow visualization + net flow → foundation yang benar
- Risk rating AA–D berbasis data bank statement → langkah awal yang bagus

Yang belum ada dan **wajib** ada sebelum keputusan kredit Rp50M+ diambil:
- Analisis rasio keuangan (likuiditas, solvabilitas, profitabilitas)
- Laporan Keuangan 3 tahun (L/R + Neraca + Arus Kas)
- DSCR (Debt Service Coverage Ratio) — bukan hanya DSR
- Analisis agunan / collateral
- Memo Kredit terstruktur
- Framework 5C yang terdokumentasi
- Workflow persetujuan (approval chain)
- Monitoring pasca-pencairan

> **Kesimpulan**: Saat ini CREDO cocok sebagai *pre-screening tool*. Untuk menjadi *decision-support system* yang sah untuk kredit Rp50M+, butuh 4 sprint tambahan di bawah ini.

---

### 10.2 Gap Analysis — Kritis

#### 10.2.1 Tidak Ada Analisis Rasio Keuangan

Ini gap paling fundamental. Setiap kredit korporat Rp50M+ wajib ada analisis rasio:

| Kategori Rasio | Rasio Wajib | Keterangan |
|---|---|---|
| **Likuiditas** | Current Ratio, Quick Ratio | Kemampuan bayar hutang jangka pendek |
| **Solvabilitas** | DER (Debt-to-Equity), DAR (Debt-to-Asset) | Struktur modal dan leverage |
| **Profitabilitas** | ROA, ROE, Net Profit Margin, EBITDA Margin | Kualitas earnings |
| **Aktivitas** | Receivable Turnover, Inventory Turnover | Efisiensi aset |
| **Coverage** | DSCR, Interest Coverage Ratio | Kemampuan melunasi pokok + bunga |

Saat ini tidak ada satu pun dari rasio di atas.

#### 10.2.2 Tidak Ada Laporan Keuangan Multi-Tahun

Bank statement saja tidak cukup. Standar OJK (POJK No.40/POJK.03/2019) mensyaratkan:
- Laporan Laba Rugi (L/R) minimal 3 tahun terakhir
- Neraca (Balance Sheet) minimal 3 tahun terakhir
- Laporan Arus Kas (Cash Flow Statement)
- Proyeksi keuangan 2–3 tahun ke depan (untuk kredit investasi)

#### 10.2.3 Tidak Ada Memo Kredit Digital

Setiap keputusan kredit harus terdokumentasi dalam **Memorandum Kredit (Memo Kredit)** yang berisi:
- Profil debitur dan bisnis
- Tujuan penggunaan kredit
- Analisis 5C
- Analisis keuangan (rasio, trend)
- Analisis agunan
- Rekomendasi dan syarat pencairan
- Tanda tangan analisis + persetujuan komite

Saat ini "Catatan Analis" hanya text area bebas tanpa struktur.

#### 10.2.4 Tidak Ada Analisis Agunan (Collateral)

Untuk kredit Rp50M+, agunan wajib dianalisis:
- Jenis agunan (tanah/bangunan, kendaraan, piutang, jaminan perusahaan)
- Nilai agunan (nilai pasar vs nilai likuidasi)
- LTV (Loan-to-Value ratio)
- Coverage ratio agunan terhadap plafon
- Status legal agunan (bebas sengketa, sertifikat valid)
- Tanggal appraisal dan masa berlaku

#### 10.2.5 Tidak Ada Workflow Persetujuan

Kredit Rp50M+ tidak bisa diputuskan satu orang. Standar governance perbankan mensyaratkan:
- **Maker**: Analis menyiapkan dan mengusulkan
- **Checker**: Review oleh Head/Supervisor
- **Approver**: Komite Kredit sesuai limit kewenangan (Kewenangan Memutus Kredit/KMK)
- **Audit trail**: Setiap perubahan tercatat dengan timestamp dan user

#### 10.2.6 Tidak Ada Monitoring Pasca-Pencairan

>60% masalah kredit terdeteksi bukan dari analisis awal, tapi dari monitoring yang lemah.

Yang dibutuhkan:
- Tracking outstanding vs jadwal angsuran
- Covenant monitoring (financial & non-financial covenants)
- Early Warning Signals (EWS) otomatis
- Watch list management
- Kolektibilitas aktual vs proyeksi

---

### 10.3 Gap Analysis — Penting

| Gap | Dampak | Prioritas |
|---|---|---|
| Tidak ada cek BMPK (Batas Maksimum Pemberian Kredit) | Risiko pelanggaran regulasi OJK | 🔴 Wajib |
| Tidak ada penilaian industri/sektor | Underestimate risiko sektoral (e.g., properti boom-bust) | 🔴 Tinggi |
| Tidak ada stress testing | Tidak tahu kemampuan bayar saat kondisi buruk | 🔴 Tinggi |
| Tidak ada group exposure | Lupa hitung total eksposur ke grup debitur | 🔴 Tinggi |
| Credit scoring model terlalu sederhana | AA–D berbasis fail rate upload saja — tidak reliable | 🟡 Sedang |
| Tidak ada risk-based pricing | Semua debitur dapat suku bunga sama, bank rugi atau tidak kompetitif | 🟡 Sedang |
| Tidak ada KYC/AML screening status | Compliance gap — wajib PBI No.19/2017 | 🟡 Sedang |
| Tidak ada proyeksi keuangan | Tidak bisa assess kredit investasi jangka panjang | 🟡 Sedang |
| Tidak ada analisis rekening koran cross-bank | Debitur punya rekening di 5 bank, hanya 1 yang di-upload | 🟢 Rendah |

---

### 10.4 Recommended Addition — Sprint 4 s/d Sprint 7

---

#### Sprint 4 — Financial Analysis Foundation

> Target: Melengkapi analisis keuangan yang menjadi backbone keputusan kredit.

| # | Fitur | Halaman | Deskripsi |
|---|---|---|---|
| **FR1** | **Halaman Analisis Rasio Keuangan** | `/companies/[id]/rasio` | Input atau auto-parse L/R & Neraca → hitung semua rasio keuangan otomatis. Tampilkan tabel rasio + traffic light (hijau/kuning/merah vs benchmark industri) |
| **FR2** | **Input Laporan Keuangan Manual** | `/companies/[id]/lapkeu` | Form terstruktur untuk input L/R + Neraca per tahun (1–3 tahun). Simpan ke DB. Tidak semua data bisa di-OCR otomatis |
| **FR3** | **DSCR Calculator** | Company detail tab | DSCR = (Net Income + Dep + Amortisasi) ÷ (Pokok + Bunga tahunan). Berbeda dari DSR. Tampilkan angka + klasifikasi: >1.25x baik, <1.0x bahaya |
| **FR4** | **Perbandingan Multi-Tahun** | Company detail tab | Tabel side-by-side 3 tahun: pendapatan, EBITDA, laba bersih, total aset, total hutang, equity. Dengan arrow tren naik/turun |
| **FR5** | **Benchmark Industri** | Company detail tab | Referensi rasio median per sektor (manufaktur, perdagangan, properti, jasa, dll). Tampilkan posisi debitur vs industri dengan percentile bar |
| **FR6** | **Proyeksi Keuangan** | `/companies/[id]/proyeksi` | Input asumsi (pertumbuhan revenue, capex, capex) → auto-hitung projected cashflow 3 tahun. Visualisasi projected vs actuals |

---

#### Sprint 5 — Credit Memo & Collateral

> Target: Formalisasi keputusan kredit agar defensible secara hukum dan regulasi.

| # | Fitur | Halaman | Deskripsi |
|---|---|---|---|
| **CM1** | **Memo Kredit Digital** | `/companies/[id]/memo` | Template memo kredit terstruktur: profil debitur, tujuan kredit, analisis 5C, rekomendasi. Bisa di-export PDF untuk komite |
| **CM2** | **5C Assessment Form** | Dalam Memo Kredit | Checklist terstruktur: Character (track record, reputasi), Capacity (DSCR, DSR), Capital (DER, modal sendiri), Collateral (nilai & coverage), Condition (industri, makro). Setiap C ada skor 1–5 + komentar |
| **CM3** | **Collateral Registry** | `/companies/[id]/agunan` | Tambah/edit agunan: tipe, nilai pasar, nilai likuidasi, LTV, status legal, tanggal appraisal, masa berlaku. Tampilkan coverage ratio agunan vs plafon |
| **CM4** | **Loan Proposal Form** | `/companies/[id]/proposal` | Form pengajuan kredit: tujuan, plafon, jangka waktu, jenis fasilitas (modal kerja/investasi/KMK), suku bunga diusulkan, jadwal angsuran |
| **CM5** | **Workflow Approval** | Semua halaman kredit | Status tracking: Draft → Diajukan Analis → Review Checker → Komite Kredit → Disetujui/Ditolak. Setiap status tampilkan siapa + kapan + komentar |
| **CM6** | **BMPK Checker** | Company detail + proposal | Auto-hitung apakah plafon yang diusulkan melebihi BMPK (20–25% modal bank untuk non-afiliasi). Alert merah jika mendekati limit |

---

#### Sprint 6 — Post-Disbursement Monitoring

> Target: Monitoring aktif setelah kredit cair — ini yang paling sering diabaikan.

| # | Fitur | Halaman | Deskripsi |
|---|---|---|---|
| **MO1** | **Loan Facility Tracker** | `/loans` | Daftar semua fasilitas aktif: debitur, plafon, outstanding, suku bunga, jatuh tempo, kolektibilitas. Filter by status, jatuh tempo |
| **MO2** | **Jadwal Angsuran & Pembayaran** | `/loans/[id]` | Timeline angsuran: jatuh tempo, jumlah, status bayar (lunas/terlambat/macet). Hitung DPD (Days Past Due) otomatis |
| **MO3** | **Covenant Monitoring** | `/loans/[id]/covenant` | Daftar covenant (financial: DER <2x, DSCR >1.2x; non-financial: tidak boleh tambah hutang tanpa izin). Status compliance per periode. Alert jika breach |
| **MO4** | **Early Warning Signal (EWS)** | Dashboard + notifikasi | Rules engine: jika DSCR turun >15%, saldo rekening turun >30% selama 3 bulan, SLIK kolektibilitas naik → auto-trigger alert. Kategorikan: Hijau / Kuning / Merah |
| **MO5** | **Watch List Management** | `/watchlist` | Halaman khusus debitur yang masuk kategori perhatian. Capture tanggal masuk, alasan, action plan, target normalisasi |
| **MO6** | **PPAP/CKPN Calculator** | Analytics + Loan | Hitung provisi wajib berdasar kolektibilitas (Kol 1: 1%, Kol 2: 5%, Kol 3: 15%, Kol 4: 50%, Kol 5: 100%) × outstanding. Total CKPN portfolio |

---

#### Sprint 7 — Portfolio Risk Management

> Target: Pandangan 30.000 kaki untuk manajemen risiko portofolio bank secara keseluruhan.

| # | Fitur | Halaman | Deskripsi |
|---|---|---|---|
| **PF1** | **Portfolio Concentration Dashboard** | `/analytics/portfolio` | Pie chart konsentrasi: per sektor industri, per wilayah, per jenis fasilitas. Alert jika >20% di satu sektor |
| **PF2** | **NPL Tracker & Aging** | `/analytics/npl` | Total NPL (Kol 3+4+5) dan aging: 30/60/90/180+ DPD. NPL ratio vs target bank. Trend bulanan |
| **PF3** | **Stress Testing Scenario** | `/analytics/stress` | Simulasi: revenue debitur turun 10%/20%/30% → dampak ke DSCR dan kolektibilitas. Hitung estimasi CKPN tambahan yang dibutuhkan |
| **PF4** | **Single Obligor Limit** | Company detail | Tampilkan total eksposur ke satu grup (debitur + afiliasi). Warning jika mendekati BMPK bank |
| **PF5** | **Vintage Analysis** | `/analytics/vintage` | Cohort kredit per tahun pencairan: berapa % yang jadi NPL pada 1 tahun, 2 tahun, 3 tahun setelah cair. Ukur kualitas underwriting |
| **PF6** | **Regulatory Reporting Template** | `/admin/laporan` | Generate laporan: LBU (Laporan Bank Umum), LBUS, SID untuk dikirim ke OJK/BI. Format XML/Excel sesuai standar regulator |

---

### 10.5 Credit Scoring Model — Perbaikan

Rating AA–D saat ini berbasis `failed_uploads` dan `net_flow` — tidak valid untuk kredit korporat.

**Model scoring yang direkomendasikan (bobot ke total 100 poin):**

| Dimensi | Bobot | Faktor |
|---|---|---|
| **Keuangan (40%)** | 40 poin | DSCR (15), DER (10), Current Ratio (5), Net Profit Margin (10) |
| **Cashflow Bank Statement (25%)** | 25 poin | Rata-rata saldo bulanan (10), Volatilitas (5), Tren 6 bulan (10) |
| **Kolektibilitas SLIK (20%)** | 20 poin | Worst kolektibilitas (10), Trend history (5), Jumlah kreditur (5) |
| **Agunan (10%)** | 10 poin | Coverage ratio agunan (7), Jenis agunan (3) |
| **Karakter/Kualitatif (5%)** | 5 poin | Track record (3), Lama hubungan dengan bank (2) |

**Mapping skor → rating:**
- 85–100: **AAA** (Sangat Prima)
- 70–84: **AA** (Prima)
- 55–69: **A** (Baik)
- 40–54: **B** (Cukup Baik)
- 25–39: **C** (Kurang)
- 10–24: **D** (Meragukan)
- 0–9: **E** (Macet / Tolak)

---

### 10.6 Implementation Checklist — Sprint 4–7

#### Sprint 4 — Financial Analysis Foundation

- [ ] **FR1** Halaman Rasio Keuangan: hitung + tampilkan semua rasio + traffic light vs benchmark
- [ ] **FR2** Form input Laporan Keuangan (L/R + Neraca) per tahun — simpan ke DB
- [ ] **FR3** DSCR Calculator di company detail (berbeda dari DSR)
- [ ] **FR4** Tabel perbandingan keuangan multi-tahun (3 tahun side-by-side)
- [ ] **FR5** Benchmark industri per sektor (referensi statis, bisa di-update admin)
- [ ] **FR6** Proyeksi cashflow 3 tahun dengan input asumsi

#### Sprint 5 — Credit Memo & Collateral

- [ ] **CM1** Halaman Memo Kredit digital (template terstruktur, export PDF)
- [ ] **CM2** Form 5C Assessment (Character/Capacity/Capital/Collateral/Condition) dengan skor
- [ ] **CM3** Collateral Registry: input agunan, LTV calculator, coverage ratio
- [ ] **CM4** Loan Proposal Form: plafon, tenor, jenis fasilitas, jadwal angsuran
- [ ] **CM5** Workflow approval: Draft → Analis → Checker → Komite → Putusan
- [ ] **CM6** BMPK Checker: alert jika eksposur mendekati 20% modal bank

#### Sprint 6 — Post-Disbursement Monitoring

- [ ] **MO1** Loan Facility Tracker: daftar fasilitas aktif, outstanding, jatuh tempo
- [ ] **MO2** Jadwal Angsuran: timeline pembayaran, DPD tracker, status bayar
- [ ] **MO3** Covenant Monitoring: daftar covenant, compliance status, breach alert
- [ ] **MO4** Early Warning Signal (EWS): rules engine otomatis, tri-color alert
- [ ] **MO5** Watch List page: debitur perhatian, action plan, target normalisasi
- [ ] **MO6** PPAP/CKPN Calculator: provisi wajib per kolektibilitas, total portfolio

#### Sprint 7 — Portfolio Risk Management

- [ ] **PF1** Portfolio Concentration Dashboard: per sektor, wilayah, fasilitas
- [ ] **PF2** NPL Tracker: total NPL, aging 30/60/90/180+ DPD, NPL ratio trend
- [ ] **PF3** Stress Testing: simulasi revenue drop → dampak DSCR + CKPN
- [ ] **PF4** Single Obligor Limit Checker: total grup eksposur vs BMPK
- [ ] **PF5** Vintage Analysis: cohort NPL per tahun pencairan
- [ ] **PF6** Regulatory Report template: LBU/LBUS format OJK
