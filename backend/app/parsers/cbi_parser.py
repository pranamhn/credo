"""
CBI Parser — Credit Bureau Indonesia (KBIJ)
A1 Credit Report v1.1 — Laporan Informasi Kredit Badan Usaha

Strategy:
  Summary section (pages 1-8): extract_tables() for the 9-column facility tables.
  Section markers in page text determine aktif vs selesai.
  Payment history tables (pages 9+) are excluded.
"""
from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)

# Pages after this index are detail/history pages — skip for summary parsing.
_SUMMARY_PAGE_LIMIT = 8


@dataclass
class CbiFasilitas:
    kreditur: str = ""
    jenis_fasilitas: str = ""
    plafon: Optional[float] = None
    baki_debet: Optional[float] = None
    tunggakan: Optional[float] = None
    dpd: Optional[int] = None
    kolektabilitas: str = ""
    tanggal_mulai: str = ""
    tanggal_jatuh_tempo: str = ""
    suku_bunga: str = ""
    kolektabilitas_history: list[str] = field(default_factory=list)
    status: str = "aktif"


@dataclass
class CbiDebitur:
    nama: str = ""
    jenis_badan_usaha: str = ""
    npwp: str = ""
    alamat: str = ""
    kota: str = ""
    provinsi: str = ""


@dataclass
class CbiReport:
    tanggal_laporan: str = ""
    npwp_query: str = ""
    debitur: CbiDebitur = field(default_factory=CbiDebitur)
    total_plafon_aktif: Optional[float] = None
    total_baki_debet_aktif: Optional[float] = None
    jumlah_kreditur_aktif: int = 0
    jumlah_fasilitas_aktif: int = 0
    jumlah_kreditur_selesai: int = 0
    jumlah_fasilitas_selesai: int = 0
    fasilitas_aktif: list[CbiFasilitas] = field(default_factory=list)
    fasilitas_selesai: list[CbiFasilitas] = field(default_factory=list)
    raw_pages: int = 0


# ── helpers ───────────────────────────────────────────────────────────────────

def _clean(val: str) -> str:
    return " ".join(val.split()).strip()


def _parse_rupiah(text: str) -> Optional[float]:
    if not text:
        return None
    t = re.sub(r"[Rp\s]", "", text)
    t = t.replace(".", "").replace(",", ".")
    try:
        v = float(t)
        return v if v >= 0 else None
    except ValueError:
        return None


def _extract_field(text: str, pattern: str, group: int = 1) -> str:
    m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    return _clean(m.group(group)) if m else ""


def _extract_first(text: str, patterns: list[str]) -> str:
    for p in patterns:
        val = _extract_field(text, p)
        if val:
            return val
    return ""


def _cell(val) -> str:
    return _clean(val or "")


# ── main entry ────────────────────────────────────────────────────────────────

def parse_cbi_pdf(file_path: str) -> CbiReport:
    report = CbiReport()

    with pdfplumber.open(file_path) as pdf:
        report.raw_pages = len(pdf.pages)
        page_texts: list[str] = []

        # Collect per-page text and tables only for summary pages.
        summary_page_data: list[tuple[str, list]] = []

        for i, page in enumerate(pdf.pages):
            text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            page_texts.append(text)

            if i < _SUMMARY_PAGE_LIMIT:
                try:
                    tables = page.extract_tables({
                        "vertical_strategy":   "lines",
                        "horizontal_strategy": "lines",
                        "snap_tolerance":      4,
                        "join_tolerance":      4,
                        "edge_min_length":     10,
                    }) or []
                except Exception:
                    tables = []
                summary_page_data.append((text, tables))

    full_text = "\n".join(page_texts)

    _parse_header(full_text, report)
    _parse_debitur(full_text, report)
    _parse_summary_section(summary_page_data, report)

    # Derive totals from fasilitas list if summary rows didn't give them.
    if report.total_plafon_aktif is None and report.fasilitas_aktif:
        total = sum(f.plafon or 0 for f in report.fasilitas_aktif)
        if total > 0:
            report.total_plafon_aktif = total
    if report.total_baki_debet_aktif is None and report.fasilitas_aktif:
        total = sum(f.baki_debet or 0 for f in report.fasilitas_aktif)
        if total > 0:
            report.total_baki_debet_aktif = total

    # Fill counts if summary rows didn't provide them.
    if not report.jumlah_fasilitas_aktif:
        report.jumlah_fasilitas_aktif = len(report.fasilitas_aktif)
    if not report.jumlah_fasilitas_selesai:
        report.jumlah_fasilitas_selesai = len(report.fasilitas_selesai)
    if not report.jumlah_kreditur_aktif:
        report.jumlah_kreditur_aktif = len({f.kreditur for f in report.fasilitas_aktif if f.kreditur})
    if not report.jumlah_kreditur_selesai:
        report.jumlah_kreditur_selesai = len({f.kreditur for f in report.fasilitas_selesai if f.kreditur})

    return report


