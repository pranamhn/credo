"""
PARSE-10 — Bank Danamon Adapter
Handles Danamon Transaction Inquiry Report PDFs.

Observed layout:
  - Header: Account Number | Name | Currency | Period | Opening Balance
  - Columns: Posting Date | Value Date | Transaction Branch | Reference Number
             Description | Debit | Credit | Balance
  - Number format: US style -> 1,400,064.88
  - Date format: "15 Nov 2025"
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from .base import BaseAdapter
from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionSource

logger = logging.getLogger(__name__)

_PERIOD_RE = re.compile(
    r"([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    re.I,
)
_ACCOUNT_RE = re.compile(r"Account\s+Number\s*:?\s*(\d{8,16})", re.I)
_HOLDER_RE = re.compile(r"\bName\s*:?\s*([A-Z0-9 .,&'-]+?)(?=\s+(?:Print\s+Date|Currency|Opening\s+Balance|Period)\b)", re.I | re.S)
_OPENING_RE = re.compile(r"Opening\s+Balance\s*:?\s*([\d,]+\.\d{2})", re.I)
_DATE_RE = re.compile(r"^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$")
_PAGE_RE = re.compile(r"^Page\s+\d+\s+of\s+\d+$", re.I)


def _parse_danamon_date(raw: str) -> Optional[date]:
    raw = raw.strip()
    for fmt in ("%d %b %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Optional[Decimal]:
    if not raw:
        return None

    cleaned = raw.strip().replace(",", "")
    if not cleaned or cleaned == "-":
        return None

    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None

    return None if amount == 0 else amount


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


class DanamonAdapter(BaseAdapter):
    bank_code = "DNMN"
    bank_name = "Bank Danamon"

    def parse(self, pdf_path: str) -> CanonicalStatement:
        import time

        t0 = time.time()
        text = self._extract_text(pdf_path)

        period_start, period_end = self._extract_period(text)
        opening = self._extract_opening(text)
        transactions = self._parse_transactions_by_words(pdf_path)
        closing = transactions[-1].balance if transactions and transactions[-1].balance is not None else self._extract_closing_from_text(text)

        elapsed_ms = int((time.time() - t0) * 1000)
        logger.info("Danamon parsed %d transactions in %dms", len(transactions), elapsed_ms)

        return CanonicalStatement(
            bank_code=self.bank_code,
            bank_name=self.bank_name,
            account_no_masked=self._extract_account(text),
            account_holder=self._extract_holder(text),
            period_start=period_start,
            period_end=period_end,
            currency="IDR",
            opening_balance=opening,
            closing_balance=closing,
            transactions=transactions,
            parse_meta=self._make_meta(processing_time_ms=elapsed_ms),
        )

    def _extract_period(self, text: str) -> tuple[Optional[date], Optional[date]]:
        m = _PERIOD_RE.search(text)
        if m:
            return _parse_danamon_date(m.group(1)), _parse_danamon_date(m.group(2))
        return None, None

    def _extract_opening(self, text: str) -> Optional[Decimal]:
        m = _OPENING_RE.search(text)
        return _parse_amount(m.group(1)) if m else None

    def _extract_closing_from_text(self, text: str) -> Optional[Decimal]:
        totals = re.findall(r"\bTotal\b[\s\S]{0,120}?([\d,]+\.\d{2})\s*$", text, re.I | re.M)
        return _parse_amount(totals[-1]) if totals else None

    def _extract_account(self, text: str) -> Optional[str]:
        m = _ACCOUNT_RE.search(text)
        if not m:
            return None
        raw = m.group(1)
        return "x" * max(0, len(raw) - 4) + raw[-4:]

    def _extract_holder(self, text: str) -> Optional[str]:
        m = _HOLDER_RE.search(text)
        if not m:
            return None
        holder = _clean_text(m.group(1))
        return holder.title() if holder.isupper() else holder

    def _parse_transactions_by_words(self, pdf_path: str) -> list[CanonicalTransaction]:
        try:
            # pyrefly: ignore [missing-import]
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is unavailable; Danamon word parser cannot run")
            return []

        word_rows: list[tuple[int, float, list[dict]]] = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False) or []
                rows: dict[float, list[dict]] = {}
                for word in words:
                    text = str(word.get("text", "")).strip()
                    if not text:
                        continue
                    top = round(float(word.get("top", 0)) / 3) * 3
                    rows.setdefault(top, []).append(word)

                for top, row_words in rows.items():
                    word_rows.append((page_idx, top, sorted(row_words, key=lambda item: float(item.get("x0", 0)))))

        txns: list[CanonicalTransaction] = []
        current: dict | None = None

        for _, _, row_words in sorted(word_rows, key=lambda item: (item[0], item[1])):
            cells = self._cells_from_words(row_words)
            posting_date = _parse_danamon_date(cells["posting_date"])

            if posting_date:
                if current:
                    self._append_transaction(txns, current)
                current = {
                    "date": posting_date,
                    "value_date": _parse_danamon_date(cells["value_date"]),
                    "branch_parts": [cells["branch"]] if cells["branch"] else [],
                    "reference_number": cells["reference_number"],
                    "description_parts": [cells["description"]] if cells["description"] else [],
                    "debit": _parse_amount(cells["debit"]),
                    "credit": _parse_amount(cells["credit"]),
                    "balance": _parse_amount(cells["balance"]),
                }
                continue

            if current is None:
                continue

            if cells["description"] and not _PAGE_RE.match(cells["description"]):
                current["description_parts"].append(cells["description"])
            if cells["branch"]:
                current["branch_parts"].append(cells["branch"])
            if cells["reference_number"]:
                current["reference_number"] = _clean_text(f"{current.get('reference_number', '')} {cells['reference_number']}")

        if current:
            self._append_transaction(txns, current)

        return txns

    def _cells_from_words(self, words: list[dict]) -> dict[str, str]:
        buckets: dict[str, list[str]] = {
            "posting_date": [],
            "value_date": [],
            "branch": [],
            "reference_number": [],
            "description": [],
            "debit": [],
            "credit": [],
            "balance": [],
        }

        for word in words:
            text = str(word.get("text", "")).strip()
            x0 = float(word.get("x0", 0))

            if x0 < 100:
                buckets["posting_date"].append(text)
            elif x0 < 160:
                buckets["value_date"].append(text)
            elif x0 < 255:
                buckets["branch"].append(text)
            elif x0 < 370:
                buckets["reference_number"].append(text)
            elif x0 < 640:
                buckets["description"].append(text)
            elif x0 < 790:
                buckets["debit"].append(text)
            elif x0 < 900:
                buckets["credit"].append(text)
            else:
                buckets["balance"].append(text)

        return {key: _clean_text(" ".join(value)) for key, value in buckets.items()}

    def _append_transaction(self, txns: list[CanonicalTransaction], current: dict) -> None:
        debit = current.get("debit")
        credit = current.get("credit")
        if debit is None and credit is None:
            return

        description = _clean_text(" ".join(current.get("description_parts", [])))
        branch = _clean_text(" ".join(current.get("branch_parts", [])))
        reference = _clean_text(current.get("reference_number", ""))

        txns.append(
            CanonicalTransaction(
                row=len(txns) + 1,
                date=current["date"],
                value_date=current.get("value_date"),
                description_raw=description or reference or f"TXN-{len(txns) + 1}",
                debit=debit if debit and debit > 0 else None,
                credit=credit if credit and credit > 0 else None,
                balance=current.get("balance"),
                confidence=0.96 if current.get("balance") is not None else 0.82,
                source=TransactionSource.adapter,
                raw_meta={
                    "branch": branch,
                    "reference_number": reference,
                },
            )
        )
