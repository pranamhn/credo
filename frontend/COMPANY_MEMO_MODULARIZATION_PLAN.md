# Company Memo Modularization Plan

Goal: memecah `frontend/app/companies/[id]/page.tsx` menjadi modul kecil yang mudah dirawat, tanpa mengubah behavior terlebih dahulu.

## Phase 0 — Safety Baseline

- [x] Jalankan `npm run build` sebagai baseline. ✓ Build sukses, 0 error, 0 warning TypeScript.
- [x] Catat fitur aktif di halaman:
  - [x] Profil Perusahaan — tab key `"profil"`, line ~1662
  - [x] Ringkasan Kredit — tab key `"ringkasan"`, line ~1838 (default tab)
  - [x] Dokumen — tab key `"dokumen"`, line ~2678
  - [x] Analisis Tren — tab key `"grafik"`, line ~3302
  - [x] Memo Kredit / Analisa 5C — tab key `"memo"`, line ~2984
  - [x] Print Cremo — fungsi `handlePrint` line ~258, dipanggil `printSummary` line ~1208
- [x] Pastikan tidak ada perubahan visual besar pada phase ini. ✓ Phase ini tidak mengubah kode, hanya verifikasi.
- [x] Setelah tiap phase, jalankan `npm run build`.

## Phase 1 — Extract Types & Constants

- [x] Buat folder `frontend/app/companies/[id]/_components`. ✓
- [x] Buat folder `frontend/app/companies/[id]/_lib`. ✓
- [x] Pindahkan constants ke `_lib/company-detail-constants.ts`:
  - [x] `MONTHS_ID`
  - [x] `CHART_TOOLTIP_STYLE`
  - [x] `AXIS_TICK`
  - [x] `GRID_PROPS`
  - [x] `PNL_SUMMARY_LABELS`
  - [x] `BS_SUMMARY_LABELS`
  - [x] `CF_SUMMARY_LABELS`
  - [x] `FACILITY_TYPES`
  - [x] `MEMO_STATUS`
  - [x] `MEMO_STATUS_LABEL`
  - [x] `RATING_META` (bonus — jelas konstanta)
  - [x] `docTypeInfo`, `docBadge` (bonus — object konstanta)
  - [x] `MEMO_SCORE_FIELDS`, `MEMO_5C_FIELDS` (bonus)
- [x] Pindahkan local types ke `_lib/company-detail-types.ts`:
  - [x] `PnlLineItem`, `PnlReport`
  - [x] `BalanceSheetLineItem`, `BalanceSheetReport`
  - [x] `CashFlowLineItem`, `CashFlowReport`
  - [x] `Rating`, `CreditScoreBreakdown`
  - [x] `ActiveTab`, `MemoScoreKey`, `MemoNotesKey`
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error.

## Phase 2 — Extract Pure Helpers

- [x] Buat `_lib/company-detail-helpers.tsx` (tsx karena `growthBadge` return JSX).
- [x] Pindahkan parser helpers:
  - [x] `getPnlReport`
  - [x] `getBalanceSheetReport`
  - [x] `getCashFlowReport`
  - [x] `documentTableHeaders`
- [x] Pindahkan scoring/rating helpers:
  - [x] `computeCreditScore` (plan: `computeRiskRating` — fungsi yang sama)
  - [x] `growthBadge`
  - [x] `emptyCompanyMemo`
- [x] Buat `_lib/print-credit-summary.ts`.
- [x] Pindahkan `handlePrint` ke `_lib/print-credit-summary.ts`. Ekspor `PrintData` interface juga.
- [x] Tambah `DailyData` dan `MonthlyData` ke `_lib/company-detail-types.ts` (diperlukan oleh helpers).
- [x] Pastikan helper tidak bergantung langsung pada React state. ✓ Semua pure functions.
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error.

## Phase 3 — Extract Layout Blocks

- [x] Extract `CompanyHeader` — props: `company`, `totalTransactions`, `documentCount`, `rating`, `ratingMeta`.
- [x] Extract `LeftNavigationPanel` — props: `tabs`, `activeTab`, `onTabChange`.
- [x] Extract `UploadDocumentPanel` — props: `selectedDocType`, `onDocTypeSelect` (compound callback).
- [x] Extract `DocumentStatsPanel` — props: 5 count fields dari summary.
- [x] Page utama tetap memegang state dan pass props eksplisit. ✓
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error.

## Phase 4 — Extract Tab Components