# ── header ────────────────────────────────────────────────────────────────────

def _parse_header(text: str, report: CbiReport) -> None:
    report.tanggal_laporan = _extract_first(text, [
        r"Tanggal\s*(?:Pembuatan|Laporan|Cetak|Permintaan)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})",
        r"Tanggal\s*(?:Pembuatan|Laporan|Cetak|Permintaan)\s*[:\-]?\s*(\d{1,2}[\s\-/][A-Za-z]+[\s\-/]\d{4})",
        r"Tanggal\s*(?:Pembuatan|Laporan|Cetak|Permintaan)\s*[:\-]?\s*(\d{1,2}[\s\-/]\d{1,2}[\s\-/]\d{4})",
    ])

    report.npwp_query = _extract_first(text, [
        r"NPWP\s*(?:yang\s*diminta|Debitur|:)?\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3})",
        r"(\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3})",
        r"NPWP\s*[:\-]?\s*0?(\d{15,16})",
        r"Nomor\s*Identitas\s*[:\-]?\s*0?(\d{15,16})",
    ])


# ── debitur ───────────────────────────────────────────────────────────────────

def _parse_debitur(text: str, report: CbiReport) -> None:
    d = report.debitur

    # Company identity block starts with "Informasi Debitur Badan Usaha"
    # Extract from that section to avoid picking up fields from pengurus/person blocks.
    badan_usaha_m = re.search(r"Informasi Debitur Badan Usaha[\s\S]{0,3000}", text, re.IGNORECASE)
    identity_text = badan_usaha_m.group(0) if badan_usaha_m else text

    d.nama = _extract_first(identity_text, [
        r"Nama\s+Badan\s+Usaha\s+([A-Z][A-Za-z0-9\s,\.&]+?)(?:\s+Jenis\s+Badan|\s+Tempat|\n)",
        r"Nama\s+(?:Badan\s+Usaha|Perusahaan)\s*[:\-]\s*([A-Z][A-Za-z0-9\s,\.&]+?)(?:\n|$)",
    ])

    d.jenis_badan_usaha = _extract_first(identity_text, [
        r"Jenis\s+Badan\s+Usaha\s+(.+?)(?:\s+Tempat|\n|$)",
        r"Jenis\s+(?:Badan\s+Usaha|Perusahaan)\s*[:\-]\s*(.+?)(?:\n|$)",
    ])

    d.npwp = _extract_first(identity_text, [
        r"NPWP\s+0?(\d{15,16})",
        r"NPWP\s*[:\-]?\s*0?(\d{15,16})",
    ])
    if not d.npwp and report.npwp_query:
        d.npwp = report.npwp_query

    d.alamat = _extract_first(identity_text, [
        r"Alamat dan Kontak\s*\nAlamat\s+([^\n]+?)(?:\s+Kelurahan|\s+Kecamatan|\n|$)",
        r"Alamat\s+((?:JALAN|JL\.?\s|GANG|PERUMAHAN|KOMPLEK|GRIYA|GG\.?\s|KP\.\s|DS\.\s)[^\n]+?)(?:\s+Kelurahan|\s+Kecamatan|\n|$)",
    ])
    d.kota = _extract_first(identity_text, [
        r"Kota/Kabupaten\s+(.+?)(?:\n)",
        r"Kota\s+(.+?)(?:\n)",
    ])
    # Provinsi is often absent or unreliable in CBI format; leave blank rather than misparse.
    d.provinsi = ""


