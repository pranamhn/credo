"""
Base adapter — all bank-specific parsers extend this class.
Implements Adapter pattern as described in PRD section 3.3 Lapis 2.
"""
from __future__ import annotations
import re
import logging
from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

import pdfplumber

from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, ParseMeta, TransactionSource

logger = logging.getLogger(__name__)

# Indonesian locale: periods as thousand sep, commas as decimal sep
_IDR_RE = re.compile(r"[\d.,]+")


def parse_idr_amount(raw: str) -> Optional[Decimal]:
    """Parse Indonesian number format: '1.500.000,50' → Decimal('1500000.50')"""
    raw = raw.strip().replace(" ", "")
    if not raw or raw in ("-", ""):
        return None
    try:
        # Remove thousand separators (.) then replace decimal (,) with .
        normalized = raw.replace(".", "").replace(",", ".")
        return Decimal(normalized)
    except InvalidOperation:
        return None


def parse_date_id(raw: str, fmt: str = "%d/%m/%Y") -> Optional[date]:
    """Parse common Indonesian date formats."""
    from datetime import datetime
    raw = raw.strip()
    formats = [fmt, "%d-%m-%Y", "%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%y"]
    for f in formats:
        try:
            return datetime.strptime(raw, f).date()
        except ValueError:
            continue
    return None


class BaseAdapter(ABC):
    """
    Abstract base for all bank statement adapters.
    Subclasses implement `parse()` and get utility methods for free.
    """

    bank_code: str = "UNKNOWN"
    bank_name: str = "Unknown Bank"

    @abstractmethod
    def parse(self, pdf_path: str) -> CanonicalStatement:
        """Parse PDF and return a CanonicalStatement."""

    def _make_meta(self, **kwargs) -> ParseMeta:
        return ParseMeta(
            method=TransactionSource.adapter,
            adapter_name=self.__class__.__name__,
            **kwargs,
        )

    def _extract_tables(self, pdf_path: str, max_pages: int | None = None) -> list[list[list[str | None]]]:
        """Extract all tables from all pages using pdfplumber."""
        all_tables: list[list[list[str | None]]] = []
        with pdfplumber.open(pdf_path) as pdf:
            pages = pdf.pages[:max_pages] if max_pages else pdf.pages
            for page in pages:
                tables = page.extract_tables()
                if tables:
                    all_tables.extend(tables)
        return all_tables

    def _extract_text(self, pdf_path: str, max_pages: int | None = None) -> str:
        parts: list[str] = []
        with pdfplumber.open(pdf_path) as pdf:
            pages = pdf.pages[:max_pages] if max_pages else pdf.pages
            for page in pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
        return "\n".join(parts)

    def _extract_ocr_text(self, pdf_path: str, max_pages: int | None = None) -> str:
        """OCR fallback for scanned/image-only PDFs."""
        try:
            import fitz
            import pytesseract
            from PIL import Image
        except ImportError as exc:
            logger.warning("OCR dependencies unavailable: %s", exc)
            return ""

        parts: list[str] = []
        try:
            with fitz.open(pdf_path) as doc:
                page_count = min(len(doc), max_pages or len(doc))
                for page_index in range(page_count):
                    page = doc[page_index]
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    text = pytesseract.image_to_string(image, lang="ind+eng")
                    if text:
                        parts.append(text)
        except Exception as exc:
            logger.warning("OCR extraction failed: %s", exc)
            return ""

        return "\n".join(parts)

    def _clean_cell(self, val: str | None) -> str:
        if val is None:
            return ""
        return " ".join(val.split())
