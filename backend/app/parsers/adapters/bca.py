"""
PARSE-04 — BCA Adapter
Handles BCA e-statement PDF (KlikBCA / BCA Mobile format).
BCA tables: Tanggal | Keterangan | Cabang | Mutasi | Saldo
"""
from __future__ import annotations
import re
import logging
import calendar
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from .base import BaseAdapter, parse_idr_amount, parse_date_id
from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionSource

logger = logging.getLogger(__name__)

# Column indices for BCA standard layout
COL_DATE = 0
COL_DESC = 1
COL_BRANCH = 2
COL_MUTATION = 3   # Debit / Credit combined with CR/DB suffix
COL_BALANCE = 4

_HEADER_KEYWORDS = {"TANGGAL", "KETERANGAN", "MUTASI", "SALDO"}
_PERIOD_RE = re.compile(r"PERIODE\s+:?\s*(\d{2}/\d{2}/\d{4})\s*[-–]\s*(\d{2}/\d{2}/\d{4})", re.I)
_MONTH_PERIOD_RE = re.compile(r"PERIODE\s*:?\s*([A-Z]+)\s+(\d{4})", re.I)
_OPENING_RE = re.compile(r"SALDO\s+AWAL\s*:?\s*([\d.,]+)", re.I)
_CLOSING_RE = re.compile(r"SALDO\s+AKHIR\s*:?\s*([\d.,]+)", re.I)
_ACCOUNT_RE = re.compile(r"NO\.?\s*REKENING\s*:?\s*(\d[\d\s-]+\d)", re.I)
_HOLDER_RE = re.compile(r"^\s*(.+?)\s+NO\.?\s*REKENING\s*:", re.I | re.M)
_CR_RE = re.compile(r"CR$", re.I)
_DB_RE = re.compile(r"DB$", re.I)
_DATE_START_RE = re.compile(r"^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b")
_AMOUNT_TOKEN_RE = re.compile(r"(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})\s*(CR|DB)?", re.I)

_ID_MONTH_NUMBERS = {
    "JANUARI": 1,
    "FEBRUARI": 2,
    "MARET": 3,
    "APRIL": 4,
    "MEI": 5,
    "JUNI": 6,
    "JULI": 7,
    "AGUSTUS": 8,
    "SEPTEMBER": 9,
    "OKTOBER": 10,
    "NOVEMBER": 11,
    "DESEMBER": 12,
}


