# 📊 Credo Dashboard — Complete Improvement Plan

> **Prepared by:** AI Analyst | **Date:** 11 June 2026  
> **Scope:** Full-stack improvement — dashboard, company detail, risk monitoring, portfolio management, parser fixes, UI cleanup

---

## 🏗️ Current Architecture Overview

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, Recharts, Axios, Lucide Icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL, pdfplumber, Celery + Redis |
| Parsers | pdfplumber (PDF), 20+ bank adapters + LLM fallback (Claude), 9 document type parsers |

### Pages & Features
| Page | Route | Key Features |
|------|-------|-------------|
| Dashboard | `/` | KPI strip (4 cards), Health Score gauge, Risk Distribution donut, Financial Summary bars, Things To Do, Activity Feed |
| Analytics | `/analytics` | Upload/Parsing trends, Net Flow ranking, Risk tier table, Parsing status distribution, Portfolio analysis, Stress test |
| Companies | `/companies` | Kanban/List view, Risk filter, Search, Create company |
| Company Detail | `/companies/[id]` | Credit Summary, Profile, Documents, Trend Analysis tabs |
| Documents | `/documents` | 8-type tab filter, KPI strip, Search, CSV export, Bulk actions, Pagination |
| Document Detail | `/documents/[id]` | Transaction table (inline edit), 7 red flag cards, Charts, Category breakdown, XLSX/JSON export |
| Upload | `/upload` | 8 document types, Drag-drop, Progress bar, Context-aware next steps |
| Watchlist | `/watchlist` | EWS tier management, Action plans, Overdue tracking, NPL cross-reference |
| NPL Tracker | `/npl` | Kolektibilitas distribution, CKPN estimation, Debtor table, Facility links |
| Loans | `/loans` | Portfolio KPIs, Kolektibilitas filter, Full facility table, Demo loan |
| Credit Memo | `/memo` | Per-company memo list, Status filter, Analyst/Checker info |
| iDEB Parser | `/idebt-parser` | SLIK/Click/CBI PDF upload, Parsed facility tables, Company assignment |
| Admin | `/admin` | Users (mock CRUD), Parser Health (per-bank stats), Approval Templates |

### Credit Scoring Model (100 points)
| Dimension | Max | Key Factors |
|-----------|-----|-------------|
| Keuangan (Financial) | 40 | Reconciliation status, fail rate, net ratio |
| Cashflow Bank Statement | 25 | Net flow, net-to-credit ratio |
| Kolektibilitas SLIK + CBI | 20 | Worst collectibility, number of crediturs |
| Agunan (Collateral) | 10 | Liquidation value / loan amount coverage |
| Karakter (Qualitative) | 5 | Upload fail rate |

### Red Flag Engine (7 types)
| Flag | Severity | Method |
|------|----------|--------|
| Judol (Gambling) | High | Keyword matching |
| Pinjol (Loan Stacking) | High/Medium | Keyword + pattern |
| Passthrough/Kiting | High | >=85% credit exits within 3 days |
| Rejected Transactions | Medium | Keyword matching |
| Negative Balance | High | Balance < 0 |
| Large Inflow Spike | Medium | Credit >= 3x avg monthly income |
| Income Inconsistency | Low | Salary variance >30% |

---

## ✅ Bug Fixes & Cleanup (Completed — 11 June 2026)

### Backend Parser Fixes
| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `operating_profit` = revenue | Regex `operating\s+revenue` dan `pendapatan\s+operasional` tertangkap sebagai operating_profit | Hapus pattern revenue dari regex + fallback: `gross_profit - opex` |
| 2 | `non_operating` = income only | `next()` ambil match pertama "Total OTHER INCOME and EXPENSES" (sisi income saja), bukan net | Ambil match terakhir (net: income - expenses) |
| 3 | Python cache stal | `__pycache__` tidak direfresh saat restart | Hapus `__pycache__` + restart server |

**Corrected values for PT Rasa Aksata Nusantara:**

| Metric | 2026 (5 bln) | 2025 (12 bln) | Annualized | Growth |
|--------|-------------|--------------|------------|--------|
| Revenue | 7.162.885.802 | 11.025.286.847 | — | — |
| Operating Profit | 702.391.903 | 2.269.844.584 | 1.685.740.567 | -25.73% |
| Other Income/Expenses | -88.779.803 | -23.086.435 | -213.071.527 | -822.93% |

