"""
SLIK/IDEB Parser — OJK Sistem Layanan Informasi Keuangan
Extracts structured credit bureau data from IDEB PDF reports.
"""
from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class SlikFasilitas:
    kreditur: str = ""
    jenis_kredit: str = ""
    plafon: Optional[float] = None
    baki_debet: Optional[float] = None
    tanggal_mulai: str = ""
    tanggal_jatuh_tempo: str = ""
    bunga: str = ""
    kualitas: str = ""
    kualitas_history: list[str] = field(default_factory=list)  # 24-month grid
    agunan: str = ""
    penjamin: str = ""
    tipe_agunan: str = ""
    nilai_agunan: Optional[float] = None


@dataclass
class SlikDebitur:
    nama: str = ""
    no_identitas: str = ""
    npwp: str = ""
    tempat_lahir: str = ""
    tanggal_lahir: str = ""
    alamat: str = ""
    jenis_debitur: str = ""


@dataclass
class SlikReport:
    nomor_laporan: str = ""
    tanggal_laporan: str = ""
    tujuan_pembiayaan: str = ""
    pemohon: str = ""
    debitur: SlikDebitur = field(default_factory=SlikDebitur)
    total_plafon: Optional[float] = None
    total_baki_debet: Optional[float] = None
    jumlah_kreditur: int = 0
    jumlah_fasilitas: int = 0
    fasilitas: list[SlikFasilitas] = field(default_factory=list)
    raw_pages: int = 0


# ── helpers ──────────────────────────────────────────────────────────────────

def _clean(val: str) -> str:
    return " ".join(val.split()).strip()


def _parse_rupiah(text: str) -> Optional[float]:
    """Convert 'Rp 1.234.567,89' or '1.234.567' to float."""
    t = re.sub(r"[Rp\s]", "", text)
    t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def _extract_field(text: str, pattern: str, group: int = 1) -> str:
    m = re.search(pattern, text, re.IGNORECASE)
    return _clean(m.group(group)) if m else ""


