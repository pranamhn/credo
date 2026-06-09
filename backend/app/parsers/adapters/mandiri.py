"""
PARSE-05 — Bank Mandiri Adapter
Handles Mandiri Kopra by Mandiri (bisnis) and Livin' (retail) PDF formats.

Kopra format characteristics:
  - Columns: Posting Date | Remark | Reference No. | Debit | Credit | Balance
  - Number format: US style  →  34,360,987.05 (comma=thousands, dot=decimal)
  - Date format: "18 Feb 2026, 10:06:09" (date and time split across lines in PDF)
  - Labels: "Account No.", "Account Name", "Opening Balance", "Closing Balance"
  - Period: "01 Feb 2026 - 28 Feb 2026"
  - pdfplumber extract_tables() only returns header rows; full text parsing required.

Livin' / retail format:
  - Columns: Tanggal | Keterangan | Debit | Kredit | Saldo
  - Indonesian number format
"""
from __future__ import annotations
import re
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from .base import BaseAdapter, parse_date_id
from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionSource

logger = logging.getLogger(__name__)

# ── Number parsers ──────────────────────────────────────────────────────────

def _parse_us_amount(raw: str) -> Optional[Decimal]:
    """US-style: '34,360,987.05' → Decimal('34360987.05'). Returns None for zero."""
    if not raw:
        return None
    cleaned = raw.strip().replace(",", "")
    if not cleaned or cleaned in ("-", "0.00", "0"):
        return None
    try:
        val = Decimal(cleaned)
        return None if val == 0 else val
    except InvalidOperation:
        return None


def _parse_idr_amount(raw: str) -> Optional[Decimal]:
    """Indonesian-style: '34.360.987,05' → Decimal('34360987.05'). Returns None for zero."""
    if not raw:
        return None
    cleaned = raw.strip().replace(".", "").replace(",", ".")
    if not cleaned or cleaned in ("-", ""):
        return None
    try:
        val = Decimal(cleaned)
        return None if val == 0 else val
    except InvalidOperation:
        return None


def _parse_mandiri_date(raw: str) -> Optional[date]:
    """Parse Kopra date: '18 Feb 2026, 10:06:09' or '18/02/2026'."""
    raw = raw.strip()
    m = re.match(r"(\d{1,2}\s+\w+\s+\d{4})", raw)
    if m:
        try:
            return datetime.strptime(m.group(1), "%d %b %Y").date()
        except ValueError:
            pass
    return parse_date_id(raw)


# ── Detection helpers ────────────────────────────────────────────────────────

def _is_kopra(text: str) -> bool:
    upper = text.upper()
    return "KOPRA" in upper or "ACCOUNT STATEMENT" in upper or "POSTING DATE" in upper


def _is_ref_code(s: str) -> bool:
    """True for reference codes we should skip as descriptions."""
    s = s.strip()
    if not s:
        return True
    # Long pure-digit strings (transaction refs)
    if re.match(r"^\d+$", s) and len(s) >= 8:
        return True
    # Mixed uppercase+digit strings >= 10 chars (system reference codes)
    if re.match(r"^[A-Z0-9]+$", s) and len(s) >= 10 and any(c.isdigit() for c in s):
        return True
    return False


# ── Regex patterns ──────────────────────────────────────────────────────────

_KOPRA_PERIOD_RE = re.compile(
    r"(\d{1,2}\s+\w+\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w+\s+\d{4})", re.I
)
_KOPRA_OPENING_RE = re.compile(r"Opening\s+Balance[\s\S]{0,80}?([\d,]+\.\d{2})", re.I)
_KOPRA_CLOSING_RE = re.compile(r"Closing\s+Balance[\s\S]{0,80}?([\d,]+\.\d{2})", re.I)

_LIVIN_PERIOD_RE = re.compile(
    r"(?:PERIODE|PERIOD)\s*:?\s*(\d{2}/\d{2}/\d{4})\s*[-–s/d]+\s*(\d{2}/\d{2}/\d{4})", re.I
)
_LIVIN_OPENING_RE = re.compile(r"SALDO\s+(?:AWAL|PEMBUKAAN)\s*:?\s*([\d.,]+)", re.I)
_LIVIN_CLOSING_RE = re.compile(r"SALDO\s+(?:AKHIR|PENUTUPAN)\s*:?\s*([\d.,]+)", re.I)
_LIVIN_ACCOUNT_RE = re.compile(r"NOMOR\s+REKENING\s*:?\s*(\d[\d\s-]+\d)", re.I)
_LIVIN_HOLDER_RE = re.compile(r"NAMA\s+(?:NASABAH|PEMILIK)\s*:?\s*(.+)", re.I)