### Frontend Fixes
| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 4 | Company page gagal load | `clickApi.list()` return 404 → `Promise.all` gagal total | Pisah fetching: critical data pakai `Promise.all`, non-critical pakai `Promise.allSettled` |
| 5 | Label date terlalu panjang "Y-1 FY 2025 (2025-01–2025-12)" | Format label verbose | Simplify: langsung date range/period |
| 6 | DSCR Total Cicilan Existing = 0 | Debt entries kosong, tidak ada fallback | Fallback ke `slikDerived.estCicilanPerBulan` |
| 7 | Negative value tidak merah di tabel PnL | CSS conflict: `text-slate-700 text-red-600` dua-duanya applied | Kondisional: negative → hanya `text-red-600` |
| 8 | Section Tanda Tangan double di ProfileTab | 2 section mirip: "Tanda Tangan Ringkasan Kredit" + "Template Approver Default" | Hapus section pertama (nama+date input); keep Template Approver |
| 9 | Tanda Tangan CreditSummaryTab pakai profile fields (kosong) | Fields tidak bisa diisi setelah section ProfileTab dihapus | Ganti pakai data `approvers` global |
| 10 | Upload/Analytics buttons di dashboard | — | Hapus (kept only CloudUpload for empty state) |

---

## 📋 Improvement Plan

### 🔴 PHASE 1 — Quick Wins (high impact, low effort)

| # | Task | Priority | Effort | Description |
|---|------|----------|--------|-------------|
| 1.1 | **Financial Ratio Cards** | 🔴 Critical | S | Grid 8 rasio di CreditSummaryTab. Data dari `derivedRatios` sudah tersedia: Gross Margin, EBITDA Margin, Net Margin, DER, DAR, ROE, ROA. Tambah Current Ratio dari BS. Threshold color (hijau/kuning/merah). |
| 1.2 | **Interest Coverage Ratio (ICR)** | 🔴 Critical | M | `ICR = EBITDA / Interest Expense`. Backend: extract interest dari kategori bank_fees/admin_fees. Frontend: tampil di DSCR section. |
| 1.3 | **Sortable Columns di /documents** | 🟡 High | S | Tambah sorting by date, balance, confidence, status. |
| 1.4 | **Date Range Filter di /documents** | 🟡 High | S | Filter from/to periode. |
| 1.5 | **Dashboard Date Filter** | 🟡 High | S | Filter 3/6/12 bulan di dashboard utama (reuse logic analytics). |
| 1.6 | **Cash Flow Statement Tab** | 🟡 High | M | Tab baru di CreditSummaryTab: Operating/Investing/Financing breakdown dari parsed cash flow. |
| 1.7 | **P&L Trend Sparkline** | 🟢 Medium | S | Mini line chart revenue/net income 12 bulan di company detail. |

### 🔴 PHASE 2 — Risk Monitoring & Proactive Alerts

| # | Task | Priority | Effort | Description |
|---|------|----------|--------|-------------|
| 2.1 | **EWS Dashboard Widget** | 🔴 Critical | S | Widget di dashboard: count kuning/merah + top 5 perusahaan berisiko (nama, tier, reason, days in EWS). Click → /watchlist. |
| 2.2 | **Covenant Monitoring Engine** | 🔴 Critical | L | Backend: model covenant per facility (type, threshold, operator). Frontend: tab "Covenant" di loan detail — status (✅/⚠️/🔴), historical trend, breach alert di Things To Do. |
| 2.3 | **DSCR Alert Notification** | 🔴 Critical | M | Notifikasi otomatis saat DSCR < 1.0x atau DSR > 70%. Tampil di Things To Do dashboard. |
| 2.4 | **NPL Migration Tracking** | 🟡 High | M | Visualisasi upgrade/downgrade kolektibilitas per periode di /npl. Sankey atau waterfall chart. |
| 2.5 | **Watchlist → Dashboard** | 🟡 High | S | Overdue action plans muncul di Things To Do dashboard. |
| 2.6 | **Monthly Portfolio Health Report** | 🟢 Medium | L | Auto email/weekly digest: top risks, new watchlist, parsing failures, portfolio stats. |

### 🔴 PHASE 3 — Portfolio Analytics & Regulatory