def _extract_first(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        value = _extract_field(text, pattern)
        if value:
            return value
    return ""


def _extract_rupiah_field(text: str, label: str) -> Optional[float]:
    value = _extract_field(text, rf"{label}\s*(?:Rp\s*)?([\d.,]+)")
    return _parse_rupiah(value) if value else None


# ── main parser ───────────────────────────────────────────────────────────────

def parse_slik_pdf(file_path: str) -> SlikReport:
    report = SlikReport()

    with pdfplumber.open(file_path) as pdf:
        report.raw_pages = len(pdf.pages)
        full_text = ""
        page_texts: list[str] = []

        for page in pdf.pages:
            t = page.extract_text() or ""
            page_texts.append(t)
            full_text += "\n" + t

    _parse_header(full_text, report)
    _parse_debitur(full_text, report)
    _parse_ringkasan(full_text, report)
    _parse_fasilitas(page_texts, report)

    return report


def _parse_header(text: str, report: SlikReport) -> None:
    report.nomor_laporan = _extract_first(text, [
        r"\b(\d+/IDEB/\d+/\d{4})\b",
        r"(?:Nomor Laporan|No\.?\s*Laporan)\s*[:\-]?\s*([A-Z0-9\-/]+)",
    ])
    report.tanggal_laporan = _extract_first(text, [
        r"Tanggal\s+Permintaan\s*[:\-]?\s*([\d]{1,2}\s+[A-Za-z]+\s+\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)",
        r"(?:Tanggal Laporan|Tgl\.?\s*Laporan)\s*[:\-]?\s*([\d/ A-Za-z]+)",
    ])
    report.tujuan_pembiayaan = _extract_field(
        text, r"Tujuan\s*Pembiayaan\s*[:\-]?\s*(.+)"
    )
    report.pemohon = _extract_field(
        text, r"(?:Pelapor|Pemohon|Kreditur\s*Pemohon)\s*[:\-]?\s*(.+)"
    )


def _parse_debitur(text: str, report: SlikReport) -> None:
    d = report.debitur

    ideb_identity = re.search(
        r"Nama\s+Sesuai\s+Identitas.*?\n\s*"
        r"([A-Z][A-Z\s.'-]{3,}?)\s+NIK\s*/\s*([A-Z-]+)\s*/\s*([^/\n]+?)\s*/.*?\n\s*"
        r"(\d{12,20})(?:\s+\d{10,20})?\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        text,
        re.I | re.S,
    )
    if ideb_identity:
        d.nama = _clean(ideb_identity.group(1))
        d.no_identitas = _clean(ideb_identity.group(4))
        d.tempat_lahir = _clean(ideb_identity.group(3))
        d.tanggal_lahir = _clean(ideb_identity.group(5))

    if not d.nama:
        d.nama = _extract_first(text, [
            r"Nama\s+Sesuai\s+Identitas.*?\n\s*([A-Z][A-Z\s.'-]{3,}?)(?:\s+NIK\s*/|\s+\d{10,})",
            r"(?:Nama\s*Debitur|Nama\s*Lengkap)\s*[:\-]?\s*([A-Z][A-Za-z\s]+?)(?:\n|Nomor|No\.)",
            r"Nama\s*[:\-]?\s*([A-Z][A-Za-z\s]+?)(?:\n|No\.)",
        ])

    if not d.no_identitas:
        d.no_identitas = _extract_first(text, [
            r"\bNIK\s*/[^\n]*\n\s*(\d{12,20})",
            r"(?:No\.?\s*KTP|NIK|No\.?\s*Identitas)\s*[:\-]?\s*(\d[\d\s\-]+)",
            r"\b(\d{16})\b",
        ])
    d.npwp = _extract_field(text, r"NPWP\s*[:\-]?\s*([\d.\-]+)")
    if not d.tempat_lahir:
        d.tempat_lahir = _extract_field(
            text, r"(?:Tempat\s*Lahir|Tempat/Tgl\.?\s*Lahir)\s*[:\-]?\s*([A-Za-z\s]+?)(?:,|\n|Tgl)"
        )
    if not d.tanggal_lahir:
        d.tanggal_lahir = _extract_field(
            text, r"(?:Tanggal\s*Lahir|Tgl\.?\s*Lahir)\s*[:\-]?\s*([\d/ A-Za-z]+?)(?:\n|Alamat)"
        )
    d.alamat = _extract_field(text, r"Alamat\s*[:\-]?\s*(.+?)(?:\n\n|\nKota|\nKode)")
    d.jenis_debitur = _extract_field(
        text, r"(?:Jenis\s*Debitur|Tipe\s*Debitur)\s*[:\-]?\s*(.+?)(?:\n)"
    )


def _parse_ringkasan(text: str, report: SlikReport) -> None:
    report.total_plafon = _extract_rupiah_field(text, r"Plafon\s+Efektif") or report.total_plafon
    report.total_baki_debet = _extract_rupiah_field(text, r"Baki\s+Debet") or report.total_baki_debet

    if report.total_plafon is None:
        plafon_raw = _extract_field(
            text,
            r"(?:Total\s*Plafon|Jumlah\s*Plafon)\s*[:\-]?\s*([\d.,]+(?:\s*Rp)?[:\s]?[\d.,]+)"
        )
        if plafon_raw:
            report.total_plafon = _parse_rupiah(plafon_raw)

    if report.total_baki_debet is None:
        baki_raw = _extract_field(
            text,
            r"(?:Total\s*Baki\s*Debet|Jumlah\s*Baki\s*Debet)\s*[:\-]?\s*([\d.,]+)"
        )
        if baki_raw:
            report.total_baki_debet = _parse_rupiah(baki_raw)

    kreditur_raw = _extract_field(
        text, r"(?:Jumlah\s*Kreditur|Total\s*Kreditur)\s*[:\-]?\s*(\d+)"
    )
    if kreditur_raw:
        try:
            report.jumlah_kreditur = int(kreditur_raw)
        except ValueError:
            pass

    fasilitas_raw = _extract_field(
        text, r"(?:Jumlah\s*Fasilitas|Total\s*Fasilitas)\s*[:\-]?\s*(\d+)"
    )
    if fasilitas_raw:
        try:
            report.jumlah_fasilitas = int(fasilitas_raw)
        except ValueError:
            pass

    if not report.jumlah_kreditur:
        counts = re.search(
            r"Jumlah\s+Kreditur\s+Bank\s+Umum\s+(\d+)\s+BPR\s*/\s*BPRS\s+(\d+)\s+Lembaga\s+Pembiayaan\s+(\d+)\s+Lainnya\s+(\d+)",
            text,
            re.I,
        )
        if counts:
            report.jumlah_kreditur = sum(int(v) for v in counts.groups())


def _parse_fasilitas(page_texts: list[str], report: SlikReport) -> None:
    """Extract per-facility blocks. Each facility typically spans 1–3 pages."""
    current: Optional[SlikFasilitas] = None

    for page_text in page_texts:
        if _looks_like_ideb_facility_page(page_text):
            if current:
                report.fasilitas.append(current)
            current = _parse_ideb_facility_page(page_text)
            continue

        # Detect start of a new facility block
        if re.search(r"(?:Kreditur\s*[:\-]|KREDITUR\s*:)", page_text):
            if current:
                report.fasilitas.append(current)
            current = SlikFasilitas()
            current.kreditur = _extract_field(
                page_text,
                r"(?:Kreditur)\s*[:\-]?\s*([A-Za-z][A-Za-z0-9\s,\.]+?)(?:\n|Jenis)"
            )
            current.jenis_kredit = _extract_field(
                page_text,
                r"Jenis\s*(?:Kredit|Penggunaan)\s*[:\-]?\s*(.+?)(?:\n)"
            )
            plafon_str = _extract_field(
                page_text,
                r"(?:Plafon|Limit\s*Kredit)\s*[:\-]?\s*([\d.,]+)"
            )
            if plafon_str:
                current.plafon = _parse_rupiah(plafon_str)

            baki_str = _extract_field(
                page_text,
                r"(?:Baki\s*Debet|Outstanding)\s*[:\-]?\s*([\d.,]+)"
            )
            if baki_str:
                current.baki_debet = _parse_rupiah(baki_str)

            current.tanggal_mulai = _extract_field(
                page_text,
                r"(?:Tanggal\s*Mulai|Tgl\.?\s*Mulai)\s*[:\-]?\s*([\d/ A-Za-z]+?)(?:\n|Tgl|Jatuh)"
            )
            current.tanggal_jatuh_tempo = _extract_field(
                page_text,
                r"(?:Tanggal\s*Jatuh\s*Tempo|Tgl\.?\s*Jatuh\s*Tempo)\s*[:\-]?\s*([\d/ A-Za-z]+?)(?:\n)"
            )
            current.bunga = _extract_field(
                page_text,
                r"(?:Bunga|Suku\s*Bunga|Tingkat\s*Bunga)\s*[:\-]?\s*([\d.,]+\s*%?)(?:\n)"
            )
            current.kualitas = _extract_field(
                page_text,
                r"(?:Kualitas\s*Kredit|Kolektibilitas|Kol\.)\s*[:\-]?\s*(\d+\s*[–\-]?\s*\w+?)(?:\n)"
            )

            # 24-month quality history: sequence of digits like "1 1 2 1 1 1 ..."
            history_match = re.search(r"(?:Kualitas|Kolektibilitas).*?\n((?:\d\s*){6,24})", page_text, re.DOTALL)
            if history_match:
                current.kualitas_history = re.findall(r"\d", history_match.group(1))[:24]

            current.agunan = _extract_field(
                page_text,
                r"(?:Agunan|Jaminan)\s*[:\-]?\s*(.+?)(?:\n\n|\nNilai|\nPenjamin)"
            )
            nilai_str = _extract_field(
                page_text,
                r"Nilai\s*(?:Agunan|Jaminan)\s*[:\-]?\s*([\d.,]+)"
            )
            if nilai_str:
                current.nilai_agunan = _parse_rupiah(nilai_str)
            current.penjamin = _extract_field(
                page_text,
                r"Penjamin\s*[:\-]?\s*(.+?)(?:\n)"
            )

    if current:
        report.fasilitas.append(current)

    if not report.jumlah_fasilitas and report.fasilitas:
        report.jumlah_fasilitas = len(report.fasilitas)


def _looks_like_ideb_facility_page(text: str) -> bool:
    return (
        "Kredit/Pembiayaan" in text
        and "Pelapor" in text
        and "Baki Debet" in text
        and "Tanggal Update" in text
    )


def _parse_ideb_facility_page(text: str) -> SlikFasilitas:
    fasilitas = SlikFasilitas()

    header = _extract_field(
        text,
        r"Pelapor\s+Cabang\s+Baki\s+Debet\s+Tanggal\s+Update\s*\n(.+?)(?:\n[A-Z][a-z]{2}\s+\d{2}|\nKualitas)",
    )
    if header:
        fasilitas.kreditur = _clean(re.sub(r"\s+Rp\s+[\d.,]+.*$", "", header))
        baki = re.search(r"Rp\s*([\d.,]+)", header, re.I)
        if baki:
            fasilitas.baki_debet = _parse_rupiah(baki.group(1))

    if not fasilitas.kreditur:
        fasilitas.kreditur = _extract_field(text, r"\n\d{3,}\s*-\s*(.+?)\s+Rp\s*[\d.,]+")

    fasilitas.kualitas = _extract_field(
        text,
        r"No\s+Rekening\s+Kualitas\s+(.+?)(?:\n|Jumlah\s+Hari)",
    )
    fasilitas.jenis_kredit = _extract_field(
        text,
        r"Jenis\s+Kredit/Pembiayaan\s+(.+?)(?:\s+Nilai\s+Proyek|\n)",
    )
    fasilitas.plafon = _extract_rupiah_field(text, r"Plafon(?:\s+Awal)?")
    if fasilitas.baki_debet is None:
        fasilitas.baki_debet = _extract_rupiah_field(text, r"Baki\s+Debet")

    fasilitas.tanggal_mulai = _extract_field(
        text, r"Tanggal\s+Mulai\s+(.+?)(?:\n|Tunggakan|Tanggal\s+Jatuh)"
    )
    fasilitas.tanggal_jatuh_tempo = _extract_field(
        text, r"Tanggal\s+Jatuh\s+Tempo\s+(.+?)(?:\n|Frekuensi)"
    )
    fasilitas.bunga = _extract_field(
        text, r"Suku\s+Bunga/Imbalan\s+([\d.,]+\s*%)"
    )
    fasilitas.agunan = _extract_field(text, r"Agunan\s*(.+?)(?:\nPenjamin|\nNomor\s+Laporan)")
    fasilitas.penjamin = _extract_field(text, r"Penjamin\s*(.+?)(?:\nNomor\s+Laporan|\n)")

    history = re.findall(r"\b([1-5])\s*/\s*(?:\w+\s+\d{4}|[A-Za-z]{3}\s+\d{2})", text)
    if history:
        fasilitas.kualitas_history = history[:24]

    return fasilitas
