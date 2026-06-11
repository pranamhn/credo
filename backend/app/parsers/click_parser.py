"""
CLICK Parser — PT. CRIF Lembaga Informasi Keuangan
Individual credit report format.

The PDF has two sections:
  1. CONTRACT SUMMARY + compact table (pages 1-8): numbered rows with Provider Name, dates, Col 1/2 history
  2. Per-contract DETAIL pages (pages 9+): "Detail of Credit / Financing N: Type - Phase" headers
     with full financial data (credit limit, debit balance, interest rate, worst status, etc.)

We parse the summary for totals and the detail pages for per-facility data.
"""
from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)

# Map English CLICK worst status → numeric kualitas (1-5)
_KUALITAS_MAP = {
    "current": "1",
    "special mention": "2",
    "substandard": "3",
    "doubtful": "4",
    "loss": "5",
    "paid off": "0",
    "paid-off": "0",
}


@dataclass
class ClickFasilitas:
    kreditur: str = ""
    jenis_kredit: str = ""
    plafon: Optional[float] = None
    baki_debet: Optional[float] = None
    bunga: str = ""
    tanggal_mulai: str = ""
    tanggal_jatuh_tempo: str = ""
    kualitas: str = ""
    status: str = "aktif"  # "aktif" | "selesai"


@dataclass
class ClickSubject:
    nama: str = ""
    no_identitas: str = ""
    jenis_kelamin: str = ""
    tanggal_lahir: str = ""
    tempat_lahir: str = ""


@dataclass
class ClickReport:
    tanggal_laporan: str = ""
    subject: ClickSubject = field(default_factory=ClickSubject)
    cb_score: Optional[int] = None
    risk_grade: str = ""
    jumlah_kontrak: int = 0
    jumlah_kreditur: int = 0
    total_credit_limit: Optional[float] = None
    total_debit_balance: Optional[float] = None
    total_overdue: Optional[float] = None
    fasilitas_aktif: list[ClickFasilitas] = field(default_factory=list)
    fasilitas_selesai: list[ClickFasilitas] = field(default_factory=list)
    raw_pages: int = 0


# ── helpers ────────────────────────────────────────────────────────────────────

def _clean(val: str) -> str:
    return " ".join(val.split()).strip()


def _parse_idr(text: str) -> Optional[float]:
    if not text:
        return None
    t = re.sub(r"[IDRRp\s]", "", text)
    t = t.replace(".", "").replace(",", ".")
    try:
        v = float(t)
        return v if v >= 0 else None
    except ValueError:
        return None


def _map_kualitas(raw: str) -> str:
    """Map CLICK English worst-status to numeric kualitas string."""
    key = raw.strip().lower()
    return _KUALITAS_MAP.get(key, raw.strip())


# ── main entry ─────────────────────────────────────────────────────────────────

def parse_click_pdf(file_path: str) -> ClickReport:
    report = ClickReport()

    with pdfplumber.open(file_path) as pdf:
        report.raw_pages = len(pdf.pages)
        pages = [
            (page.extract_text(x_tolerance=3, y_tolerance=3) or "")
            for page in pdf.pages
        ]

    full_text = "\n".join(pages)

    _parse_header(full_text, report)
    _parse_subject(full_text, report)
    _parse_score(full_text, report)
    _parse_summary(full_text, report)
    _parse_contracts(full_text, report)

    return report


# ── section parsers ────────────────────────────────────────────────────────────

def _parse_header(text: str, report: ClickReport) -> None:
    """Extract report date — normalize slashes to dashes."""
    m = re.search(
        r"(?:Request\s+Date|CREDIT\s+REPORT\s+CREATED\s+ON)\s*[:\-]?\s*(\d{4}[/\-]\d{2}[/\-]\d{2})",
        text, re.IGNORECASE,
    )
    if m:
        report.tanggal_laporan = m.group(1).replace("/", "-")


