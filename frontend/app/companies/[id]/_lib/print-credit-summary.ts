// Runs in the browser only (uses window.open, window.location).
import { toast } from "sonner";
import type { CompanySummary } from "@/lib/api";
import type { CreditMemo, CompanyProfile, ScoringAspect, DebtEntry, ApproverEntry } from "@/lib/localData";
import { formatIDR, formatDate } from "@/lib/utils";
import { RATING_META, MONTHS_ID } from "./company-detail-constants";
import type { Rating, MonthlyData, CreditScoreBreakdown } from "./company-detail-types";

type SlikDerivedPrint = {
  worstKol: number; totalBaki: number; jmlKreditur: number; jmlFasilitas: number;
  monthlyIncome: number; estCicilanPerBulan: number; dsr: number | null; kolLabel: string;
} | null;

export interface PrintData {
  ewsTier: "hijau" | "kuning" | "merah";
  coverage: { label: string; has: boolean }[];
  pnlComparison: any;
  bsComparison: any;
  monthlyData: MonthlyData[];
  derivedRatios: any;
  scoringAspects: ScoringAspect[];
  debtEntries: DebtEntry[];
  dscrCicilanBaru: number;
  creditScore: CreditScoreBreakdown;
  slikDerived: SlikDerivedPrint;
  approvers: ApproverEntry[];
}

