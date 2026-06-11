"""
AHU (Administrasi Hukum Umum) parser — SK Kemenkumham Pengesahan Badan Hukum PT.

Extracts structured data from the Surat Keputusan (SK) issued by the Indonesian
Ministry of Law and Human Rights (Kemenkumham) for PT (Perseroan Terbatas) incorporation.

Expected structure:
  Page 0  — Main SK: SK number, company name, domicile, akta details, notaris,
             jenis perseroan, tanggal penetapan, daftar perseroan number.
  Page 1  — Appendix: modal dasar, modal ditempatkan, shareholder/director table.

Tested against: OSS-generated AHU SK PDFs, 2-page format (2023–present).
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
class Pemegang:
    nama: str = ""
    jabatan: str = ""              # DIREKTUR, KOMISARIS, DIREKTUR UTAMA, etc.
    klasifikasi_saham: str = ""
    jumlah_lembar: Optional[int] = None
    total_nilai: Optional[float] = None


@dataclass
class AhuReport:
    # Main SK fields
    nomor_sk: str = ""             # AHU-XXXXXXXX.AH.01.01.TAHUN XXXX
    nama_perusahaan: str = ""
    domisili: str = ""             # Kota domisili (e.g. "JAKARTA UTARA")
    jenis_perseroan: str = ""      # SWASTA NASIONAL, PMA, etc.

    # Akta fields
    nomor_akta: str = ""           # e.g. "113"
    tanggal_akta: str = ""         # e.g. "27 Juni 2023"
    notaris: str = ""
    kota_notaris: str = ""
    nomor_pendaftaran: str = ""    # Nomor Pendaftaran OSS

    # Dates
    tanggal_penetapan: str = ""    # Ditetapkan di Jakarta, Tanggal ...
    tanggal_cetak: str = ""        # DICETAK PADA TANGGAL ...

    # Daftar Perseroan
    nomor_daftar_perseroan: str = ""  # AHU-XXXXXXXX.AH.01.11.TAHUN XXXX

    # Appendix — modal & shareholders
    modal_dasar: Optional[float] = None
    modal_ditempatkan: Optional[float] = None
    modal_disetor: Optional[float] = None  # often same as modal_ditempatkan
    pemegang_saham: list[Pemegang] = field(default_factory=list)

    raw_pages: int = 0


# ── Public API ────────────────────────────────────────────────────────────────

def parse_ahu_pdf(file_path: str | Path) -> AhuReport:
    """Parse a Kemenkumham AHU SK PDF into a structured AhuReport."""
    path = Path(file_path)
    report = AhuReport()

    with pdfplumber.open(path) as pdf:
        report.raw_pages = len(pdf.pages)

        # Page 0 — main SK
        page0_text = pdf.pages[0].extract_text(x_tolerance=3, y_tolerance=3) or ""
        _parse_main_page(page0_text, report)

        # Page 1+ — appendix (modal & shareholders)
        for page in pdf.pages[1:]:
            page_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })
            # Parse modal from text
            _parse_modal(page_text, report)
            # Parse shareholders: try table first, fallback to text
            if tables and _has_shareholder_data(tables):
                _ingest_shareholder_table(tables, report)
            # Always run text fallback to catch rows missed by table extractor
            _parse_shareholders_text(page_text, report)

    return report


# ── Main-page parser ──────────────────────────────────────────────────────────

def _parse_main_page(text: str, report: AhuReport) -> None:
    # SK number — e.g. "NOMOR AHU-0046985.AH.01.01.TAHUN 2023"
    m = re.search(r"NOMOR\s+(AHU-[\w.]+TAHUN\s*\d{4})", text, re.IGNORECASE)
    if m:
        report.nomor_sk = _clean(m.group(1))

    # Company name — after "PERSEROAN TERBATAS\n"
    m = re.search(r"PERSEROAN\s+TERBATAS\s*\n\s*(.+)", text, re.IGNORECASE)
    if m:
        report.nama_perusahaan = _clean(m.group(1))

    # Domisili — "berkedudukan di XXXX"
    m = re.search(r"berkedudukan\s+di\s+([A-Z][A-Z ]+?)(?:\s+karena|\s+yang\s+telah)", text)
    if m:
        report.domisili = _clean(m.group(1))

    # Jenis perseroan — "Jenis Perseroan SWASTA NASIONAL"
    m = re.search(r"Jenis\s+Perseroan\s+([A-Z][A-Z ]+?)(?:\n|\.)", text)
    if m:
        report.jenis_perseroan = _clean(m.group(1))

    # Akta number and date — "salinan Akta Nomor 113 Tanggal 27 Juni 2023"
    m = re.search(r"salinan\s+Akta\s+Nomor\s+(\d+)\s+Tanggal\s+(.+?)(?:\s+yang\s+dibuat|\s+tentang)", text)
    if m:
        report.nomor_akta = m.group(1).strip()
        report.tanggal_akta = _clean(m.group(2))

    # Notaris — from "Permohonan Notaris XXXX S.H.," on first mention line
    m = re.search(r"Permohonan\s+Notaris\s+(.+?S\.H\.)", text, re.IGNORECASE | re.DOTALL)
    if m:
        report.notaris = _clean(m.group(1))
    # Kota notaris — "yang berkedudukan di KOTA DEPOK"
    m2 = re.search(r"S\.H\.,?\s*yang\s+berkedudukan\s+di\s+([A-Z ]+?)(?:\.|$)", text)
    if m2:
        report.kota_notaris = _clean(m2.group(1))

    # Nomor pendaftaran
    m = re.search(r"Nomor\s+Pendaftaran\s+(\d+)", text)
    if m:
        report.nomor_pendaftaran = m.group(1).strip()

    # Tanggal penetapan — "Ditetapkan di Jakarta, Tanggal DD Bulan YYYY"
    m = re.search(r"Ditetapkan\s+di\s+\w+,\s*Tanggal\s+(.+?)(?:\n|a\.n\.)", text)
    if m:
        report.tanggal_penetapan = _clean(m.group(1)).rstrip(".")

    # Tanggal cetak
    m = re.search(r"DICETAK\s+PADA\s+TANGGAL\s+(.+?)(?:\n|DAFTAR)", text)
    if m:
        report.tanggal_cetak = _clean(m.group(1))

    # Nomor daftar perseroan — "DAFTAR PERSEROAN NOMOR AHU-XXXX..."
    m = re.search(r"DAFTAR\s+PERSEROAN\s+NOMOR\s+(AHU-[\w.]+TAHUN\s*\d{4})", text, re.IGNORECASE)
    if m:
        report.nomor_daftar_perseroan = _clean(m.group(1))


# ── Modal parser (appendix page) ─────────────────────────────────────────────

_IDR_RE = re.compile(r"Rp\.?\s*([\d.,]+)", re.IGNORECASE)


def _parse_modal(text: str, report: AhuReport) -> None:
    m = re.search(r"Modal\s+Dasar\s*:\s*Rp\.?\s*([\d.,]+)", text, re.IGNORECASE)
    if m:
        report.modal_dasar = _parse_idr(m.group(1))

    m = re.search(r"Modal\s+Ditempatkan\s*:\s*Rp\.?\s*([\d.,]+)", text, re.IGNORECASE)
    if m:
        report.modal_ditempatkan = _parse_idr(m.group(1))

    m = re.search(r"Modal\s+Disetor\s*:\s*Rp\.?\s*([\d.,]+)", text, re.IGNORECASE)
    if m:
        report.modal_disetor = _parse_idr(m.group(1))


# ── Shareholders: table extraction ───────────────────────────────────────────

def _has_shareholder_data(tables: list) -> bool:
    for table in tables:
        for row in table:
            if row and any(
                cell and re.search(r"DIREKTUR|KOMISARIS|SAHAM", str(cell), re.IGNORECASE)
                for cell in row
            ):
                return True
    return False


def _ingest_shareholder_table(tables: list, report: AhuReport) -> None:
    known = {p.nama for p in report.pemegang_saham}
    for table in tables:
        for row in table:
            if not row:
                continue
            cells = [_clean(str(c or "")) for c in row]
            # Skip header row
            if any(h in cells[0].lower() for h in ("nama", "jabatan", "klasifikasi")):
                continue
            # Must have at least nama + jabatan
            if len(cells) < 2:
                continue
            nama = cells[0]
            jabatan = cells[1] if len(cells) > 1 else ""
            if not nama or not jabatan:
                continue
            if not re.search(r"DIREKTUR|KOMISARIS|PRESIDEN|SEKRETARIS", jabatan, re.IGNORECASE):
                continue
            if nama in known:
                continue

            klasif = cells[2] if len(cells) > 2 else ""
            lembar_str = cells[3] if len(cells) > 3 else ""
            total_str = cells[4] if len(cells) > 4 else ""

            lembar = int(re.sub(r"[^\d]", "", lembar_str)) if re.search(r"\d", lembar_str) else None
            total = _parse_idr(total_str) if "Rp" in total_str else None

            report.pemegang_saham.append(Pemegang(
                nama=nama,
                jabatan=jabatan,
                klasifikasi_saham=klasif if klasif != "-" else "",
                jumlah_lembar=lembar,
                total_nilai=total,
            ))
            known.add(nama)


# ── Shareholders: text fallback ───────────────────────────────────────────────

# Matches: "RADIUS SAPUTRA DIREKTUR - 660 Rp. 660.000.000"
_PEMEGANG_LINE_RE = re.compile(
    r"^([A-Z][A-Z .,]+?)\s+"
    r"(DIREKTUR UTAMA|DIREKTUR|KOMISARIS UTAMA|KOMISARIS|PRESIDEN DIREKTUR|WAKIL DIREKTUR|"
    r"SEKRETARIS PERUSAHAAN)\s+"
    r"(-|[A-Z]+)?\s*"
    r"(\d+)\s+"
    r"Rp\.?\s*([\d.,]+)",
    re.MULTILINE | re.IGNORECASE,
)


def _parse_shareholders_text(text: str, report: AhuReport) -> None:
    known = {p.nama for p in report.pemegang_saham}
    for m in _PEMEGANG_LINE_RE.finditer(text):
        nama = _clean(m.group(1))
        jabatan = _clean(m.group(2)).upper()
        if nama in known or not nama:
            continue
        klasif = m.group(3).strip() if m.group(3) and m.group(3).strip() != "-" else ""
        lembar = int(m.group(4))
        total = _parse_idr(m.group(5))
        report.pemegang_saham.append(Pemegang(
            nama=nama,
            jabatan=jabatan,
            klasifikasi_saham=klasif,
            jumlah_lembar=lembar,
            total_nilai=total,
        ))
        known.add(nama)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(value: str) -> str:
    return " ".join(value.split()).strip()


def _parse_idr(raw: str) -> Optional[float]:
    """Parse Indonesian currency string to float. '1.200.000.000' → 1200000000.0"""
    cleaned = re.sub(r"[^\d,]", "", raw)
    # IDR uses dot as thousands separator, comma as decimal (rare in SK docs)
    cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


# ── CLI ───────────────────────────────────────────────────────────────────────

def _main() -> None:
    parser = argparse.ArgumentParser(description="Parse Kemenkumham AHU SK PDF.")
    parser.add_argument("pdf", help="Path to AHU SK PDF file")
    args = parser.parse_args()
    report = parse_ahu_pdf(args.pdf)
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
