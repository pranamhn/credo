"""
CLICK Parser — PT. CRIF Lembaga Informasi Keuangan
Individual credit report format (not corporate).

Strategy:
  Parse subject info, CB score, and contract summary from early pages.
  Extract each "Detail of Credit / Financing N: Type - Phase" section
  for per-facility data (provider, dates, interest rate, debit balance).
"""
from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)


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


def _extract(text: str, pattern: str, group: int = 1) -> str:
    m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    return _clean(m.group(group)) if m else ""


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
    m = re.search(r"(?:Request\s+Date|CREDIT\s+REPORT\s+CREATED\s+ON)\s*[:\-]?\s*(\d{4}[-/]\d{2}[-/]\d{2})", text, re.IGNORECASE)
    if m:
        report.tanggal_laporan = m.group(1)


def _parse_subject(text: str, report: ClickReport) -> None:
    s = report.subject

    # Subject block follows "Subject Data" header
    m = re.search(r"Subject\s+Data\s*([\s\S]{0,1500}?)(?:Employment\s+Data|SHAREHOLDER|CB\s+SCORE)", text, re.IGNORECASE)
    block = m.group(1) if m else text[:2000]

    # Full Name / Name As Id
    name_m = re.search(r"Full\s+Name\s+([A-Z][A-Z0-9\s]{1,80}?)(?:\n|Mother)", block, re.IGNORECASE)
    if not name_m:
        name_m = re.search(r"Name\s+As\s+Id\s+([A-Z][A-Z0-9\s]{1,80}?)(?:\n|Full)", block, re.IGNORECASE)
    s.nama = _clean(name_m.group(1)) if name_m else ""

    # Date of Birth
    dob_m = re.search(r"Date\s+of\s+Birth\s+(\d{2}-\d{2}-\d{4})", block, re.IGNORECASE)
    s.tanggal_lahir = dob_m.group(1) if dob_m else ""

    # Place of Birth
    pob_m = re.search(r"Place\s+of\s+Birth\s+([A-Z][A-Z\s]{1,40}?)(?:\n|Marital)", block, re.IGNORECASE)
    s.tempat_lahir = _clean(pob_m.group(1)) if pob_m else ""

    # Gender
    gender_m = re.search(r"Gender\s+(Male|Female)", block, re.IGNORECASE)
    s.jenis_kelamin = gender_m.group(1) if gender_m else ""

    # ID Card
    id_m = re.search(r"ID\s+CARD\s*[:\s]+(\d{10,20})", text, re.IGNORECASE)
    s.no_identitas = id_m.group(1) if id_m else ""


def _parse_score(text: str, report: ClickReport) -> None:
    # CB SCORE section: Score NNN  Risk Grade XX
    score_m = re.search(r"Score\s+(\d{3,4})", text, re.IGNORECASE)
    if score_m:
        try:
            report.cb_score = int(score_m.group(1))
        except ValueError:
            pass

    grade_m = re.search(r"Risk\s+Grade\s+([A-Z][a-z]?)", text, re.IGNORECASE)
    report.risk_grade = grade_m.group(1) if grade_m else ""


def _parse_summary(text: str, report: ClickReport) -> None:
    # CONTRACT SUMMARY section
    m = re.search(r"CONTRACT\s+SUMMARY\s*([\s\S]{0,800}?)(?:CONTRACTS?\s+DETAILS?|Detail\s+of\s+Credit)", text, re.IGNORECASE)
    if not m:
        return
    block = m.group(1)

    contracts_m = re.search(r"Contracts\s+number\s+(\d+)", block, re.IGNORECASE)
    if contracts_m:
        try:
            report.jumlah_kontrak = int(contracts_m.group(1))
        except ValueError:
            pass

    providers_m = re.search(r"Reporting\s+Providers\s+Number\s+(\d+)", block, re.IGNORECASE)
    if providers_m:
        try:
            report.jumlah_kreditur = int(providers_m.group(1))
        except ValueError:
            pass

    limit_m = re.search(r"Total\s+Credit\s+Limit\s+([\d.,]+)", block, re.IGNORECASE)
    if limit_m:
        report.total_credit_limit = _parse_idr(limit_m.group(1))

    balance_m = re.search(r"Total\s+Debit\s+Balance\s+([\d.,]+)", block, re.IGNORECASE)
    if balance_m:
        report.total_debit_balance = _parse_idr(balance_m.group(1))

    overdue_m = re.search(r"Total\s+Overdue\s+(\d[\d.,]*)", block, re.IGNORECASE)
    if overdue_m:
        report.total_overdue = _parse_idr(overdue_m.group(1))