export function handlePrint(
  summary: CompanySummary,
  rating: Rating,
  notes: string,
  netFlow: number,
  profile: CompanyProfile,
  memo: CreditMemo,
  printData: PrintData,
) {
  const meta = RATING_META[rating];
  const esc = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const pct = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  const idr = (value: number | null | undefined) => value == null ? "—" : formatIDR(value);

  // Derive entity type from company name prefix
  const name = summary.company.name;
  let entityType = "";
  if (/^PT\s/i.test(name)) entityType = "Perseroan Terbatas (PT)";
  else if (/^CV\s/i.test(name)) entityType = "Commanditaire Vennootschap (CV)";
  else if (/^UD\s/i.test(name)) entityType = "Usaha Dagang (UD)";
  else if (/^Firma\s/i.test(name)) entityType = "Firma";

  // Calculate company age from DD/MM/YYYY
  let lamaBerdiri = "";
  if (profile.tanggalBerdiri) {
    const parts = profile.tanggalBerdiri.split("/");
    if (parts.length === 3) {
      const founded = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      const years = Math.floor((Date.now() - founded.getTime()) / (365.25 * 24 * 3600 * 1000));
      if (!isNaN(years) && years > 0) lamaBerdiri = `Lama berdiri: ${years} Tahun`;
    }
  }

  const row = (label: string, value: string, right = "") =>
    `<tr><td class="td-label">${esc(label)}</td><td class="td-sep">:</td><td class="td-val">${esc(value || "—")}</td>${right ? `<td class="td-right">${esc(right)}</td>` : `<td></td>`}</tr>`;
  const simpleTable = (headers: string[], rows: (string | number | null | undefined)[][]) =>
    `<table class="data"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const section = (title: string, body: string, className = "") =>
    `<section class="section ${className}"><div class="section-title">${esc(title)}</div>${body}</section>`;
  const signatureBody = printData.approvers.length > 0
    ? `<div class="sign-grid">${printData.approvers.map((a) => `<div class="sign"><div class="sign-line"></div><div class="sign-name">${esc(a.nama || "—")}</div><div class="sign-role">${esc(a.jabatan)}</div></div>`).join("")}</div>`
    : "";
  const existingAnnual = printData.debtEntries.reduce((s, e) => s + Number(e.cicilanPerBulan || 0), 0) * 12;
  const newAnnual = Number(printData.dscrCicilanBaru || 0) * 12;
  const totalAnnual = existingAnnual + newAnnual;
  const opRow = printData.pnlComparison?.rows?.find?.((r: any) => r.key === "operating_profit");
  const ebitda = opRow?.annualizedTotal ?? opRow?.latestTotal ?? null;
  const dscr = ebitda !== null && totalAnnual > 0 ? ebitda / totalAnnual : null;
  const totalMonthlyCredit = printData.monthlyData.reduce((s, m) => s + m.credit, 0);
  const totalMonthlyDebit = printData.monthlyData.reduce((s, m) => s + m.debit, 0);
  const totalMonthlyNet = totalMonthlyCredit - totalMonthlyDebit;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan Analisis Kredit — ${esc(name)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; background: #f8fafc; padding: 28px; max-width: 980px; margin: 0 auto; }
  .sheet { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08); }
  .doc-header { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; border-bottom:2px solid #0f766e; padding-bottom:18px; margin-bottom:20px; }
  h1 { font-size: 22px; line-height:1.2; font-weight: 800; margin: 0 0 6px; color:#0f172a; }
  .kicker { font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#0f766e; margin:0 0 6px; }
  .sub { color: #64748b; font-size: 12px; margin: 0; }
  .stamp { text-align:right; min-width:150px; }
  .stamp-title { font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; }
  .stamp-date { margin-top:5px; font-size:12px; font-weight:700; color:#334155; }
  .section { margin-bottom: 14px; break-inside: avoid; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:#fff; }
  .section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.11em; color: #475569; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:9px 16px; margin:0; }
  .section > :not(.section-title) { margin: 0; padding: 12px 16px; }
  table.idt { width: 100%; border-collapse: collapse; font-size: 12px; margin:0 !important; }
  table.idt tr { border-bottom: 1px solid #f1f5f9; }
  table.idt tr:last-child { border-bottom:0; }
  .td-label { color: #64748b; width: 150px; padding: 7px 8px 7px 16px; }
  .td-sep   { width: 16px; color: #cbd5e1; padding: 7px 4px; }
  .td-val   { font-weight: 500; padding: 7px 8px; }
  .td-right { text-align: right; font-size: 11px; color: #64748b; font-style: italic; white-space: nowrap; padding: 7px 16px 7px 8px; }
  .exec-box { font-size: 12px; color: #374151; line-height: 1.65; white-space: pre-wrap; text-align: justify; margin:0 !important; padding:14px 16px !important; }
  .rating-row { display:flex; gap:14px; align-items:center; margin:0 !important; padding:14px 16px !important; }
  .rating-badge { display: inline-flex; align-items:center; justify-content:center; min-width:78px; min-height:70px; font-size: 38px; font-weight: 900; border-radius: 12px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
  .pill-row { display:flex; flex-wrap:wrap; gap:7px; padding:12px 16px !important; }
  .pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 10px; font-size:10px; font-weight:700; border:1px solid #e2e8f0; white-space:nowrap; }
  .ok { background:#ecfdf5; color:#047857; border-color:#a7f3d0; }
  .miss { background:#f8fafc; color:#94a3b8; border-color:#e2e8f0; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin:0 !important; padding:12px 16px !important; }
  .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 10px; min-height:64px; }
  .metric-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; margin-bottom: 5px; }
  .metric-value { font-size: 13px; font-weight: 800; color: #1e293b; overflow-wrap:anywhere; }
  table.data { width:100%; border-collapse:collapse; font-size:10px; table-layout:auto; margin:0 !important; }
  table.data th { background:#f8fafc; color:#64748b; text-transform:uppercase; letter-spacing:.05em; font-size:8px; text-align:left; padding:7px 8px; border-bottom:1px solid #e2e8f0; }
  table.data td { padding:7px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
  table.data tr:last-child td { border-bottom:0; }
  table.data td:not(:first-child), table.data th:not(:first-child) { text-align:right; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 14px 16px !important; font-size: 12px; color: #374151; white-space: pre-wrap; min-height: 70px; margin:12px 16px !important; text-align:justify; }
  .sign-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin:0 !important; padding:16px !important; }
  .sign { text-align:center; padding:46px 10px 0; }
  .sign-line { border-top:2px solid #cbd5e1; margin-bottom:8px; }
  .sign-name { font-size:12px; font-weight:700; }
  .sign-role,.sign-date { font-size:10px; color:#64748b; margin-top:2px; }
  .footer { color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 18px; display:flex; justify-content:space-between; }
  .s-ok   { display:inline-flex; border-radius:999px; padding:2px 8px; font-size:9px; font-weight:700; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }
  .s-warn { display:inline-flex; border-radius:999px; padding:2px 8px; font-size:9px; font-weight:700; background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
  .s-bad  { display:inline-flex; border-radius:999px; padding:2px 8px; font-size:9px; font-weight:700; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
  .sub-hdr td { padding:5px 8px 4px; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; background:#f8fafc; }
  @media print {
    body { padding: 0; max-width: none; background:#fff; }
    .sheet { border:0; border-radius:0; box-shadow:none; padding:0; }
    .section { break-inside: avoid; page-break-inside: avoid; }
    .doc-header { break-after: avoid; }
  }
</style></head><body>
<main class="sheet">
<header class="doc-header">
  <div>
    <p class="kicker">Credit Memo</p>
    <h1>${esc(name)}</h1>
    <p class="sub">Ringkasan analisis kredit perusahaan</p>
  </div>
  <div class="stamp">
    <div class="stamp-title">Tanggal Cetak</div>
    <div class="stamp-date">${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</div>
  </div>
</header>

${section("I. Identitas Debitur", `
  <table class="idt">
    ${row("Nama Perusahaan", name, entityType)}
    ${row("Alamat", profile.alamat)}
    ${row("Tanggal Berdiri", profile.tanggalBerdiri, lamaBerdiri)}
    ${row("Jenis Usaha", profile.jenisUsaha, profile.kbli ? `KBLI: ${profile.kbli}` : "KBLI: —")}
    ${row("Total Karyawan", profile.totalKaryawan)}
    ${row("Direktur / PIC", profile.direktur, profile.teleponDirektur ? `Telp: ${profile.teleponDirektur}` : "Telp: —")}
    ${row("NPWP Perusahaan", profile.npwp, `Status Wajib Pajak: ${profile.statusWajibPajak || "Aktif"}`)}
    ${row("NIB / SIUP", profile.nibSiup, profile.masaBerlakuNib ? `Masa berlaku: ${profile.masaBerlakuNib}` : "Masa berlaku: —")}
    ${memo.loanAmount ? row("Plafon EWA Diajukan", formatIDR(memo.loanAmount), `Tenor: ${memo.tenor} bulan`) : ""}
  </table>
`)}

${profile.ringkasanEksekutif ? section("Ringkasan Eksekutif", `<div class="exec-box">${esc(profile.ringkasanEksekutif)}</div>`) : ""}

${section("Rating Risiko Kredit", `
  <div class="rating-row">
    <div class="rating-badge">${esc(rating)}</div>
    <div>
      <p style="font-weight:700;margin:0 0 4px 0">${esc(meta.label)}</p>
      <p style="color:#64748b;font-size:13px;margin:0 0 8px 0">${esc(meta.desc)}</p>
      <span class="pill ${printData.ewsTier === "hijau" ? "ok" : printData.ewsTier === "kuning" ? "" : "miss"}">EWS ${esc(printData.ewsTier.toUpperCase())}</span>
    </div>
  </div>
`)}

${section("Credit Score Breakdown", (() => {
    const cs = printData.creditScore;
    const dims = [
      { label: "Keuangan", score: cs.keuangan, max: 40, isDefault: false },
      { label: "Cashflow Bank Statement", score: cs.cashflow, max: 25, isDefault: false },
      { label: "Kolektibilitas SLIK", score: cs.slik, max: 20, isDefault: cs.slikDefault },
      { label: "Agunan / Collateral", score: cs.agunan, max: 10, isDefault: cs.agunanDefault },
      { label: "Karakter / Kualitatif", score: cs.karakter, max: 5, isDefault: false },
    ];
    return `<table class="data"><thead><tr><th>Dimensi</th><th>Skor</th><th>Maks</th><th style="min-width:120px">Progress</th></tr></thead><tbody>${dims.map(({ label, score, max, isDefault }) => {
      const pct = Math.round((score / max) * 100);
      const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#14b8a6" : pct >= 25 ? "#f59e0b" : "#ef4444";
      return `<tr><td>${esc(label)}${isDefault ? ' <em style="font-size:9px;color:#94a3b8">(estimasi)</em>' : ""}</td><td>${score}</td><td style="color:#94a3b8">${max}</td><td style="padding:7px 8px"><div style="background:#f1f5f9;border-radius:4px;height:5px"><div style="background:${color};border-radius:4px;height:5px;width:${pct}%"></div></div></td></tr>`;
    }).join("")
      }<tr style="border-top:2px solid #e2e8f0;background:#f8fafc"><td style="font-weight:800;color:#0f172a">Total</td><td style="font-weight:900;font-size:13px;color:#0f172a">${cs.total}</td><td style="color:#94a3b8">100</td><td></td></tr></tbody></table>`;
  })())}

${section("Faktor Risiko", `
  <div class="grid">
    <div class="metric"><div class="metric-label">Dokumen Berhasil</div><div class="metric-value">${summary.successful_uploads} dari ${summary.document_count}</div></div>
    <div class="metric"><div class="metric-label">Dokumen Gagal</div><div class="metric-value">${summary.failed_uploads}</div></div>
    <div class="metric"><div class="metric-label">Net Flow</div><div class="metric-value">${netFlow >= 0 ? "+" : "−"}${formatIDR(Math.abs(netFlow))}</div></div>
    <div class="metric"><div class="metric-label">Jumlah Transaksi</div><div class="metric-value">${summary.total_transactions.toLocaleString("id-ID")}</div></div>
  </div>
`)}

${section("Kelengkapan Dokumen", `<div class="pill-row">${printData.coverage.map((item) => `<span class="pill ${item.has ? "ok" : "miss"}">${item.has ? "✓" : "○"} ${esc(item.label)}</span>`).join("")}</div>`)}

${printData.slikDerived ? section("II. Insight iDeb / SLIK", (() => {
    const sd = printData.slikDerived!;
    const kolColor = sd.worstKol === 1 ? "#047857" : sd.worstKol === 2 ? "#b45309" : "#dc2626";
    const kolBg = sd.worstKol === 1 ? "#ecfdf5" : sd.worstKol === 2 ? "#fffbeb" : "#fef2f2";
    const kolBdr = sd.worstKol === 1 ? "#a7f3d0" : sd.worstKol === 2 ? "#fde68a" : "#fecaca";
    const dsrColor = sd.dsr === null ? "#94a3b8" : sd.dsr <= 0.35 ? "#047857" : sd.dsr <= 0.5 ? "#b45309" : "#dc2626";
    const dsrLabel = sd.dsr === null ? "—" : `${(sd.dsr * 100).toFixed(1)}% — ${sd.dsr <= 0.35 ? "Aman" : sd.dsr <= 0.5 ? "Perhatian" : "Tinggi"}`;
    return `<div style="padding:8px 16px 4px"><span style="display:inline-flex;align-items:center;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;background:${kolBg};color:${kolColor};border:1px solid ${kolBdr}">Kol ${sd.worstKol} — ${esc(sd.kolLabel)}</span></div>
<div class="grid"><div class="metric"><div class="metric-label">Kreditur</div><div class="metric-value">${sd.jmlKreditur}</div></div><div class="metric"><div class="metric-label">Fasilitas</div><div class="metric-value">${sd.jmlFasilitas}</div></div><div class="metric"><div class="metric-label">Total Baki Debet</div><div class="metric-value">${idr(sd.totalBaki)}</div></div><div class="metric"><div class="metric-label">DSR</div><div class="metric-value" style="color:${dsrColor}">${dsrLabel}</div></div></div>
<div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:0"><div class="metric"><div class="metric-label">Est. Pendapatan/Bln</div><div class="metric-value">${idr(sd.monthlyIncome)}</div></div><div class="metric"><div class="metric-label">Est. Cicilan Existing/Bln</div><div class="metric-value">${idr(sd.estCicilanPerBulan)}</div></div></div>`;
  })()) : ""}