def _parse_subject(text: str, report: ClickReport) -> None:
    """
    Parse subject block. PDF uses a two-row table layout:
      header row:  Name As Id  Full Name  Mother's Name  Gender
      value row:   KIRWANTO    KIRWANTO   -              Male

      header row:  Date of Birth  Place of Birth  Marital Status  ...
      value row:   10-04-1981     TANJUNG KESUMA  MARRIED         ...
    """
    s = report.subject

    # Narrow to subject block
    m = re.search(
        r"Subject\s+Data\s*([\s\S]{0,4000}?)(?:Employment\s+Data|SHAREHOLDER|CB\s+SCORE)",
        text, re.IGNORECASE,
    )
    block = m.group(1) if m else text[:4000]

    # Name: "Name As Id Full Name Mother's Name Gender\n{name_as_id} {full_name} - Male"
    # The subject appears to duplicate name in both columns; take the first word group
    name_m = re.search(
        r"Name\s+As\s+Id\s+Full\s+Name[^\n]*\n\s*([A-Z][A-Z\s\-]{1,60}?)\s+-\s+(?:Male|Female)",
        block, re.IGNORECASE,
    )
    if name_m:
        # Both "Name As Id" and "Full Name" columns usually contain the same name; take unique tokens
        raw = _clean(name_m.group(1))
        tokens = raw.split()
        # Deduplicate consecutive duplicate tokens (e.g., "KIRWANTO KIRWANTO")
        seen: list[str] = []
        for tok in tokens:
            if not seen or tok != seen[-1]:
                seen.append(tok)
        s.nama = " ".join(seen)

    # Date of Birth + Place of Birth on same value row
    dob_m = re.search(
        r"Date\s+of\s+Birth\s+Place\s+of\s+Birth[^\n]*\n\s*(\d{2}-\d{2}-\d{4})\s+([A-Z][A-Z\s\-]{2,50}?)\s+(?:MARRIED|SINGLE|DIVORCED|WIDOW|BELUM|CERAI|-)\b",
        block, re.IGNORECASE,
    )
    if dob_m:
        s.tanggal_lahir = dob_m.group(1)
        s.tempat_lahir = _clean(dob_m.group(2))

    # Gender from name row
    gender_m = re.search(r"\b(Male|Female)\b", block, re.IGNORECASE)
    if gender_m:
        s.jenis_kelamin = gender_m.group(1)

    # ID Card
    id_m = re.search(r"ID\s+CARD\s*[:\s]+(\d{10,20})", text, re.IGNORECASE)
    if id_m:
        s.no_identitas = id_m.group(1)


def _parse_score(text: str, report: ClickReport) -> None:
    """
    CB SCORE section layout:
      Score  Risk Grade
      501    Di
      High Risk
    """
    # Primary: "Score Risk Grade\n{score} {grade_code}\n{grade_desc}"
    m = re.search(
        r"Score\s+Risk\s+Grade\s*\n\s*(\d{3,4})\s+(\S+)",
        text, re.IGNORECASE,
    )
    if m:
        try:
            report.cb_score = int(m.group(1))
        except ValueError:
            pass
        # Try to get full risk description on next line
        rest = text[m.end():m.end() + 80]
        desc_m = re.search(r"((?:Very\s+)?(?:High|Medium|Low|Average)\s+Risk)", rest, re.IGNORECASE)
        if desc_m:
            report.risk_grade = _clean(desc_m.group(1))
        else:
            report.risk_grade = _clean(m.group(2))
        return

    # Fallback: simple "Score NNN" pattern
    score_m = re.search(r"(?<!\w)Score\s+(\d{3,4})(?!\s*\w)", text, re.IGNORECASE)
    if score_m:
        try:
            report.cb_score = int(score_m.group(1))
        except ValueError:
            pass

    grade_m = re.search(
        r"((?:Very\s+)?(?:High|Medium|Low|Average)\s+Risk)",
        text, re.IGNORECASE,
    )
    if grade_m:
        report.risk_grade = _clean(grade_m.group(1))