# ── summary section parsing ───────────────────────────────────────────────────

# Headers that identify the 9-column facility summary table.
_FACILITY_TABLE_COLS = {"kreditur", "plafon", "baki", "kolektabilitas", "tunggakan"}

# The summary section ends before Penjamin / Agunan sections.
_PENJAMIN_RE = re.compile(r"Sebagai\s+Penjamin", re.IGNORECASE)
_AKTIF_RE    = re.compile(r"Fasillitas?\s+Kredit\s+Masih\s+Berjalan", re.IGNORECASE)
_SELESAI_RE  = re.compile(r"Fasillitas?\s+Kredit\s+Sudah\s+Selesai",  re.IGNORECASE)


def _is_facility_header(row: list) -> bool:
    """True if the row looks like a facility table header (kreditur + plafon as separate cells)."""
    if len(row) < 7:
        return False
    cells = [_cell(c).lower() for c in row]
    has_kreditur = any(c == "kreditur" or c.split() == ["kreditur"] for c in cells)
    has_plafon   = any(c == "plafon"   or c.split() == ["plafon"]   for c in cells)
    return has_kreditur and has_plafon


def _is_summary_row(row: list) -> bool:
    """True if the row is the summary total row (first two cells are small integers ≤ 999)."""
    cells = [_cell(c) for c in row]
    if len(cells) < 3:
        return False
    return (
        re.fullmatch(r"\d{1,3}", cells[0]) is not None
        and re.fullmatch(r"\d{1,3}", cells[1]) is not None
        and _parse_rupiah(cells[2]) is not None
        and (_parse_rupiah(cells[2]) or 0) > 1_000
    )


def _row_to_fasilitas(row: list, col: dict) -> Optional[CbiFasilitas]:
    """Convert a 9-column table row to CbiFasilitas. Returns None if row looks empty."""
    cells = [_cell(c) for c in row]
    if len(cells) < 5:
        return None

    def get(key: str) -> str:
        idx = col.get(key)
        return cells[idx] if idx is not None and idx < len(cells) else ""

    kreditur = get("kreditur")
    plafon   = _parse_rupiah(get("plafon"))

    # Skip rows with no meaningful content (e.g., page-break continuation rows).
    if not kreditur and plafon is None:
        return None

    f = CbiFasilitas()
    f.kreditur        = kreditur
    f.jenis_fasilitas = get("jenis")
    f.plafon          = plafon
    f.baki_debet      = _parse_rupiah(get("baki_debet"))
    f.tunggakan       = _parse_rupiah(get("tunggakan"))
    f.kolektabilitas  = get("kolektabilitas")
    f.tanggal_mulai   = get("tanggal_mulai")
    f.tanggal_jatuh_tempo = get("tanggal_jatuh_tempo")

    dpd_str = get("dpd")
    if dpd_str and re.fullmatch(r"\d{1,5}", dpd_str):
        try:
            f.dpd = int(dpd_str)
        except ValueError:
            pass

    return f


def _map_columns(header: list[str]) -> dict[str, int]:
    col: dict[str, int] = {}
    for i, h in enumerate(header):
        if not h:
            continue
        hl = h.lower()
        if "kreditur" in hl or "pelapor" in hl:
            col.setdefault("kreditur", i)
        elif "jenis" in hl or ("fasilitas" in hl and "kreditur" not in hl):
            col.setdefault("jenis", i)
        elif "plafon" in hl or "limit" in hl:
            col.setdefault("plafon", i)
        elif "baki" in hl or "outstanding" in hl:
            col.setdefault("baki_debet", i)
        elif "tunggakan" in hl or "arrear" in hl:
            col.setdefault("tunggakan", i)
        elif "dpd" in hl:
            col.setdefault("dpd", i)
        elif "kolekt" in hl or "kualitas" in hl:
            col.setdefault("kolektabilitas", i)
        elif "mulai" in hl or "awal" in hl:
            col.setdefault("tanggal_mulai", i)
        elif "jatuh" in hl or "tempo" in hl:
            col.setdefault("tanggal_jatuh_tempo", i)
    return col


