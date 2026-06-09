"""
NIB (Nomor Induk Berusaha) parser — OSS Perizinan Berusaha Berbasis Risiko.

Extracts main NIB details and KBLI entries from the multi-page PDF
issued by the Indonesian OSS (Online Single Submission) system.

Expected structure:
  Page 1   — main NIB document (NIB number, company name, address, dates)
  Page 2+  — KBLI appendix table (kode, judul, lokasi, risiko, perizinan)
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import pdfplumber


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class KbliEntry:
    no: int = 0
    kode: str = ""
    judul: str = ""
    lokasi: str = ""
    kode_pos: str = ""
    tingkat_risiko: str = ""
    jenis_perizinan: list[str] = field(default_factory=list)
    status_perizinan: list[str] = field(default_factory=list)


@dataclass
class NibReport:
    nib_number: str = ""
    nama_pelaku_usaha: str = ""
    alamat_kantor: str = ""
    kode_pos: str = ""
    telepon: str = ""
    email: str = ""
    status_penanaman_modal: str = ""
    tanggal_terbit: str = ""
    tanggal_perubahan: str = ""
    tanggal_cetak: str = ""
    kbli_entries: list[KbliEntry] = field(default_factory=list)
    raw_pages: int = 0


# ── Public API ────────────────────────────────────────────────────────────────

def parse_nib_pdf(file_path: str | Path) -> NibReport:
    """Parse an OSS NIB PDF into a structured NibReport."""
    path = Path(file_path)
    report = NibReport()

    with pdfplumber.open(path) as pdf:
        report.raw_pages = len(pdf.pages)

        page0_text = pdf.pages[0].extract_text(x_tolerance=3, y_tolerance=3) or ""
        _parse_main_page(page0_text, report)

        for page in pdf.pages[1:]:
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })
            if tables:
                for table in tables:
                    _ingest_kbli_table(table, report)
            else:
                page_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                _parse_kbli_text(page_text, report)

    return report


# ── Main-page parser ──────────────────────────────────────────────────────────

def _parse_main_page(text: str, report: NibReport) -> None:
    m = re.search(r"NOMOR\s+INDUK\s+BERUSAHA[:\s]+(\d[\d\s]*\d)", text, re.IGNORECASE)
    if m:
        report.nib_number = re.sub(r"\s+", "", m.group(1))

    m = re.search(r"Nama\s+Pelaku\s+Usaha\s*:\s*(.+?)(?:\n|2\.)", text)
    if m:
        report.nama_pelaku_usaha = _clean(m.group(1))

    m = re.search(r"Alamat\s+Kantor\s*:\s*(.+?)(?=\s*Kode\s+Pos\s*:)", text, re.DOTALL)
    if m:
        report.alamat_kantor = _clean(m.group(1))

    m = re.search(r"Kode\s+Pos\s*:\s*(\d+)", text)
    if m:
        report.kode_pos = m.group(1)

    m = re.search(r"No\.\s*Telepon\s*:\s*(\S+)", text)
    if m:
        report.telepon = m.group(1)

    m = re.search(r"Email\s*:\s*([\w.+\-]+@[\w.\-]+)", text)
    if m:
        report.email = m.group(1)

    m = re.search(r"Status\s+Penanaman\s+Modal\s*:\s*(\S+)", text)
    if m:
        report.status_penanaman_modal = m.group(1)

    m = re.search(r"Diterbitkan\s+di\s+\w+,\s*tanggal\s*:\s*(.+?)(?:\n|Perubahan)", text)
    if m:
        report.tanggal_terbit = _clean(m.group(1))

    for m in re.finditer(r"Perubahan\s+ke-\d+,\s*tanggal\s*:\s*(.+?)(?:\n|$)", text):
        report.tanggal_perubahan = _clean(m.group(1))

    m = re.search(r"Dicetak\s+tanggal\s*:\s*(.+?)(?:\n|$)", text)
    if m:
        report.tanggal_cetak = _clean(m.group(1))


# ── KBLI table parser ─────────────────────────────────────────────────────────

def _ingest_kbli_table(table: list[list[str | None]], report: NibReport) -> None:
    """Process rows from pdfplumber table extraction.

    OSS NIB tables come in two layouts across pages:
      - Page 2: leading None column  → data starts at index 1
      - Page 3: no leading column    → data starts at index 0
    Offset is detected per-row.
    """
    known = {e.kode for e in report.kbli_entries}
    current: Optional[KbliEntry] = None

    for row in table:
        if not row:
            continue
        cells = [_clean(c or "") for c in row]
        if all(c == "" for c in cells):
            continue

        # Continuation row: first 4+ cells empty, only license columns have data
        if _is_continuation_row(cells):
            if current is not None:
                non_empty = [v for v in cells if v]
                jenis = non_empty[0] if len(non_empty) > 0 else ""
                status = non_empty[1] if len(non_empty) > 1 else ""
                if jenis and jenis not in current.jenis_perizinan:
                    current.jenis_perizinan.append(jenis)
                if status and status not in current.status_perizinan:
                    current.status_perizinan.append(status)
            continue

        offset = _detect_data_offset(cells)
        shifted = cells[offset:]
        if not shifted:
            continue

        first = shifted[0].lower()
        if first in ("no.", "no") or (len(shifted) > 1 and "kode kbli" in shifted[1].lower()):
            continue
        if first in ("jenis", "status", "keterangan", "perizinan berusaha"):
            continue

        if _looks_like_kbli_row_start(shifted):
            kode = shifted[1] if len(shifted) > 1 else ""
            no = int(shifted[0]) if shifted[0].isdigit() else 0
            judul = _get(shifted, 2)
            lokasi_raw = _get(shifted, 3)
            kode_pos_m = re.search(r"Kode\s+Pos[:\s]+(\d+)", lokasi_raw)
            lokasi = _clean(re.sub(r"Kode\s+Pos[:\s]+\d+", "", lokasi_raw))
            kode_pos = kode_pos_m.group(1) if kode_pos_m else ""
            risiko = _get(shifted, 4)
            jenis = _get(shifted, 5)
            status = _get(shifted, 6)

            if kode and kode not in known:
                entry = KbliEntry(
                    no=no, kode=kode, judul=judul,
                    lokasi=lokasi, kode_pos=kode_pos,
                    tingkat_risiko=risiko,
                    jenis_perizinan=[jenis] if jenis else [],
                    status_perizinan=[status] if status else [],
                )
                report.kbli_entries.append(entry)
                known.add(kode)
                current = entry


# ── KBLI text fallback ────────────────────────────────────────────────────────

_KBLI_LINE_RE = re.compile(
    r"^(\d+)\s+(\d{5})\s+(.+?)(?:\s{2,}|\t)(Rendah|Menengah\s+Tinggi|Tinggi)\s+",
    re.MULTILINE,
)

def _parse_kbli_text(text: str, report: NibReport) -> None:
    known = {e.kode for e in report.kbli_entries}
    for m in _KBLI_LINE_RE.finditer(text):
        kode = m.group(2)
        if kode not in known:
            rest = text[m.end():]
            jenis_m = re.match(r"(NIB|Sertifikat Standar|Izin\s*\w*)\s+(Terbit|Belum\s+\w+)", rest)
            entry = KbliEntry(
                no=int(m.group(1)),
                kode=kode,
                judul=_clean(m.group(3)),
                tingkat_risiko=_clean(m.group(4)),
                jenis_perizinan=[_clean(jenis_m.group(1))] if jenis_m else [],
                status_perizinan=[_clean(jenis_m.group(2))] if jenis_m else [],
            )
            report.kbli_entries.append(entry)
            known.add(kode)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_continuation_row(cells: list[str]) -> bool:
    """True when first 4+ cells are empty — only license-type columns carry data."""
    non_empty = [i for i, c in enumerate(cells) if c]
    return bool(non_empty) and non_empty[0] >= 4


def _detect_data_offset(cells: list[str]) -> int:
    for i, c in enumerate(cells):
        if c:
            return i
    return 0


def _looks_like_kbli_row_start(cells: list[str]) -> bool:
    return (
        len(cells) >= 2
        and cells[0].isdigit()
        and re.fullmatch(r"\d{5}", cells[1]) is not None
    )


def _get(cells: list[str], idx: int) -> str:
    return cells[idx] if idx < len(cells) else ""


def _clean(value: str) -> str:
    return " ".join(value.split()).strip()


# ── CLI ───────────────────────────────────────────────────────────────────────

def _main() -> None:
    parser = argparse.ArgumentParser(description="Parse OSS NIB PDF.")
    parser.add_argument("pdf", help="Path to NIB PDF file")
    args = parser.parse_args()
    report = parse_nib_pdf(args.pdf)
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