class BCAAdapter(BaseAdapter):
    bank_code = "BCA"
    bank_name = "Bank Central Asia"

    def parse(self, pdf_path: str) -> CanonicalStatement:
        import time
        t0 = time.time()
        text = self._extract_text(pdf_path)
        tables = self._extract_tables(pdf_path)

        period_start, period_end = self._extract_period(text)
        opening_balance = self._extract_opening(text)
        closing_balance = self._extract_closing(text)
        account_no = self._extract_account(text)
        account_holder = self._extract_holder(text)

        transactions = self._parse_transactions(tables)
        ocr_used = False

        if not transactions and text.strip():
            default_year = (period_end or period_start).year if (period_end or period_start) else None
            transactions = self._parse_text_transactions(text, default_year=default_year)

        if not transactions and not text.strip():
            ocr_text = self._extract_ocr_text(pdf_path)
            if ocr_text:
                ocr_used = True
                text = ocr_text
                period_start, period_end = self._extract_period(text)
                opening_balance = self._extract_opening(text)
                closing_balance = self._extract_closing(text)
                account_no = self._extract_account(text)
                account_holder = self._extract_holder(text)
                default_year = (period_end or period_start).year if (period_end or period_start) else None
                transactions = self._parse_text_transactions(text, default_year=default_year)

        if opening_balance is None and transactions and transactions[0].balance is not None:
            opening_balance = (
                transactions[0].balance
                - (transactions[0].credit or Decimal("0"))
                + (transactions[0].debit or Decimal("0"))
            )
        if closing_balance is None and transactions and transactions[-1].balance is not None:
            closing_balance = transactions[-1].balance

        elapsed_ms = int((time.time() - t0) * 1000)

        return CanonicalStatement(
            bank_code=self.bank_code,
            bank_name=self.bank_name,
            account_no_masked=account_no,
            account_holder=account_holder,
            period_start=period_start,
            period_end=period_end,
            currency="IDR",
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            transactions=transactions,
            parse_meta=self._make_meta(processing_time_ms=elapsed_ms, ocr=ocr_used),
        )

    def _extract_period(self, text: str) -> tuple[Optional[date], Optional[date]]:
        m = _PERIOD_RE.search(text)
        if m:
            return parse_date_id(m.group(1)), parse_date_id(m.group(2))
        m = _MONTH_PERIOD_RE.search(text)
        if m:
            month = _ID_MONTH_NUMBERS.get(m.group(1).upper())
            year = int(m.group(2))
            if month:
                last_day = calendar.monthrange(year, month)[1]
                return date(year, month, 1), date(year, month, last_day)
        return None, None

    def _extract_opening(self, text: str) -> Optional[Decimal]:
        m = _OPENING_RE.search(text)
        return self._parse_bca_amount(m.group(1)) if m else None

    def _extract_closing(self, text: str) -> Optional[Decimal]:
        m = _CLOSING_RE.search(text)
        return self._parse_bca_amount(m.group(1)) if m else None

    def _extract_account(self, text: str) -> Optional[str]:
        m = _ACCOUNT_RE.search(text)
        if m:
            raw = re.sub(r"[\s-]", "", m.group(1))
            return "x" * (len(raw) - 4) + raw[-4:]
        return None

    def _extract_holder(self, text: str) -> Optional[str]:
        m = _HOLDER_RE.search(text)
        return m.group(1).strip().title() if m else None

    def _parse_transactions(self, tables: list) -> list[CanonicalTransaction]:
        txns: list[CanonicalTransaction] = []
        row_idx = 0

        for table in tables:
            if not self._is_transaction_table(table):
                continue

            for row in table:
                if not row or len(row) < 4:
                    continue
                cells = [self._clean_cell(c) for c in row]

                # Skip header rows
                date_raw = cells[COL_DATE]
                if not date_raw or any(kw in date_raw.upper() for kw in _HEADER_KEYWORDS):
                    continue

                txn_date = parse_date_id(date_raw)
                if txn_date is None:
                    continue

                mutation_raw = cells[COL_MUTATION] if len(cells) > COL_MUTATION else ""
                balance_raw = cells[COL_BALANCE] if len(cells) > COL_BALANCE else ""

                debit, credit = self._split_mutation(mutation_raw)
                balance = self._parse_bca_amount(balance_raw)

                if debit is None and credit is None:
                    continue

                row_idx += 1
                conf = 0.98 if balance is not None else 0.90

                txns.append(CanonicalTransaction(
                    row=row_idx,
                    date=txn_date,
                    description_raw=cells[COL_DESC],
                    debit=debit,
                    credit=credit,
                    balance=balance,
                    confidence=conf,
                    source=TransactionSource.adapter,
                ))

        return txns

    def _is_transaction_table(self, table: list) -> bool:
        for row in table[:3]:
            joined = " ".join(str(c or "") for c in row).upper()
            if "MUTASI" in joined or "SALDO" in joined:
                return True
        return False

    def _split_mutation(self, mutation_raw: str) -> tuple[Optional[Decimal], Optional[Decimal]]:
        """
        BCA mutation column format: '1.500.000,00 CR' or '500.000,00 DB'
        Some formats have separate debit/credit columns — handle both.
        """
        if not mutation_raw:
            return None, None

        amount_str = re.sub(r"[A-Za-z\s]", "", mutation_raw)
        amount = self._parse_bca_amount(amount_str)

        if _CR_RE.search(mutation_raw):
            return None, amount
        if _DB_RE.search(mutation_raw):
            return amount, None

        # Fallback: no suffix — treat as debit (conservative)
        return amount, None

    def _parse_text_transactions(self, text: str, default_year: Optional[int] = None) -> list[CanonicalTransaction]:
        logical_rows: list[str] = []
        current: list[str] = []

        skip_keywords = (
            "TANGGAL",
            "KETERANGAN",
            "MUTASI",
            "SALDO AWAL",
            "SALDO AKHIR",
            "BCA",
            "HALAMAN",
        )

        for raw_line in text.splitlines():
            line = " ".join(raw_line.split())
            if not line:
                continue
            if any(keyword in line.upper() for keyword in skip_keywords):
                continue
            if _DATE_START_RE.match(line):
                if current:
                    logical_rows.append(" ".join(current))
                current = [line]
            elif current:
                current.append(line)

        if current:
            logical_rows.append(" ".join(current))

        txns: list[CanonicalTransaction] = []
        for row_text in logical_rows:
            txn = self._parse_text_row(row_text, len(txns) + 1, default_year=default_year)
            if txn:
                txns.append(txn)
        return txns

    def _parse_text_row(
        self,
        row_text: str,
        row_number: int,
        default_year: Optional[int] = None,
    ) -> Optional[CanonicalTransaction]:
        date_match = _DATE_START_RE.match(row_text)
        if not date_match:
            return None

        date_raw = date_match.group(1)
        if default_year and re.match(r"^\d{1,2}[/-]\d{1,2}$", date_raw):
            date_raw = f"{date_raw}/{default_year}"
        txn_date = parse_date_id(date_raw)
        if txn_date is None:
            return None

        body = row_text[date_match.end():].strip()
        amount_matches = [
            match for match in _AMOUNT_TOKEN_RE.finditer(body)
            if re.search(r"\d", match.group(1))
        ]
        if len(amount_matches) < 1:
            return None

        mutation_match = amount_matches[0]

        mutation = self._parse_bca_amount(mutation_match.group(1))
        if mutation is None:
            return None

        balance = None
        for candidate in amount_matches[1:]:
            parsed = self._parse_bca_amount(candidate.group(1))
            if parsed is not None and parsed != mutation:
                balance = parsed
                break

        direction = self._infer_text_direction(body, mutation_match)
        debit = mutation if direction == "DB" else None
        credit = mutation if direction == "CR" else None
        description = self._clean_text_description(body)

        return CanonicalTransaction(
            row=row_number,
            date=txn_date,
            description_raw=description,
            debit=debit,
            credit=credit,
            balance=balance,
            confidence=0.90 if balance is not None else 0.87,
            source=TransactionSource.adapter,
        )

    def _infer_text_direction(self, body: str, mutation_match: re.Match[str]) -> str:
        suffix = (mutation_match.group(2) or "").upper()
        if suffix in {"CR", "DB"}:
            return suffix

        description = body[:mutation_match.start()].upper()
        if any(keyword in description for keyword in ("KR OTOMATIS", "SETORAN KLIRING")):
            return "CR"

        nearby_after = body[mutation_match.end():mutation_match.end() + 8].upper()
        if re.search(r"\bCR\b", nearby_after):
            return "CR"
        if re.search(r"\bDB\b", nearby_after):
            return "DB"

        before_tokens = re.findall(r"\b(CR|DB)\b", body[:mutation_match.start()].upper())
        return before_tokens[-1] if before_tokens else "DB"

    def _clean_text_description(self, body: str) -> str:
        description = _AMOUNT_TOKEN_RE.sub(" ", body)
        description = re.sub(r"\b(CR|DB)\b", " ", description, flags=re.I)
        description = re.sub(r"\b\d{5,}\b", " ", description)
        description = re.sub(r"\s+[-–]\s+", " ", description)
        description = re.sub(r"\s+", " ", description).strip(" -")
        return description

    def _parse_bca_amount(self, raw: str) -> Optional[Decimal]:
        compact = raw.strip().replace(" ", "")
        if not compact or compact == "-":
            return None

        try:
            if "," in compact and "." in compact and compact.rfind(".") > compact.rfind(","):
                amount = Decimal(compact.replace(",", ""))
            elif "." in compact and "," not in compact and re.search(r"\.\d{2}$", compact):
                amount = Decimal(compact)
            else:
                amount = parse_idr_amount(compact)
        except InvalidOperation:
            return None

        if amount is None or amount == 0:
            return None
        return amount