def _parse_summary(text: str, report: ClickReport) -> None:
    """
    CONTRACT SUMMARY table layout (multi-line headers + value rows):

      Contracts number  Total Credit Limit  Total Potential Exposure
      Number
      24                255.353.392         121.076.233
      17

      Total Debit Balance  Total Overdue  Currency
      111.076.233          0              Indonesian Rupiah
    """
    m = re.search(
        r"CONTRACT\s+SUMMARY\s*([\s\S]{0,1200}?)(?:CONTRACTS?\s+DETAILS?|Detail\s+of\s+Credit|Financial\s+Summary)",
        text, re.IGNORECASE,
    )
    if not m:
        return
    block = m.group(1)

    # Contracts count + credit limit on the same data row
    # Pattern: "Contracts number {optional more headers}\n{optional Number header}\n{count} {credit_limit} {potential}\n{providers}"
    ctr_m = re.search(
        r"Contracts\s+number[^\n]*\n(?:[^\n]*\n)?\s*(\d+)\s+([\d.,]+)\s+([\d.,]+)\s*\n\s*(\d+)",
        block, re.IGNORECASE,
    )
    if ctr_m:
        try:
            report.jumlah_kontrak = int(ctr_m.group(1))
        except ValueError:
            pass
        report.total_credit_limit = _parse_idr(ctr_m.group(2))
        try:
            report.jumlah_kreditur = int(ctr_m.group(4))
        except ValueError:
            pass
    else:
        # Fallback: simpler patterns
        cnt_m = re.search(r"Contracts\s+number\D{0,30}?(\d+)", block, re.IGNORECASE | re.DOTALL)
        if cnt_m:
            try:
                report.jumlah_kontrak = int(cnt_m.group(1))
            except ValueError:
                pass

        prov_m = re.search(r"Reporting\s+Providers[^\n]*\n[^\n]*\n\s*\d[^\n]*\n\s*(\d+)", block, re.IGNORECASE)
        if prov_m:
            try:
                report.jumlah_kreditur = int(prov_m.group(1))
            except ValueError:
                pass

        lim_m = re.search(r"Total\s+Credit\s+Limit\s+([\d.,]+)", block, re.IGNORECASE)
        if lim_m:
            report.total_credit_limit = _parse_idr(lim_m.group(1))

    # Debit balance + overdue on same data row
    # "Total Debit Balance Total Overdue Currency\n{balance} {overdue} Indonesian Rupiah"
    dbo_m = re.search(
        r"Total\s+Debit\s+Balance\s+Total\s+Overdue[^\n]*\n\s*([\d.,]+)\s+(\d[\d.,]*)",
        block, re.IGNORECASE,
    )
    if dbo_m:
        report.total_debit_balance = _parse_idr(dbo_m.group(1))
        report.total_overdue = _parse_idr(dbo_m.group(2))
    else:
        bal_m = re.search(r"Total\s+Debit\s+Balance\s+([\d.,]+)", block, re.IGNORECASE)
        if bal_m:
            report.total_debit_balance = _parse_idr(bal_m.group(1))
        ov_m = re.search(r"Total\s+Overdue\s+(\d[\d.,]*)", block, re.IGNORECASE)
        if ov_m:
            report.total_overdue = _parse_idr(ov_m.group(1))


def _extract_provider(body: str) -> str:
    """
    Extract provider / kreditur name from a contract detail block.
    Provider names follow the pattern:
      [Provider Type] PT Something Name  [Contract Code 7+ chars]  [Role]
    They may wrap across lines, e.g.:
      Conventional Commercial PT Bank Central Asia  Code No.  Date
      Bank Tbk J03129858 - -
    """
    # Look for PT/BPR/Bank... company name; stop at contract code or keywords.
    # Use [A-Z]\d{6,} to match contract codes (e.g. "T49286153") only — avoids
    # false stops on normal words when re.IGNORECASE would make [A-Z0-9]{7,} match
    # any 7-letter word like "Indonesia", "Central", "Finance".
    prov_m = re.search(
        r"\b(PT\.?\s+[A-Z][A-Za-z\s&.,\-]+?)\s+(?:Code\b|[A-Z]\d{6,}|\d{7,}|Borrower\b|Guarantor\b)",
        body,
    )
    if prov_m:
        name = _clean(prov_m.group(1))
        # Check if "Tbk" or "Persero" appears in the next ~120 chars (second line continuation)
        suffix_m = re.search(
            r"\b(Tbk|Persero|Syariah)\b",
            body[prov_m.end():prov_m.end() + 120],
            re.IGNORECASE,
        )
        if suffix_m and suffix_m.group(1).lower() not in name.lower():
            name = name + " " + suffix_m.group(1)
        return name

    # Fallback: BPR or Bank without PT prefix
    bpr_m = re.search(
        r"\b((?:BPR|Bank)\s+[A-Z][A-Za-z\s.&,\-]{3,60}?)\s+(?:[A-Z]\d{6,}|\d{7,}|Borrower\b)",
        body,
    )
    if bpr_m:
        return _clean(bpr_m.group(1))

    return ""