- [x] Extract `ProfileTab`. ✓ Props: company, profile, setProfileField, saveProfile, legalDocs, legalUploading, handleLegalDocUpload, removeLegalDoc, approvers, updateApprover.
- [x] Extract `CreditSummaryTab`. ✓ Props: summary, company, profile, memo, rating, ratingMeta, creditScore, ewsTier, netFlow, entityType, lamaBerdiri, slikDerived, slikReports, cbiReports, pnlComparison, bsComparison, derivedRatios, monthlyData, notes, saveNotes, printSummary, debtEntries, scoringAspects, dscrCicilanBaru, updateDscrCicilanBaru, addDebtEntry, updateDebtEntry, removeDebtEntry, updateScoringAspect.
- [x] Extract `DocumentsTab`. ✓ Props: visibleStatements, byYearMonth, calYears, documentFilter, setDocumentFilter, docView, setDocView, calYear, setCalYear, deletingId, reparsingId, confirmDeleteId, setConfirmDeleteId, handleDelete, handleReparse, fetchData, openUploadModal, setSelectedPnlDoc.
- [x] Extract `TrendAnalysisTab`. ✓ Props: chartPeriod, setChartPeriod, txLoading, mounted, filteredDaily, filteredMonthly. ChartCard moved here.
- [x] Extract `CreditMemoTab`. ✓ Props: company, memo, setMemoField, saveMemo, addCollateral, updateCollateral, removeCollateral.
- [x] Setiap tab menerima props eksplisit. ✓
- [x] Jangan gunakan context/store baru di phase ini. ✓
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error. page.tsx turun dari ~2756 → 1106 baris.

## Phase 5 — Extract Modals

- [x] Extract `UploadDocumentModal`. ✓ Props: open, onClose, selectedDocType, companyId, onComplete.
- [x] Extract `FinancialDocumentModal`. ✓ Props: doc, onClose, reparsingId, onReparse. Derived values computed internally.
- [x] Pastikan modal open/close behavior tetap sama. ✓
- [x] Pastikan callback tetap jalan:
  - [x] Upload ✓
  - [x] Reparse ✓
  - [x] Delete ✓ (passed through DocumentsTab, unchanged)
  - [x] Refresh data ✓ (onComplete calls fetchData)
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error. page.tsx turun dari 1106 → 816 baris.

## Phase 6 — Extract Hooks

- [x] Buat `_hooks/useCompanyDetailData.ts`. ✓ State: summary/statements/slikReports/cbiReports/loading/error/deletingId/reparsingId/confirmDeleteId. Callbacks: fetchData/handleDelete/handleReparse.
- [x] Buat `_hooks/useCompanyLocalState.ts`. ✓ State: mounted/notes/memo/profile/legalDocs/scoringAspects/debtEntries/dscrCicilanBaru/approvers. All localStorage callbacks.
- [x] Buat `_hooks/useTransactionAnalytics.ts`. ✓ State: dailyData/monthlyData/txLoading/chartPeriod. Includes loadTransactionsData, filteredDaily, filteredMonthly.
- [x] Buat `_hooks/useFinancialComparisons.ts`. ✓ Returns: pnlComparison/bsComparison/derivedRatios.
- [x] Page utama idealnya tinggal orchestration:
  - [x] Fetch data ✓
  - [x] Compose hooks ✓
  - [x] Render layout ✓
  - [x] Pass props ke components ✓
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error. page.tsx turun dari 816 → 391 baris.

## Phase 7 — Final Cleanup

- [x] Hapus import yang tidak dipakai. ✓ TrendAnalysisTab split-import merged; `docBadge` dead export removed.
- [x] Rapikan prop names. ✓ No renames needed — all prop names already consistent.
- [x] Cek ukuran file tiap modul. ✓ CreditSummaryTab 918L (largest, acceptable); page.tsx 391L; all hooks/components under 350L.
- [x] Pastikan tidak ada duplikasi logic print/scoring. ✓ `computeCreditScore` only in helpers, `handlePrint` only in print-credit-summary.ts, `slikDerived` only in page.tsx.
- [x] Jalankan `npm run build`. ✓ Build sukses, 0 error, 0 TypeScript warning.
- [ ] Manual check halaman (requires browser):
  - [ ] `/companies`
  - [ ] `/companies/[id]`
  - [ ] Tab Profil Perusahaan
  - [ ] Tab Ringkasan Kredit
  - [ ] Print Cremo
  - [ ] Upload dokumen
  - [ ] Dokumen table/calendar
  - [ ] Analisis Tren
  - [ ] Memo Kredit / Analisa 5C

## Target Struktur

```txt
frontend/app/companies/[id]/
  page.tsx
  _components/
    CompanyHeader.tsx
    LeftNavigationPanel.tsx
    UploadDocumentPanel.tsx
    DocumentStatsPanel.tsx
    UploadDocumentModal.tsx
    FinancialDocumentModal.tsx
    ProfileTab.tsx
    CreditSummaryTab.tsx
    DocumentsTab.tsx
    TrendAnalysisTab.tsx
    CreditMemoTab.tsx
    ChartCard.tsx
  _hooks/
    useCompanyDetailData.ts
    useCompanyLocalState.ts
    useTransactionAnalytics.ts
    useFinancialComparisons.ts
  _lib/
    company-detail-constants.ts
    company-detail-types.ts
    company-detail-helpers.ts
    print-credit-summary.ts
```

## Recommended First Slice

Mulai dari Phase 1 sampai Phase 3 terlebih dahulu. Phase ini paling rendah risiko karena hanya memindahkan constants, types, helpers, dan layout blocks tanpa mengubah behavior utama.

