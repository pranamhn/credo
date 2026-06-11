# CREDO — Sidebar & Navigation Plan
> Perspektif: Credit Risk Professional (Risk Officer / Credit Analyst)
> Prinsip: sidebar mencerminkan **workflow kredit**, bukan struktur teknis aplikasi

---

## Sidebar Baru — Struktur Lengkap

```
CREDO
│
├── UTAMA
│   ├── Dashboard          /                   → briefing harian
│   └── Insights           /analytics          → portfolio analytics
│
├── DEBITUR
│   ├── Portfolio Debitur  /companies          → daftar semua nasabah/debitur
│   ├── Fasilitas Kredit   /loans              → monitoring fasilitas & kolektibilitas
│   └── Credit Memo        /memo               → agregasi semua memo kredit
│
├── ANALISIS
│   ├── Bank Statement     /statements         → parsing & analisis rekening koran
│   ├── iDEB Parser        /idebt-parser       → analisis data SLIK BI
│   └── Upload Dokumen     /upload             → upload file baru
│
├── MONITORING
│   ├── Watch List         /watchlist          → EWS debitur berisiko (kuning/merah)
│   └── NPL Tracker        /npl                → monitoring NPL & kolektibilitas
│
└── PENGATURAN
    └── Pengaturan         /admin
```

---

## Alur Kerja Ideal (Workflow Credit Risk)

```
1. ONBOARDING DEBITUR
   /companies (buat profil) → /upload (upload dok) → /statements (parse)

2. ANALISIS KREDIT
   /statements/[id] (analisis cashflow) → /idebt-parser (cek SLIK)
   → /companies/[id] (credit summary) → /memo (tulis credit memo)

3. MONITORING RUTIN
   /insights (portfolio overview) → /watchlist (EWS) → /npl (kolektibilitas)

4. PELAPORAN
   /insights (export CSV) → /npl (NPL report)
```

---

## Todo Checklist

### Fase 1 — Sidebar Reorganisasi ✅ SELESAI
- [x] Ubah section "Management" → "Debitur"
- [x] Ubah section "Monitoring" → "Monitoring" (tambah NPL Tracker)
- [x] Tambah section "Analisis" dengan: Bank Statement, iDEB Parser, Upload Dokumen
- [x] Pindahkan iDEB Parser dari Debitur → Analisis
- [x] Tambah "Upload Dokumen" ke sidebar (href: /upload)
- [x] Tambah "Credit Memo" ke sidebar Debitur (href: /memo)
- [x] Tambah "NPL Tracker" ke sidebar Monitoring (href: /npl)
- [x] Rename "Documents" → "Bank Statement" di sidebar
- [x] AppShell `ROUTE_LABELS`: tambah `memo`, `npl`, update semua label baru

### Fase 2 — Halaman Baru: Credit Memo Agregasi (`/memo`) ✅ SELESAI
- [x] Buat `app/memo/page.tsx`
- [x] Ambil data: companiesApi.list() + localData.getMemo(id) per perusahaan
- [x] KPI strip: Total Memo · Disetujui · Ditolak · Avg 5C Score
- [x] Tabel: Perusahaan · Fasilitas · Plafon · Analis · 5C Score · Status · Update
- [x] Filter status: Draft / Diajukan / Review / Komite / Disetujui / Ditolak
- [x] Search: nama perusahaan, analis, jenis fasilitas
- [x] Link ke `/companies/[id]/memo` via row action
- [x] Tambahkan ke `ROUTE_LABELS` di AppShell (sudah di Fase 1)

### Fase 3 — Halaman Baru: NPL Tracker (`/npl`) ✅ SELESAI
- [x] Buat `app/npl/page.tsx`
- [x] KPI strip: NPL Ratio · Total NPL · CKPN Required · DPK count
- [x] Distribusi kolektibilitas dengan horizontal progress bar (Kolk 1–5)
- [x] Tabel debitur NPL (kolk 3–5), sorted kolk 5 dulu, lalu outstanding
- [x] CKPN estimate per row (15% kolk3, 50% kolk4, 100% kolk5)
- [x] Link ke `/loans/[id]` dari tabel
- [x] Tambahkan ke `ROUTE_LABELS` di AppShell (sudah di Fase 1)

### Fase 4 — Update Halaman Existing ✅ SELESAI
- [x] `/companies` — PageHeader sudah di-update (sebelumnya)
- [x] `/loans` — KPI strip sudah ada (Total Outstanding, NPL Ratio, CKPN)
- [x] `/watchlist` — tambah banner link ke NPL Tracker jika ada debitur kolk ≥ 3 yang belum di watchlist
- [x] AppShell `ROUTE_LABELS`: semua label baru sudah ditambahkan di Fase 1

### Fase 5 — QA & Build ✅ SELESAI
- [x] `npx next build` — zero TypeScript error, zero warnings
- [x] Route `/memo` dan `/npl` ter-compile sebagai static pages
- [x] Semua route baru bisa diakses dari sidebar (Credit Memo, NPL Tracker)
- [x] Breadcrumb labels sudah benar via ROUTE_LABELS di AppShell

---

## Referensi Terminologi Industri

| Term | Definisi |
|---|---|
| Kolektibilitas (Kolk) | Klasifikasi kualitas kredit 1–5 per aturan OJK |
| NPL | Non-Performing Loan — kredit kolk 3, 4, 5 |
| DPK | Dalam Perhatian Khusus — kolk 2 |
| CKPN | Cadangan Kerugian Penurunan Nilai (loan loss provision) |
| BMPK | Batas Maksimum Pemberian Kredit |
| EWS | Early Warning System — sistem deteksi dini kredit bermasalah |
| Credit Memo | Memorandum kredit — dokumen rekomendasi persetujuan kredit |
| SLIK / iDEB | Sistem Layanan Informasi Keuangan — data kredit dari OJK/BI |