_DATE_RE = re.compile(r"(\d{1,2}\s+\w{3}\s+\d{4})")
_TIME_RE = re.compile(r"^\d{2}:\d{2}:\d{2}")
# Amount line: optional prefix text, then "- DEBIT CREDIT BALANCE"
_AMOUNT_RE = re.compile(
    r"^(.*?)\s*-\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)


class MandiriAdapter(BaseAdapter):
    bank_code = "MDR"
    bank_name = "Bank Mandiri"

    def parse(self, pdf_path: str) -> CanonicalStatement:
        import time
        t0 = time.time()
        text = self._extract_text(pdf_path)
        tables = self._extract_tables(pdf_path)
        kopra = _is_kopra(text)
        logger.info("Mandiri format: %s", "Kopra" if kopra else "Livin'")

        period_start, period_end = self._extract_period(text, kopra)
        opening = self._extract_opening(text, kopra)
        closing = self._extract_closing(text, kopra)
        account_no = self._extract_account(text)
        holder = self._extract_holder(text, kopra)

        if kopra:
            transactions = self._parse_kopra_text_transactions(text)
            if not transactions:
                transactions = self._parse_kopra_table_transactions(tables)
        else:
            transactions = self._parse_livin_transactions(tables)

        elapsed_ms = int((time.time() - t0) * 1000)
        logger.info("Mandiri parsed %d transactions in %dms", len(transactions), elapsed_ms)

        return CanonicalStatement(
            bank_code=self.bank_code,
            bank_name=self.bank_name,
            account_no_masked=account_no,
            account_holder=holder,
            period_start=period_start,
            period_end=period_end,
            currency="IDR",
            opening_balance=opening,
            closing_balance=closing,
            transactions=transactions,
            parse_meta=self._make_meta(processing_time_ms=elapsed_ms),
        )

    # ── Period ──────────────────────────────────────────────────────────────

    def _extract_period(self, text: str, kopra: bool) -> tuple[Optional[date], Optional[date]]:
        if kopra:
            m = _KOPRA_PERIOD_RE.search(text)
            if m:
                return _parse_mandiri_date(m.group(1)), _parse_mandiri_date(m.group(2))
        else:
            m = _LIVIN_PERIOD_RE.search(text)
            if m:
                return parse_date_id(m.group(1)), parse_date_id(m.group(2))
        return None, None

    # ── Balances ────────────────────────────────────────────────────────────

    def _extract_opening(self, text: str, kopra: bool) -> Optional[Decimal]:
        if kopra:
            m = _KOPRA_OPENING_RE.search(text)
            return _parse_us_amount(m.group(1)) if m else None
        m = _LIVIN_OPENING_RE.search(text)
        return _parse_idr_amount(m.group(1)) if m else None

    def _extract_closing(self, text: str, kopra: bool) -> Optional[Decimal]:
        if kopra:
            m = _KOPRA_CLOSING_RE.search(text)
            return _parse_us_amount(m.group(1)) if m else None
        m = _LIVIN_CLOSING_RE.search(text)
        return _parse_idr_amount(m.group(1)) if m else None

    # ── Account & Holder ────────────────────────────────────────────────────

    def _extract_account(self, text: str) -> Optional[str]:
        # Kopra: "1320000662883 SATU CIPTA KREATIF ..."
        m = re.search(r"\b(\d{13})\b", text)
        if m:
            raw = m.group(1)
            return "x" * 9 + raw[-4:]
        # Livin' fallback
        m2 = _LIVIN_ACCOUNT_RE.search(text)
        if m2:
            raw = re.sub(r"[\s-]", "", m2.group(1))
            return "x" * max(0, len(raw) - 4) + raw[-4:]
        return None

    def _extract_holder(self, text: str, kopra: bool) -> Optional[str]:
        if kopra:
            # Pattern: "1320000662883 SATU CIPTA KREATIF SATU CIPTA KREATIF"
            # Name is repeated twice in Kopra format; grab first occurrence.
            m = re.search(r"\b\d{13}\b\s+((?:[A-Z][A-Z]+(?: [A-Z][A-Z]+){0,5}))", text)
            if m:
                raw = m.group(1).strip()
                words = raw.split()
                half = len(words) // 2
                # Deduplicate if the name is repeated
                if half >= 2 and words[:half] == words[half:half * 2]:
                    return " ".join(words[:half]).title()
                # Take first half if >= 4 words (likely name + repetition)
                if len(words) >= 4 and half >= 2:
                    return " ".join(words[:half]).title()
                return raw.title()
        else:
            m = _LIVIN_HOLDER_RE.search(text)
            return m.group(1).strip().title() if m else None
        return None

    # ── Kopra text-based transaction parser ──────────────────────────────────

    def _parse_kopra_text_transactions(self, text: str) -> list[CanonicalTransaction]:
        """
        Parse transactions from raw text because pdfplumber extract_tables() only
        returns header rows for Kopra PDFs.

        Key observation: every transaction has an "amount line" matching:
          [optional desc prefix] - DEBIT CREDIT BALANCE
        The date (DD Mon YYYY) appears within 8 lines before the amount line.
        Description can appear before the dash on the amount line, on the date line,
        or on lines immediately after the amount line (time line + desc lines).
        """
        lines = [ln.strip() for ln in text.splitlines()]
        txns: list[CanonicalTransaction] = []
        row_idx = 0

        for i, line in enumerate(lines):
            if not line:
                continue

            am = _AMOUNT_RE.match(line)
            if not am:
                continue

            # ── Find most recent date within 8 lines above ──
            txn_date: Optional[date] = None
            date_line_idx = -1
            for j in range(i - 1, max(-1, i - 8), -1):
                dm = _DATE_RE.search(lines[j])
                if dm:
                    d = _parse_mandiri_date(dm.group(1))
                    if d:
                        txn_date = d
                        date_line_idx = j
                        break

            if txn_date is None:
                continue

            # ── Collect description ──
            desc_parts: list[str] = []

            # 1. From the date line: text after the date (skip time pattern)
            if date_line_idx >= 0:
                dl = lines[date_line_idx]
                dm2 = _DATE_RE.search(dl)
                if dm2:
                    after = dl[dm2.end():].strip()
                    after = re.sub(r"^,?\s*", "", after).strip()       # strip leading comma
                    after = re.sub(r"^\d{2}:\d{2}:\d{2}\s*", "", after).strip()
                    if after and not _is_ref_code(after):
                        desc_parts.append(after)

            # 2. From the amount line itself: text before the dash
            prefix = am.group(1).strip()
            if prefix and not re.match(r"^\d+$", prefix) and not _is_ref_code(prefix):
                if prefix not in desc_parts:
                    desc_parts.append(prefix)

            # 3. Lines after the amount line: time line → desc, then up to 2 desc lines
            desc_added = 0
            for j in range(i + 1, min(len(lines), i + 5)):
                nxt = lines[j]
                if not nxt:
                    break
                if _DATE_RE.search(nxt):
                    break  # next transaction
                if _AMOUNT_RE.match(nxt):
                    break  # another amount line
                if _TIME_RE.match(nxt):
                    after_time = re.sub(r"^\d{2}:\d{2}:\d{2}\s*", "", nxt).strip()
                    if after_time and not _is_ref_code(after_time):
                        desc_parts.append(after_time)
                elif not _is_ref_code(nxt):
                    desc_parts.append(nxt)
                    desc_added += 1
                    if desc_added >= 2:
                        break

            description = re.sub(r"\s+", " ", " ".join(desc_parts)).strip()

            # ── Parse amounts ──
            debit = _parse_us_amount(am.group(2))
            credit = _parse_us_amount(am.group(3))
            balance = _parse_us_amount(am.group(4))

            if debit is None and credit is None:
                continue

            row_idx += 1
            txns.append(CanonicalTransaction(
                row=row_idx,
                date=txn_date,
                description_raw=description or f"TXN-{row_idx}",
                debit=debit,
                credit=credit,
                balance=balance,
                confidence=0.95,
                source=TransactionSource.adapter,
            ))

        return txns

    # ── Kopra table-based fallback ────────────────────────────────────────────

    def _parse_kopra_table_transactions(self, tables: list) -> list[CanonicalTransaction]:
        """Fallback for PDFs where pdfplumber can extract full table rows."""
        txns: list[CanonicalTransaction] = []
        row_idx = 0
        for table in tables:
            for row in table:
                if not row or len(row) < 4:
                    continue
                cells = [self._clean_cell(c) for c in row]
                if any(kw in cells[0].upper() for kw in ("POSTING", "DATE", "TANGGAL")):
                    continue
                txn_date = _parse_mandiri_date(cells[0])
                if txn_date is None:
                    continue
                debit = _parse_us_amount(cells[3]) if len(cells) > 3 else None
                credit = _parse_us_amount(cells[4]) if len(cells) > 4 else None
                balance = _parse_us_amount(cells[5]) if len(cells) > 5 else None
                if debit is None and credit is None:
                    continue
                row_idx += 1
                txns.append(CanonicalTransaction(
                    row=row_idx,
                    date=txn_date,
                    description_raw=cells[1] if len(cells) > 1 else "",
                    debit=debit,
                    credit=credit,
                    balance=balance,
                    confidence=0.97 if balance else 0.80,
                    source=TransactionSource.adapter,
                ))
        return txns

    # ── Livin' / retail ──────────────────────────────────────────────────────

    def _parse_livin_transactions(self, tables: list) -> list[CanonicalTransaction]:
        """Livin' retail: Tanggal(0) | Keterangan(1) | Debit(2) | Kredit(3) | Saldo(4)"""
        txns: list[CanonicalTransaction] = []
        row_idx = 0
        for table in tables:
            for row in table:
                if not row or len(row) < 4:
                    continue
                cells = [self._clean_cell(c) for c in row]
                if any(kw in cells[0].upper() for kw in ("TANGGAL", "DEBIT", "KREDIT", "SALDO")):
                    continue
                txn_date = parse_date_id(cells[0])
                if txn_date is None:
                    continue
                debit = _parse_idr_amount(cells[2]) if len(cells) > 2 else None
                credit = _parse_idr_amount(cells[3]) if len(cells) > 3 else None
                balance = _parse_idr_amount(cells[4]) if len(cells) > 4 else None
                if debit is None and credit is None:
                    continue
                row_idx += 1
                txns.append(CanonicalTransaction(
                    row=row_idx,
                    date=txn_date,
                    description_raw=cells[1],
                    debit=debit,
                    credit=credit,
                    balance=balance,
                    confidence=0.97 if balance else 0.80,
                    source=TransactionSource.adapter,
                ))
        return txns
