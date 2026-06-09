"""
PARSE-01 — Bank & Format Detector
Detects bank identity and PDF type (text-extractable vs scanned) from raw text.
"""
from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)

# Per-bank detection signatures: (keyword_patterns, bank_code, bank_name, weight)
BANK_SIGNATURES: list[tuple[list[str], str, str, float]] = [
    # P1 — top 5 banks
    (["PT BANK CENTRAL ASIA", "BANK BCA", "KLIKBCA", "BCA MOBILE", "MYCA", "E-STATEMENT", "ESTATEMENT"],
     "BCA", "Bank Central Asia", 1.0),
    (["PT BANK MANDIRI", "BANK MANDIRI", "LIVIN BY MANDIRI", "MANDIRI ONLINE",
      "KOPRA BY MANDIRI", "KOPRA", "MANDIRI"],
     "MDR", "Bank Mandiri", 1.0),
    (["PT BANK RAKYAT INDONESIA", "BANK BRI", "BRIMO", "INTERNET BANKING BRI", "IBBIZ", "BRITAMA"],
     "BRI", "Bank Rakyat Indonesia", 1.0),
    (["PT BANK NEGARA INDONESIA", "BANK BNI", "BNI MOBILE BANKING", "INTERNET BANKING BNI", "BNI DIRECT"],
     "BNI", "Bank Negara Indonesia", 1.0),
    (["PT BANK TABUNGAN NEGARA", "BANK BTN", "BTN MOBILE", "INTERNET BANKING BTN"],
     "BTN", "Bank Tabungan Negara", 1.0),
    # P2
    (["PT BANK SYARIAH INDONESIA", "BANK BSI", "BSI MOBILE", "BSIM"],
     "BSI", "Bank Syariah Indonesia", 0.9),
    (["PT BANK CIMB NIAGA", "CIMB NIAGA", "OCTO MOBILE", "CIMB CLICKS"],
     "CIMB", "CIMB Niaga", 0.9),
    (["PT BANK OCBC", "OCBC NISP", "OCBC INDONESIA", "OCBC MOBILE"],
     "OCBC", "OCBC Indonesia", 0.9),
    (["PT BANK DANAMON", "BANK DANAMON", "D-BANK"],
     "DNMN", "Bank Danamon", 0.9),
    (["PT BANK PERMATA", "BANK PERMATA", "PERMATANET", "PERMATA MOBILE X", "PERMATA"],
     "PRMT", "Bank Permata", 0.9),
    (["PT BANK PANIN", "PANIN BANK", "PANIN MOBILE"],
     "PANIN", "Panin Bank", 0.9),
    (["SEABANK", "SEA BANK INDONESIA", "PT BANK SEABANK"],
     "SEABANK", "SeaBank Indonesia", 0.9),
    (["PT BANK JAGO", "BANK JAGO", "JAGO MOBILE"],
     "JAGO", "Bank Jago", 0.9),
    # P3
    (["PT BANK MAYBANK INDONESIA", "MAYBANK INDONESIA", "M2U"],
     "MAYBANK", "Maybank Indonesia", 0.8),
    (["PT BANK BTPN", "BTPN", "JENIUS", "SMBC INDONESIA"],
     "SMBC", "SMBC Indonesia", 0.8),
    (["PT BANK MEGA", "BANK MEGA", "MEGAMOBILE"],
     "MEGA", "Bank Mega", 0.8),
    (["PT KB BANK", "KB BANK", "BUKOPIN", "WOKEE"],
     "KB", "KB Bank", 0.8),
    (["PT BANK UOB INDONESIA", "UOB INDONESIA", "UOB"],
     "UOB", "UOB Indonesia", 0.8),
    (["PT BANK DBS INDONESIA", "DBS INDONESIA", "DIGIBANK"],
     "DBS", "DBS Indonesia", 0.8),
    (["PT ALLO BANK", "ALLO BANK", "ALLOMOBILE"],
     "ALLO", "Allo Bank", 0.8),
]