| # | Task | Priority | Effort | Description |
|---|------|----------|--------|-------------|
| 3.1 | **Concentration Risk Dashboard** | 🔴 Critical | L | Backend: aggregate exposure per KBLI, per provinsi, per kelompok debitur. Frontend: section di /analytics — bar chart sektor, geographic distribution, HHI index. |
| 3.2 | **BMPK Monitoring** | 🔴 Critical | M | Tracking Batas Maksimum Pemberian Kredit (>25% modal). Alert otomatis di dashboard. |
| 3.3 | **Peer Comparison** | 🟡 High | L | Bandingkan rasio keuangan debitur vs rata-rata industri sejenis. Perlu data benchmark per KBLI. |
| 3.4 | **Multi-Company View** | 🟡 High | M | Side-by-side comparison 2-3 perusahaan dalam satu layar. |
| 3.5 | **CAR/LDR/NIM Tracking** | 🟢 Medium | M | Regulatory ratios untuk portfolio perbankan. |
| 3.6 | **Stress Test Configurator** | 🟢 Medium | M | User-defined scenarios (bukan hardcoded -10%/-20%/-30%). |

### 🔴 PHASE 4 — Report Generation & Workflow

| # | Task | Priority | Effort | Description |
|---|------|----------|--------|-------------|
| 4.1 | **Professional PDF Export** | 🔴 Critical | L | Backend: `/api/companies/{id}/export/pdf` (WeasyPrint/ReportLab). Template: cover page, financial summary, DSCR, SLIK, collateral, scoring, recommendation. Ganti `window.print()`. |
| 4.2 | **Excel Portfolio Export** | 🟡 High | M | Export seluruh portfolio ke Excel format BI reporting. |
| 4.3 | **Approval Workflow UI** | 🟡 High | L | Tombol Approve/Reject di memo + komentar + notifikasi role berikutnya. |
| 4.4 | **Audit Trail Viewer** | 🟡 High | M | Halaman `/audit`: semua perubahan (upload, edit, delete, reassign). Backend `AuditLog` model sudah ada. |
| 4.5 | **Role-Based Access Control** | 🟢 Medium | L | Login page + RBAC (Admin/Analis Senior/Analis/Viewer). |
| 4.6 | **Widget Customization** | 🟢 Medium | M | Show/hide/reorder widget di dashboard per user. |

### 🔴 PHASE 5 — Advanced Analytics (Future)

| # | Task | Priority | Effort | Description |
|---|------|----------|--------|-------------|
| 5.1 | **Predictive Default Model** | 🟢 Medium | XL | ML probability of default (SLIK + cashflow + financial ratios). |
| 5.2 | **Cash Flow Projection** | 🟢 Medium | L | Forward-looking 12 bulan projection berdasarkan tren historis. |
| 5.3 | **Automated Credit Scoring** | 🟢 Medium | L | Refine scoring model — bobot dikalibrasi dari data historis performa kredit. |
| 5.4 | **Fraud Detection Patterns** | 🟢 Medium | XL | Deteksi structuring, round-tripping, layering transaksi. |
| 5.5 | **API Integration Hub** | 🟢 Medium | XL | Real-time: BI Checking, AHU Online, Dukcapil, Pajak. |

---

## 📝 Detailed Specs (Selected Tasks)

### 1.1 Financial Ratio Cards

**Current:** `derivedRatios` di `useFinancialComparisons.ts` sudah menghitung 8 rasio tapi tidak dirender di UI.

**Implementation:**
```tsx
// Di bawah P&L/BS comparison di CreditSummaryTab
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {[
    { label: "Gross Margin", value: derivedRatios.grossMargin, fmt: "pct", ok: 20, warn: 10 },
    { label: "EBITDA Margin", value: derivedRatios.ebitdaMargin, fmt: "pct", ok: 15, warn: 8 },
    { label: "Net Margin", value: derivedRatios.netMargin, fmt: "pct", ok: 10, warn: 5 },
    { label: "DER", value: derivedRatios.der, fmt: "x", ok: 3, warn: 5 },
    { label: "DAR", value: derivedRatios.dar, fmt: "pct", ok: 50, warn: 70 },
    { label: "ROE", value: derivedRatios.roe, fmt: "pct", ok: 15, warn: 8 },
    { label: "ROA", value: derivedRatios.roa, fmt: "pct", ok: 5, warn: 2 },
    { label: "Current Ratio", value: currentRatio, fmt: "x", ok: 1.5, warn: 1.0 },
  ].map(ratio => <RatioCard key={ratio.label} {...ratio} />)}
</div>
```

### 2.2 Covenant Monitoring Engine