${printData.pnlComparison ? section("III-A. Laporan Laba Rugi", simpleTable(
    [
      "Pos",
      ...(printData.pnlComparison.priorLabel ? [printData.pnlComparison.priorLabel] : []),
      printData.pnlComparison.latestLabel,
      ...(printData.pnlComparison.latestMo < 12 ? ["Annualized"] : []),
      ...(printData.pnlComparison.priorLabel ? ["Est. Growth"] : []),
    ],
    printData.pnlComparison.rows.map((r: any) => [
      r.label,
      ...(printData.pnlComparison.priorLabel ? [idr(r.priorTotal)] : []),
      idr(r.latestTotal),
      ...(printData.pnlComparison.latestMo < 12 ? [idr(r.annualizedTotal)] : []),
      ...(printData.pnlComparison.priorLabel ? [pct(r.estGrowthPct)] : []),
    ])
  )) : section("III-A. Laporan Laba Rugi", `<p class="sub">Upload dokumen Profit &amp; Loss untuk melihat Laporan Laba Rugi.</p>`)}

${printData.bsComparison ? section("III-B. Neraca (Balance Sheet)", simpleTable(
    [
      "Pos",
      ...(printData.bsComparison.priorLabel ? [printData.bsComparison.priorLabel] : []),
      printData.bsComparison.latestLabel,
      ...(printData.bsComparison.remainingMonths !== null && printData.bsComparison.remainingMonths > 0 ? ["Proj. Dec"] : []),
      ...(printData.bsComparison.priorLabel ? ["Growth"] : []),
    ],
    printData.bsComparison.rows.map((r: any) => [
      r.label,
      ...(printData.bsComparison.priorLabel ? [idr(r.priorValue)] : []),
      idr(r.latestValue),
      ...(printData.bsComparison.remainingMonths !== null && printData.bsComparison.remainingMonths > 0 ? [idr(r.projectedValue)] : []),
      ...(printData.bsComparison.priorLabel ? [pct(r.growthPct)] : []),
    ])
  )) : section("III-B. Neraca (Balance Sheet)", `<p class="sub">Upload dokumen Balance Sheet untuk melihat Neraca.</p>`)}