def _parse_contracts(text: str, report: ClickReport) -> None:
    """
    Split on "Detail of Credit / Financing N: Type - Phase" markers.
    Each body contains provider info, dates, credit/debit amounts, interest, worst status.
    """
    splits = re.split(
        r"(Detail\s+of\s+Credit\s*/\s*Financing\s+\d+\s*:[^\n]+)",
        text, flags=re.IGNORECASE,
    )

    # splits[0] = pre-detail text, then alternating [header, body, header, body, ...]
    i = 1
    while i < len(splits) - 1:
        header_line = _clean(splits[i])
        body = splits[i + 1]
        i += 2

        # Parse contract type and phase from header
        hm = re.match(
            r"Detail\s+of\s+Credit\s*/\s*Financing\s+\d+\s*:\s*(.+?)\s*-\s*(Active|Closed(?:\s+in\s+Advance)?|Paid[\s\-]?off|Requested|Refused|Renounced)",
            header_line, re.IGNORECASE,
        )
        if not hm:
            continue

        jenis = _clean(hm.group(1))
        phase = _clean(hm.group(2)).lower()
        is_aktif = phase == "active"

        f = ClickFasilitas()
        f.jenis_kredit = jenis
        f.status = "aktif" if is_aktif else "selesai"

        # ── Provider (kreditur) ──────────────────────────────────────────
        f.kreditur = _extract_provider(body)

        # ── Start Date + Due Date ─────────────────────────────────────────
        # Layout: "Start Date  Due Date  Past Due Status  ...\n2024-02-16  2024-05-31  ..."
        dates_m = re.search(
            r"Start\s+Date\s+Due\s+Date[^\n]*\n\s*(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})",
            body, re.IGNORECASE,
        )
        if dates_m:
            f.tanggal_mulai = dates_m.group(1)
            f.tanggal_jatuh_tempo = dates_m.group(2)
        else:
            # Fallback: pick first two YYYY-MM-DD dates in the body
            all_dates = re.findall(r"\d{4}-\d{2}-\d{2}", body)
            if len(all_dates) >= 2:
                f.tanggal_mulai, f.tanggal_jatuh_tempo = all_dates[0], all_dates[1]
            elif all_dates:
                f.tanggal_mulai = all_dates[0]

        # ── Interest Rate ─────────────────────────────────────────────────
        # "Interest Rates 39.96 %" or "Interest Rate 0 %"
        rate_m = re.search(r"Interest\s+Rates?\s+([\d.,]+)\s*%", body, re.IGNORECASE)
        if rate_m:
            f.bunga = f"{rate_m.group(1)} %"

        # ── Credit Limit / Debit Balance block ───────────────────────────
        cldb_m = re.search(
            r"Credit\s+Limit/Debit\s+Balance\s*([\s\S]{0,500}?)(?:Overdue|Restructuring|$)",
            body, re.IGNORECASE,
        )
        if cldb_m:
            cldb = cldb_m.group(1)
            # Initial Credit Limit
            init_m = re.search(r"Initial\s+Credit\s+Limit\s+(?:IDR\s+)?([\d.,]+)", cldb, re.IGNORECASE)
            if init_m:
                f.plafon = _parse_idr(init_m.group(1))

            # Debit Balance — "Debit Balance\nIDR 11.204.275" or inline "Debit Balance IDR 11.204.275"
            # We look for the last occurrence (current debit balance, not historical)
            bal_m = re.findall(r"Debit\s+Balance\s+IDR\s+([\d.,]+)", cldb, re.IGNORECASE)
            if bal_m:
                f.baki_debet = _parse_idr(bal_m[-1])

        # ── Worst Status ──────────────────────────────────────────────────
        # Layout: "Worst Status  Worst Status Date\n- Current  2024-04-30"
        # or:     "Worst Status  ...\nCurrent  2024-04-30"
        ws_m = re.search(
            r"Worst\s+Status\s+Worst\s+Status\s+Date\s*\n\s*[-–]?\s*([A-Za-z][A-Za-z\s]*?)\s+\d{4}-\d{2}-\d{2}",
            body, re.IGNORECASE,
        )
        if ws_m:
            raw_status = _clean(ws_m.group(1))
            f.kualitas = _map_kualitas(raw_status) or raw_status
        else:
            # Fallback: old pattern
            ws2_m = re.search(r"Worst\s+Status\s+([\w\s()]+?)(?:\n|Worst\s+Status\s+Date)", body, re.IGNORECASE)
            if ws2_m:
                raw_status = _clean(ws2_m.group(1))
                f.kualitas = _map_kualitas(raw_status) or raw_status
            else:
                f.kualitas = "1" if is_aktif else "0"

        if is_aktif:
            report.fasilitas_aktif.append(f)
        else:
            report.fasilitas_selesai.append(f)