**Data Model (backend):**
```python
class Covenant(Base):
    id: UUID
    facility_id: UUID -> LoanFacility
    covenant_type: str  # "DSCR", "CURRENT_RATIO", "DER"
    threshold: float
    operator: str  # ">=", "<="
    period: str  # "quarterly", "annually"
```

**UI State:**
- ✅ Compliant (green) — actual value meets threshold
- ⚠️ Watch (amber) — within 10% of threshold
- 🔴 Breached (red) — actual value violates threshold

### 3.1 Concentration Risk

**Metrics:**
- **HHI (Herfindahl-Hirschman Index):** Σ(market_share²) × 10,000
  - <1,000: Tidak terkonsentrasi
  - 1,000-1,800: Cukup terkonsentrasi
  - >1,800: Sangat terkonsentrasi
- **Top 10 KBLI exposure** (bar chart)
- **Geographic distribution** (per provinsi)
- **Related party exposure** (pie chart)

### 4.1 Professional PDF Export

**Sections:**
1. Cover: Logo CREDO, company name, date, analyst name
2. Executive Summary: Loan purpose, amount, tenor, facility type
3. Financial Analysis: P&L and BS comparison tables + ratios
4. DSCR Analysis: Calculation breakdown, sensitivity table (±10%)
5. SLIK/CBI Insights: Worst collectibility, DSR, facility summary
6. Collateral Summary: Type, value, coverage ratio
7. Credit Scoring: 5C breakdown with scores and notes
8. Recommendation: Approved/Rejected with conditions

---

## ✅ Full Checklist (Todos)

### Phase 1
- [ ] 1.1 Financial Ratio Cards
- [ ] 1.2 Interest Coverage Ratio (ICR)
- [ ] 1.3 Sortable Columns di /documents
- [ ] 1.4 Date Range Filter di /documents
- [ ] 1.5 Dashboard Date Filter
- [ ] 1.6 Cash Flow Statement Tab
- [ ] 1.7 P&L Trend Sparkline

### Phase 2
- [ ] 2.1 EWS Dashboard Widget
- [ ] 2.2 Covenant Monitoring Engine
- [ ] 2.3 DSCR Alert Notification
- [ ] 2.4 NPL Migration Tracking
- [ ] 2.5 Watchlist → Dashboard Integration
- [ ] 2.6 Monthly Portfolio Health Report

### Phase 3
- [ ] 3.1 Concentration Risk Dashboard
- [ ] 3.2 BMPK Monitoring
- [ ] 3.3 Peer Comparison
- [ ] 3.4 Multi-Company View
- [ ] 3.5 CAR/LDR/NIM Tracking
- [ ] 3.6 Stress Test Configurator

### Phase 4
- [ ] 4.1 Professional PDF Export
- [ ] 4.2 Excel Portfolio Export
- [ ] 4.3 Approval Workflow UI
- [ ] 4.4 Audit Trail Viewer
- [ ] 4.5 Role-Based Access Control
- [ ] 4.6 Widget Customization

### Phase 5
- [ ] 5.1 Predictive Default Model
- [ ] 5.2 Cash Flow Projection
- [ ] 5.3 Automated Credit Scoring
- [ ] 5.4 Fraud Detection Patterns
- [ ] 5.5 API Integration Hub

### Bug Fixes (Completed)
- [x] `operating_profit` = revenue → `gross_profit - opex`
- [x] `non_operating` = income only → match terakhir (net)
- [x] `clickApi.list()` 404 → `Promise.allSettled`
- [x] Label "Y-1 FY 2025" verbose → date range/period only
- [x] DSCR Cicilan = 0 → fallback SLIK data
- [x] Negative value tidak merah → fix CSS conditional
- [x] Tanda Tangan double → hapus section 1, keep template
- [x] Signature section pakai profile empty → ganti approvers global
- [x] Upload/Analytics buttons → removed
- [x] Backend cache stal → clear __pycache__ + restart

---

## 🚀 Sprint 1 — Top Priorities

| # | Task | Why |
|---|------|-----|
| 1.1 | Financial Ratio Cards | Data sudah ada, critical untuk analisis kredit |
| 1.5 | Dashboard Date Filter | Semua metrik saat ini all-time, misleading |
| 1.3 | Sortable Columns | UX basic — tidak bisa sort tabel |
| 2.1 | EWS Dashboard Widget | Proactive risk monitoring, high value |
| 2.3 | DSCR Alert | Critical risk indicator, no alert mechanism |

**Estimated:** 2-3 hari development.

---

*End of document.*
