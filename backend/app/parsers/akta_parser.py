"""
Akta Pendirian parser — Indonesian notarial deed for PT incorporation.

Extracts legal identity, shareholders, directors/commissioners, capital, and
business activity details from a scanned/text PDF deed. The parser is designed
for common notarial "Pendirian Perseroan Terbatas" layouts and keeps a forgiving
regex approach because wording and OCR quality vary between notaries.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import pdfplumber


@dataclass
class AktaParty:
    nama: str = ""
    tempat_lahir: str = ""
    tanggal_lahir: str = ""
    kewarganegaraan: str = ""
    pekerjaan: str = ""
    alamat: str = ""
    nik: str = ""


@dataclass
class AktaBusinessActivity:
    kode_kbli: str = ""
    uraian: str = ""


@dataclass
class AktaShareholder:
    nama: str = ""
    jumlah_saham: Optional[int] = None
    nilai_nominal: Optional[float] = None


@dataclass
class AktaOfficer:
    nama: str = ""
    jabatan: str = ""


@dataclass
class AktaReport:
    judul: str = ""
    nomor_akta: str = ""
    tanggal_akta: str = ""
    hari: str = ""
    waktu: str = ""

    notaris: str = ""
    kota_notaris: str = ""

    nama_perusahaan: str = ""
    domisili: str = ""
    jangka_waktu: str = ""
    maksud_tujuan: str = ""
    kegiatan_usaha: list[AktaBusinessActivity] = field(default_factory=list)

    modal_dasar: Optional[float] = None
    jumlah_saham_modal_dasar: Optional[int] = None
    nilai_nominal_per_saham: Optional[float] = None
    modal_ditempatkan_disetor: Optional[float] = None
    jumlah_saham_ditempatkan: Optional[int] = None

    penghadap: list[AktaParty] = field(default_factory=list)
    pemegang_saham: list[AktaShareholder] = field(default_factory=list)
    pengurus: list[AktaOfficer] = field(default_factory=list)
    saksi: list[AktaParty] = field(default_factory=list)

    raw_pages: int = 0


def parse_akta_pdf(file_path: str | Path) -> AktaReport:
    """Parse a PT incorporation deed PDF into an AktaReport."""
    path = Path(file_path)
    report = AktaReport()

    with pdfplumber.open(path) as pdf:
        report.raw_pages = len(pdf.pages)
        pages = [
            page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            for page in pdf.pages
        ]

    text = _normalize_text("\n".join(pages))
    _parse_header(text, report)
    _parse_company_identity(text, report)
    _parse_business_activities(text, report)
    _parse_capital(text, report)
    _parse_penghadap(text, report)
    _parse_shareholders(text, report)
    _parse_officers(text, report)
    _parse_witnesses(text, report)
    return report


def _parse_header(text: str, report: AktaReport) -> None:
    m = re.search(r"(PENDIRIAN\s+PERSEROAN\s+TERBATAS)", text, re.IGNORECASE)
    if m:
        report.judul = _title(_clean(m.group(1)))

    # Covers: "PT ... NOTARIS DAN PPAT Nomor : 113.-"
    m = re.search(r"Nomor\s*:\s*([0-9]+)\s*\.?-", text, re.IGNORECASE)
    if m:
        report.nomor_akta = m.group(1)

    m = re.search(
        r"Pada\s+hari\s+ini,\s*([A-Za-z]+)\s+tanggal\s+(\d{1,2}[-/]\d{1,2}[-/]\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        report.hari = _title(m.group(1))
        report.tanggal_akta = m.group(2)

    m = re.search(r"Pukul\s+([0-9.:]+)\s*WIB", text, re.IGNORECASE)
    if m:
        report.waktu = f"{m.group(1).replace('.', ':')} WIB"

    m = re.search(
        r"saya,\s+(.+?),\s*Sarjana\s+Hukum,\s*Notaris\s+di\s+([^,\n]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        report.notaris = _title(_clean(m.group(1)))
        report.kota_notaris = _title(_clean(m.group(2)))
    else:
        m = re.search(r"NOTARIS(?:\s+DAN\s+PPAT)?\s+([A-Z][A-Z .,&]+?)(?:\s+Pada|\s+Nomor)", text)
        if m:
            report.notaris = _title(_clean(m.group(1)))


def _parse_company_identity(text: str, report: AktaReport) -> None:
    m = re.search(r"Perseroan\s+terbatas\s+ini\s+bernama\s*:?\s*[-\s“\"]+(.+?)\s+[”\"]?\s*-+\s*\(selanjutnya", text, re.IGNORECASE | re.DOTALL)
    if m:
        report.nama_perusahaan = _normalize_company_name(m.group(1))
    else:
        m = re.search(r"PENDIRIAN\s+PERSEROAN\s+TERBATAS\s+(.+?)\s+NOTARIS", text, re.IGNORECASE | re.DOTALL)
        if m:
            report.nama_perusahaan = _normalize_company_name(m.group(1))

    m = re.search(r"berkedudukan\s+di\s+([A-Za-z ]+?)\s*(?:\.|-)", text, re.IGNORECASE)
    if m:
        report.domisili = _title(_clean(m.group(1)))

    m = re.search(r"Perseroan\s+didirikan\s+untuk\s+jangka\s+waktu\s+(.+?terbatas)", text, re.IGNORECASE | re.DOTALL)
    if m:
        report.jangka_waktu = _clean(m.group(1))

    m = re.search(r"Maksud\s+dan\s+tujuan\s+dari\s+Perseroan\s+ialah\s+(.+?)(?:\s+a\.|\s+2\.)", text, re.IGNORECASE | re.DOTALL)
    if m:
        report.maksud_tujuan = _clean(m.group(1))


def _parse_business_activities(text: str, report: AktaReport) -> None:
    known: set[str] = set()
    section = _slice_between(text, "Maksud dan tujuan", "Untuk mencapai maksud")
    if not section:
        section = _slice_between(text, "Pasal 3", "Pasal 4")
    if not section:
        section = text
    for m in re.finditer(r"(?:^|\n)\s*[a-z]\.\s+(.+?)\s*\((\d{5})\)", section, re.IGNORECASE | re.DOTALL):
        uraian = re.sub(r"\s+[a-z]\.\s+.*$", "", m.group(1), flags=re.IGNORECASE | re.DOTALL)
        uraian = _clean(uraian)
        kode = m.group(2)
        if kode in known:
            continue
        report.kegiatan_usaha.append(AktaBusinessActivity(kode_kbli=kode, uraian=uraian))
        known.add(kode)


def _parse_capital(text: str, report: AktaReport) -> None:
    m = re.search(
        r"Modal\s+dasar\s+Perseroan\s+berjumlah\s+Rp\.?\s*([\d.,]+).*?terbagi\s+atas\s+([\d.]+).*?saham.*?nominal\s+Rp\.?\s*([\d.,]+)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        report.modal_dasar = _parse_idr(m.group(1))
        report.jumlah_saham_modal_dasar = _parse_int(m.group(2))
        report.nilai_nominal_per_saham = _parse_idr(m.group(3))

    m = re.search(
        r"disetor\s+sebesar\s+.+?sejumlah\s+([\d.]+).*?saham.*?sebesar\s+Rp\.?\s*([\d.,]+)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        report.jumlah_saham_ditempatkan = _parse_int(m.group(1))
        report.modal_ditempatkan_disetor = _parse_idr(m.group(2))


def _parse_penghadap(text: str, report: AktaReport) -> None:
    section = _slice_between(text, "Berhadapan dengan saya", "Para penghadap dikenal")
    if not section:
        section = text[:5000]

    for block in _numbered_person_blocks(section):
        party = _parse_person_block(block)
        if party and party.nik:
            report.penghadap.append(party)


def _parse_shareholders(text: str, report: AktaReport) -> None:
    # Matches multi-line founder rows near "Untuk pertama kalinya..."
    pattern = re.compile(
        r"(?:^|\n)\s*[a-z]\.\s+Tuan\s+(.+?);.*?sejumlah\s+([\d.]+).*?saham.*?Rp\.?\s*([\d.,]+)",
        re.IGNORECASE | re.DOTALL,
    )
    known: set[str] = set()
    for m in pattern.finditer(text):
        nama = _title(_clean(m.group(1)))
        if nama in known:
            continue
        report.pemegang_saham.append(AktaShareholder(
            nama=nama,
            jumlah_saham=_parse_int(m.group(2)),
            nilai_nominal=_parse_idr(m.group(3)),
        ))
        known.add(nama)


def _parse_officers(text: str, report: AktaReport) -> None:
    section = _slice_between(text, "telah diangkat sebagai", "Pengangkatan anggota")
    if not section:
        section = text
    known: set[tuple[str, str]] = set()
    for m in re.finditer(r"(Direktur|Komisaris)\s*:\s*Tuan\s+(.+?);", section, re.IGNORECASE | re.DOTALL):
        jabatan = _title(_clean(m.group(1)))
        nama = _title(_clean(m.group(2)))
        key = (nama, jabatan)
        if key not in known:
            report.pengurus.append(AktaOfficer(nama=nama, jabatan=jabatan))
            known.add(key)


def _parse_witnesses(text: str, report: AktaReport) -> None:
    section = _slice_between(text, "dihadiri oleh", "Keduanya sebagai saksi")
    if not section:
        return
    for block in _numbered_person_blocks(section):
        party = _parse_person_block(block)
        if party and party.nik:
            report.saksi.append(party)


def _numbered_person_blocks(section: str) -> list[str]:
    matches = list(re.finditer(r"(?:^|\n)\s*\d+\.\s+(?=Tuan|Nona|Nyonya)", section, re.IGNORECASE))
    blocks: list[str] = []
    for idx, match in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(section)
        blocks.append(section[match.end():end])
    return blocks


def _parse_person_block(block: str) -> Optional[AktaParty]:
    m = re.search(
        r"(Tuan|Nona|Nyonya)\s+(.+?),\s+lahir\s+di\s+(.+?)(?:,|\s+pada)\s+(?:pada\s+)?tanggal\s+"
        r"[-\s]*(\d{1,2}(?:[-/\s]+)\d{1,2}(?:[-/\s]+)\d{4}).+?Warga\s+Negara\s+(.+?),\s+(.+?),\s+bertempat\s+tinggal\s+di\s+"
        r"(.+?)\s+(?:pemegang|Pemegang)\s+Nomor\s+Induk\s+Kependudukan\s+\(NIK\)\s*:\s*([\d\s]+)",
        block,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return None
    return AktaParty(
        nama=_title(_clean(m.group(2))),
        tempat_lahir=_title(_clean(m.group(3))),
        tanggal_lahir=_clean_date(m.group(4)),
        kewarganegaraan=_title(_clean(m.group(5))),
        pekerjaan=_title(_clean(m.group(6))),
        alamat=_clean(m.group(7)),
        nik=re.sub(r"\D", "", m.group(8)),
    )


def _slice_between(text: str, start: str, end: str) -> str:
    s = re.search(re.escape(start), text, re.IGNORECASE)
    if not s:
        return ""
    e = re.search(re.escape(end), text[s.end():], re.IGNORECASE)
    return text[s.end():s.end() + e.start()] if e else text[s.end():]


def _normalize_text(text: str) -> str:
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(r"-{2,}", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _normalize_company_name(value: str) -> str:
    value = re.sub(r"[“”\"']", " ", value)
    value = re.sub(r"\s*-+\s*", " ", value)
    return _title(_clean(value))


def _clean(value: str) -> str:
    value = re.sub(r"\s*-\s*(?:\n|\r)?", " ", value)
    return " ".join(value.split()).strip(" .;-")


def _clean_date(value: str) -> str:
    parts = re.findall(r"\d+", value)
    if len(parts) >= 3:
        return f"{parts[0].zfill(2)}-{parts[1].zfill(2)}-{parts[2]}"
    return _clean(value)


def _title(value: str) -> str:
    upper_words = {"PT", "CV", "UD", "Tbk", "NIK", "WIB", "SH", "S.H."}
    words = []
    for word in _clean(value).split():
        stripped = word.strip(",.;")
        if stripped.upper() in {w.upper() for w in upper_words}:
            words.append(stripped.upper().replace("S.H.", "S.H."))
        else:
            words.append(stripped[:1].upper() + stripped[1:].lower())
    return " ".join(words)


def _parse_idr(raw: str) -> Optional[float]:
    cleaned = re.sub(r"[^\d,]", "", raw).replace(",", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_int(raw: str) -> Optional[int]:
    cleaned = re.sub(r"\D", "", raw)
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse Akta Pendirian PDF")
    parser.add_argument("pdf", type=Path)
    args = parser.parse_args()
    print(json.dumps(asdict(parse_akta_pdf(args.pdf)), ensure_ascii=False, indent=2))