# Regex to detect Indonesian account numbers per bank
ACCOUNT_NO_PATTERNS: dict[str, str] = {
    "BCA": r"\b\d{10}\b",
    "MDR": r"\b\d{13}\b",
    "BRI": r"\b\d{15}\b",
    "BNI": r"\b\d{10}\b",
    "BTN": r"\b\d{15}\b",
    "PRMT": r"\b\d{4}-\d{4}-\d{3}\b",
    "DNMN": r"\b\d{12}\b",
    "OCBC": r"\b\d{12}\b",
}


@dataclass
class DetectionResult:
    bank_code: str
    bank_name: str
    confidence: float
    is_scanned: bool
    account_no_masked: Optional[str] = None
    matched_keywords: list[str] = field(default_factory=list)


def _extract_text_first_pages(pdf_path: str, n_pages: int = 3) -> str:
    """Extract text from the first N pages of a PDF."""
    text_parts: list[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages[:n_pages]:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
    except Exception as exc:
        logger.warning("pdfplumber extraction failed: %s", exc)
    return "\n".join(text_parts)


def _extract_ocr_text_first_pages(pdf_path: str, n_pages: int = 2) -> str:
    """OCR first pages when a PDF is scanned/image-only."""
    try:
        import fitz
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        logger.warning("OCR dependencies unavailable for detection: %s", exc)
        return ""

    text_parts: list[str] = []
    try:
        with fitz.open(pdf_path) as doc:
            page_count = min(len(doc), n_pages)
            for page_index in range(page_count):
                page = doc[page_index]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                text = pytesseract.image_to_string(image, lang="ind+eng")
                if text:
                    text_parts.append(text)
    except Exception as exc:
        logger.warning("OCR detection extraction failed: %s", exc)
    return "\n".join(text_parts)


def _is_scanned(pdf_path: str) -> bool:
    """Return True if the PDF has no selectable text layer (likely scanned)."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages[:3]:
                if page.extract_text():
                    return False
    except Exception:
        pass
    return True


def _mask_account_no(raw: str, bank_code: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw
    visible = digits[-4:]
    return "x" * max(0, len(digits) - 4) + visible


def _looks_like_permata_transaction_history(text: str) -> bool:
    """
    Permata JasperReports statements often expose the logo as an image, so the
    selectable text may not contain "BANK PERMATA". The statement layout itself
    is distinctive enough to identify the adapter.
    """
    required = (
        "TRANSACTION HISTORY",
        "ACCOUNT NO",
        "ACCOUNT NAME",
        "OPENING BALANCE",
        "CLOSING BALANCE",
        "TOTAL DEBIT",
        "TOTAL CREDIT",
    )
    table_headers = (
        "TRANSACTION REFERENCE NO",
        "CUSTOMER REFERENCE DETAIL",
        "CHEQUE NO",
    )
    return all(keyword in text for keyword in required) and any(keyword in text for keyword in table_headers)


def _looks_like_bca_estatement(text: str) -> bool:
    brand_hit = "BCA" in text or "BANK CENTRAL ASIA" in text
    layout_keywords = (
        "E-STATEMENT",
        "ESTATEMENT",
        "MUTASI",
        "KETERANGAN",
        "SALDO AWAL",
        "SALDO AKHIR",
        "NO. REKENING",
        "NOMOR REKENING",
    )
    return brand_hit and sum(1 for keyword in layout_keywords if keyword in text) >= 2


def _looks_like_bni_transaction_inquiry(text: str) -> bool:
    required = (
        "TRANSACTION INQUIRY",
        "ACCOUNT INFORMATION",
        "BEGINNING BALANCE",
        "TOTAL DEBIT",
        "TOTAL CREDIT",
        "POST DATE",
        "JOURNAL NO",
        "DB/CR",
    )
    return all(keyword in text for keyword in required)


def _looks_like_danamon_transaction_inquiry(text: str) -> bool:
    required = (
        "TRANSACTION INQUIRY REPORT",
        "ACCOUNT NUMBER",
        "OPENING BALANCE",
        "POSTING DATE",
        "VALUE DATE",
        "REFERENCE NUMBER",
        "TRANSACTION",
        "BRANCH",
        "DEBIT",
        "CREDIT",
        "BALANCE",
    )
    return all(keyword in text for keyword in required)


def _looks_like_ocbc_account_statement(text: str) -> bool:
    required = (
        "ACCOUNT STATEMENT",
        "FROM",
        "TO",
        "ACCOUNT NO",
        "ACCOUNT NAME",
        "OPENING BALANCE",
        "CLOSING BALANCE",
        "TOTAL DEBIT",
        "TOTAL CREDIT",
        "TRANSACTION",
        "VALUE DATE",
        "REFERENCE NO",
        "CHEQUE NO",
        "DESCRIPTION",
        "DEBIT",
        "CREDIT",
        "BALANCE",
    )
    return all(keyword in text for keyword in required)


def _looks_like_bri_ibbiz_report(text: str) -> bool:
    required = (
        "LAPORAN TRANSAKSI FINANSIAL",
        "NO. REKENING",
        "PERIODE TRANSAKSI",
        "TANGGAL TRANSAKSI",
        "URAIAN TRANSAKSI",
        "TELLER",
        "DEBET",
        "KREDIT",
        "SALDO",
    )
    return all(keyword in text for keyword in required)


class BankDetector:
    """
    Lapis 1 — Deteksi bank dari header PDF dan text layer.
    Returns DetectionResult or raises ValueError if unrecognised.
    """

    def detect(self, pdf_path: str) -> DetectionResult:
        is_scanned = _is_scanned(pdf_path)
        header_text = _extract_text_first_pages(pdf_path).upper()
        if is_scanned or not header_text.strip():
            ocr_text = _extract_ocr_text_first_pages(pdf_path).upper()
            if ocr_text:
                header_text = f"{header_text}\n{ocr_text}"

        best_code = "UNKNOWN"
        best_name = "Unknown Bank"
        best_confidence = 0.0
        best_keywords: list[str] = []

        for keywords, code, name, weight in BANK_SIGNATURES:
            matched = [kw for kw in keywords if kw in header_text]
            if not matched:
                continue
            # Confidence scales with keyword hits and signature weight
            conf = weight * min(1.0, len(matched) / max(1, len(keywords) // 2))
            if conf > best_confidence:
                best_confidence = conf
                best_code = code
                best_name = name
                best_keywords = matched

        if _looks_like_bca_estatement(header_text) and best_confidence < 0.95:
            best_code = "BCA"
            best_name = "Bank Central Asia"
            best_confidence = 0.95
            best_keywords = ["BCA_OCR_ESTATEMENT_LAYOUT"]

        if _looks_like_permata_transaction_history(header_text) and best_confidence < 0.95:
            best_code = "PRMT"
            best_name = "Bank Permata"
            best_confidence = 0.95
            best_keywords = ["PERMATA_TRANSACTION_HISTORY_LAYOUT"]

        if _looks_like_bni_transaction_inquiry(header_text) and best_confidence < 0.95:
            best_code = "BNI"
            best_name = "Bank Negara Indonesia"
            best_confidence = 0.95
            best_keywords = ["BNI_TRANSACTION_INQUIRY_LAYOUT"]

        if _looks_like_danamon_transaction_inquiry(header_text) and best_confidence < 0.95:
            best_code = "DNMN"
            best_name = "Bank Danamon"
            best_confidence = 0.95
            best_keywords = ["DANAMON_TRANSACTION_INQUIRY_LAYOUT"]

        if _looks_like_ocbc_account_statement(header_text) and best_confidence < 0.95:
            best_code = "OCBC"
            best_name = "OCBC Indonesia"
            best_confidence = 0.95
            best_keywords = ["OCBC_ACCOUNT_STATEMENT_LAYOUT"]

        if _looks_like_bri_ibbiz_report(header_text) and best_confidence < 0.95:
            best_code = "BRI"
            best_name = "Bank Rakyat Indonesia"
            best_confidence = 0.95
            best_keywords = ["BRI_IBBIZ_REPORT_LAYOUT"]

        # Try to extract & mask account number
        account_no_masked: Optional[str] = None
        pattern = ACCOUNT_NO_PATTERNS.get(best_code)
        if pattern:
            m = re.search(pattern, header_text)
            if m:
                account_no_masked = _mask_account_no(m.group(), best_code)

        return DetectionResult(
            bank_code=best_code,
            bank_name=best_name,
            confidence=best_confidence,
            is_scanned=is_scanned,
            account_no_masked=account_no_masked,
            matched_keywords=best_keywords,
        )