def _parse_summary_section(
    summary_page_data: list[tuple[str, list]], report: CbiReport
) -> None:
    """
    Parse facility summary tables from the first few pages of the CBI report.

    The document structure across pages 1-8:
      - "Sebagai Debitur - Fasillitas Kredit Masih Berjalan" section (aktif)
        - 9-col table with header row + data rows, possibly split across pages
        - Summary row: [3, 16, total_plafon, ...]
      - "Sebagai Debitur - Fasillitas Kredit Sudah Selesai" section (selesai)
        - Same 9-col structure
        - Summary row: [7, 12, ...]
      - Agunan, Penjamin sections (skip)
    """
    # Determine overall aktif/selesai section boundaries from the combined text.
    combined_text = "\n".join(pt for pt, _ in summary_page_data)
    selesai_pos = (m.start() if (m := _SELESAI_RE.search(combined_text)) else None)

    # Build character offsets per page so we can locate tables in combined text.
    page_text_offsets: list[int] = []
    offset = 0
    for pt, _ in summary_page_data:
        page_text_offsets.append(offset)
        offset += len(pt) + 1  # +1 for the \n we join with

    # Track current section as we iterate tables in document order.
    # A 9-col table with a kreditur header is either aktif or selesai
    # depending on whether we've passed the "Sudah Selesai" marker.
    in_selesai = False
    current_col: dict[str, int] = {}  # column map for the current section
    done = False  # set True once we've seen the selesai summary row

    for pi, (page_text, tables) in enumerate(summary_page_data):
        if done:
            break
        page_offset = page_text_offsets[pi]

        for table in tables:
            if done or not table:
                break

            first_row = [_cell(c) for c in (table[0] or [])]

            # Does the table begin with a facility header row?
            if _is_facility_header(table[0] or []):
                current_col = _map_columns(first_row)
                if selesai_pos is not None and page_offset >= selesai_pos:
                    in_selesai = True
                data_rows = table[1:]
            else:
                # Headerless continuation — use existing column map.
                if selesai_pos is not None and page_offset >= selesai_pos:
                    in_selesai = True
                data_rows = table

            if not current_col:
                continue

            # Skip agunan/penjamin tables whose first row starts with a
            # registration number (7+ consecutive digits).
            if data_rows:
                first_data = [_cell(c) for c in (data_rows[0] or [])]
                if first_data and re.match(r"\d{7,}", first_data[0].replace(" ", "")):
                    continue

            for raw_row in data_rows:
                if raw_row is None:
                    continue
                row = [_cell(c) for c in raw_row]

                # Summary row — extract counts and totals, then advance section.
                if _is_summary_row(row):
                    try:
                        kred_count   = int(row[0])
                        fas_count    = int(row[1])
                        total_plafon = _parse_rupiah(row[2])
                        total_baki   = _parse_rupiah(row[3]) if len(row) > 3 else None
                    except (ValueError, IndexError):
                        continue

                    if in_selesai:
                        if not report.jumlah_kreditur_selesai:
                            report.jumlah_kreditur_selesai = kred_count
                        if not report.jumlah_fasilitas_selesai:
                            report.jumlah_fasilitas_selesai = fas_count
                        # Selesai summary row → everything after is agunan/penjamin.
                        done = True
                        break
                    else:
                        if not report.jumlah_kreditur_aktif:
                            report.jumlah_kreditur_aktif = kred_count
                        if not report.jumlah_fasilitas_aktif:
                            report.jumlah_fasilitas_aktif = fas_count
                        if report.total_plafon_aktif is None and total_plafon:
                            report.total_plafon_aktif = total_plafon
                        if report.total_baki_debet_aktif is None and total_baki:
                            report.total_baki_debet_aktif = total_baki
                        # Aktif summary row → switch to selesai section.
                        in_selesai = True
                    continue

                # Regular facility data row.
                f = _row_to_fasilitas(row, current_col)
                if f is None:
                    continue
                if not f.kreditur and not f.plafon:
                    continue

                f.status = "selesai" if in_selesai else "aktif"
                if in_selesai:
                    report.fasilitas_selesai.append(f)
                else:
                    report.fasilitas_aktif.append(f)