${section("III-C. Arus Kas Rekening Koran", printData.monthlyData.length ? simpleTable(
    ["Bulan", "Total Masuk", "Total Keluar", "Net Cash Flow", "Saldo Akhir"],
    [
      ...printData.monthlyData.map((m) => [
        `${MONTHS_ID[parseInt(m.month.slice(5, 7)) - 1]} ${m.month.slice(0, 4)}`,
        idr(m.credit),
        idr(m.debit),
        `${m.credit - m.debit >= 0 ? "+" : "−"}${idr(Math.abs(m.credit - m.debit))}`,
        idr(m.balance),
      ]),
      ["Total", idr(totalMonthlyCredit), idr(totalMonthlyDebit), `${totalMonthlyNet >= 0 ? "+" : "−"}${idr(Math.abs(totalMonthlyNet))}`, idr(printData.monthlyData.at(-1)?.balance ?? 0)],
    ]
  ) : `<p class="sub">Upload Bank Statement untuk melihat arus kas bulanan.</p>`)}

${printData.derivedRatios ? section("IV. Analisa Rasio Keuangan", (() => {
    const dr = printData.derivedRatios;
    const statusBadge = (tier: "ok" | "warn" | "bad" | null) =>
      tier === "ok" ? '<span class="s-ok">BAIK</span>'
        : tier === "warn" ? '<span class="s-warn">CUKUP</span>'
          : tier === "bad" ? '<span class="s-bad">RENDAH</span>'
            : "—";
    const ratioTier = (v: number | null, hi: number, lo: number) =>
      v === null ? null : v >= hi ? "ok" : v >= lo ? "warn" : "bad";
    const invTier = (v: number | null, good: number, warn: number): "ok" | "warn" | "bad" | null =>
      v === null ? null : v < good ? "ok" : v < warn ? "warn" : "bad";
    const rows: [string, string, string][] = [
      ["Gross Profit Margin (GPM)", pct(dr.grossMargin), statusBadge(ratioTier(dr.grossMargin, 30, 15))],
      ["Net Profit Margin (NPM)", pct(dr.netMargin), statusBadge(ratioTier(dr.netMargin, 10, 5))],
      ["Return on Assets (ROA)", pct(dr.roa), statusBadge(ratioTier(dr.roa, 5, 2))],
      ["Return on Equity (ROE)", pct(dr.roe), statusBadge(ratioTier(dr.roe, 15, 8))],
      ["EBITDA Margin", pct(dr.ebitdaMargin), statusBadge(ratioTier(dr.ebitdaMargin, 20, 10))],
      ["Debt-to-Equity (DER)", dr.der == null ? "—" : `${dr.der.toFixed(2)}x`, statusBadge(invTier(dr.der, 2, 3))],
      ["Debt-to-Asset (DAR)", pct(dr.dar), statusBadge(invTier(dr.dar, 50, 75))],
    ];
    return `<table class="data"><thead><tr><th>Rasio</th><th>Nilai</th><th>Status</th></tr></thead><tbody>
<tr class="sub-hdr"><td colspan="3">Profitabilitas</td></tr>
${rows.slice(0, 5).map(([r, v, s]) => `<tr><td>${r}</td><td>${v}</td><td>${s}</td></tr>`).join("")}
<tr class="sub-hdr"><td colspan="3">Leverage &amp; Solvabilitas</td></tr>
${rows.slice(5).map(([r, v, s]) => `<tr><td>${r}</td><td>${v}</td><td>${s}</td></tr>`).join("")}
</tbody></table>`;
  })()) : ""}