def _parse_contracts(text: str, report: ClickReport) -> None:
    """
    Split on "Detail of Credit / Financing N: Type - Phase" markers and
    parse each block independently.
    """
    # Split on detail section markers
    splits = re.split(
        r"(Detail\s+of\s+Credit\s*/\s*Financing\s+\d+\s*:[^\n]+)",
        text,
        flags=re.IGNORECASE,
    )

    # splits[0] = pre-detail text, then alternating [header, body, header, body, ...]
    i = 1
    while i < len(splits) - 1:
        header_line = _clean(splits[i])
        body = splits[i + 1]
        i += 2

        # Parse contract type and phase from header
        hm = re.match(
            r"Detail\s+of\s+Credit\s*/\s*Financing\s+\d+\s*:\s*(.+?)\s*-\s*(Active|Closed|Paid\s*off|Requested|Refused|Renounced)",
            header_line,
            re.IGNORECASE,
        )
        if not hm:
            continue

        jenis = _clean(hm.group(1))
        phase = _clean(hm.group(2)).lower()
        is_aktif = phase == "active"

        f = ClickFasilitas()
        f.jenis_kredit = jenis
        f.status = "aktif" if is_aktif else "selesai"

        # Provider
        prov_m = re.search(
            r"Provider\s*\n([^\n]{3,80})",
            body,
        )
        if prov_m:
            f.kreditur = _clean(prov_m.group(1))
        # Fallback: "Provider PT Something" on same line
        if not f.kreditur:
            prov2_m = re.search(r"Provider\s+(PT\.?\s+[^\n]{3,60}|CV\s+[^\n]{3,60})", body, re.IGNORECASE)
            if prov2_m:
                f.kreditur = _clean(prov2_m.group(1))

        # Dates
        start_m = re.search(r"Start\s+Date\s+(\d{4}-\d{2}-\d{2})", body, re.IGNORECASE)
        f.tanggal_mulai = start_m.group(1) if start_m else ""

        due_m = re.search(r"Due\s+Date\s+(\d{4}-\d{2}-\d{2})", body, re.IGNORECASE)
        f.tanggal_jatuh_tempo = due_m.group(1) if due_m else ""

        # Interest Rate (in Granted Credits section)
        rate_m = re.search(r"Interest\s+Rate\s+([\d.]+)\s*%", body, re.IGNORECASE)
        f.bunga = f"{rate_m.group(1)} %" if rate_m else ""

        # Credit Limit / Debit Balance block
        cldb_m = re.search(
            r"Credit\s+Limit/Debit\s+Balance\s*([\s\S]{0,400}?)(?:Overdue|Restructuring|$)",
            body,
            re.IGNORECASE,
        )
        if cldb_m:
            cldb = cldb_m.group(1)
            init_m = re.search(r"Initial\s+Credit\s+Limit\s+IDR\s+([\d.,]+)", cldb, re.IGNORECASE)
            if init_m:
                f.plafon = _parse_idr(init_m.group(1))

            # Debit Balance is last "IDR N" in the block
            bal_m = re.findall(r"Debit\s+Balance\s+IDR\s+([\d.,]+)", cldb, re.IGNORECASE)
            if bal_m:
                f.baki_debet = _parse_idr(bal_m[-1])

        # Worst Status → kualitas
        ws_m = re.search(r"Worst\s+Status\s+([\w\s()]+?)(?:\n|Worst\s+Status\s+Date)", body, re.IGNORECASE)
        f.kualitas = _clean(ws_m.group(1)) if ws_m else ("Current" if is_aktif else "Paid off")

        if is_aktif:
            report.fasilitas_aktif.append(f)
        else:
            report.fasilitas_selesai.append(f)