${printData.scoringAspects.length ? section("V. Scoring Aspek Kredit", simpleTable(
    ["Aspek", "Bobot", "Skor", "W.Score", "Catatan"],
    printData.scoringAspects.map((a) => [a.label, `${a.bobot}%`, a.skor, ((a.bobot * a.skor) / 100).toFixed(2), a.catatan])
  )) : ""}

${section("VI. Rincian Hutang & DSCR", `
  ${printData.debtEntries.length ? simpleTable(
    ["Kreditur", "Fasilitas", "Plafon", "Outstanding", "Cicilan/Bln"],
    printData.debtEntries.map((e) => [e.kreditur, e.fasilitas, idr(e.plafon), idr(e.outstanding), idr(e.cicilanPerBulan)])
  ) : `<p class="sub">Belum ada data hutang existing.</p>`}
  <div class="grid" style="margin-top:10px">
    <div class="metric"><div class="metric-label">Total Debt Service / Thn</div><div class="metric-value">${idr(totalAnnual)}</div></div>
    <div class="metric"><div class="metric-label">EBITDA Annualized</div><div class="metric-value">${idr(ebitda)}</div></div>
    <div class="metric"><div class="metric-label">DSCR</div><div class="metric-value">${dscr !== null ? `${dscr.toFixed(2)}x` : "—"}</div></div>
  </div>
`)}

${section("Catatan Analis", `<div class="notes-box">${esc(notes || "(belum ada catatan)")}</div>`)}
${signatureBody ? section("Tanda Tangan & Persetujuan", signatureBody) : ""}
<div class="footer"><span>Digenerate oleh CREDO</span><span>${window.location.origin}</span></div>
</main>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up diblokir browser. Izinkan pop-up untuk export PDF."); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}
