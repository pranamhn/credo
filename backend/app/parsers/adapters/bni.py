"""
PARSE-07 — BNI Adapter
Handles BNI e-statement PDFs.

Supported layouts:
  - Retail table: Tanggal | Transaksi | Debit | Kredit | Saldo
  - BNI Direct Transaction Inquiry:
    No. | Post Date | Branch | Journal No. | Description | Amount | Db/Cr | Balance
"""
from __future__ import annotations
import re
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from .base import BaseAdapter, parse_idr_amount, parse_date_id
from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionSource

logger = logging.getLogger(__name__)

COL_DATE = 0
COL_DESC = 1
COL_DEBIT = 2
COL_CREDIT = 3
COL_BALANCE = 4

_PERIOD_RE = re.compile(
    r"(?:PERIODE|PERIOD)\s*:?\s*(\d{2}/\d{2}/\d{4})\s*[-–s/d]+\s*(\d{2}/\d{2}/\d{4})",
    re.I,
)
_DIRECT_PERIOD_RE = re.compile(r"Period\s*:?\s*(\d{2}-[A-Za-z]{3}-\d{4})\s*[-–]\s*(\d{2}-[A-Za-z]{3}-\d{4})", re.I)
_OPENING_RE = re.compile(r"(?:SALDO\s+AWAL|BEGINNING\s+BALANCE)\s*:?\s*([\d.,]+)", re.I)
_DIRECT_CLOSING_RE = re.compile(
    r"Beginning\s+Balance\s*:?\s*([\d.,]+)\s+Total\s+Debit\s*:?\s*([\d.,]+)\s+Total\s+Credit\s*:?\s*([\d.,]+)",
    re.I | re.S,
)
_CLOSING_RE = re.compile(r"SALDO\s+AKHIR\s*:?\s*([\d.,]+)", re.I)
_ACCOUNT_RE = re.compile(r"(?:NO\.?\s*REKENING|NOMOR\s+REKENING)\s*:?\s*(\d[\d\s-]+\d)", re.I)
_DIRECT_ACCOUNT_RE = re.compile(r"Account\s*:?\s*(\d{10})\s*/\s*(.+?)\s*\(\s*([A-Z]{3})\s*\)", re.I | re.S)
_HOLDER_RE = re.compile(r"(?:NAMA|PEMILIK\s+REKENING)\s*:?\s*(.+)", re.I)
_HEADER_KEYWORDS = {"TANGGAL", "TRANSAKSI", "DEBIT", "KREDIT", "SALDO"}
_DIRECT_DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
_DIRECT_TIME_RE = re.compile(r"^\d{2}\.\d{2}\.\d{2}$")


class BNIAdapter(BaseAdapter):
    bank_code = "BNI"
    bank_name = "Bank Negara Indonesia"

    def parse(self, pdf_path: str) -> CanonicalStatement:
        import time
        t0 = time.time()
        text = self._extract_text(pdf_path)
        tables = self._extract_tables(pdf_path)

        period_start, period_end = self._extract_period(text)
        opening = self._extract_opening(text)
        closing = self._extract_closing(text)
        account_no = self._extract_account(text)
        holder = self._extract_holder(text)

        transactions = self._parse_direct_transactions(pdf_path)
        if not transactions:
            transactions = self._parse_transactions(tables)
        elapsed_ms = int((time.time() - t0) * 1000)

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

    def _extract_period(self, text: str) -> tuple[Optional[date], Optional[date]]:
        m = _PERIOD_RE.search(text)
        if m:
            return parse_date_id(m.group(1)), parse_date_id(m.group(2))
        m2 = _DIRECT_PERIOD_RE.search(text)
        if m2:
            return self._parse_direct_date(m2.group(1)), self._parse_direct_date(m2.group(2))
        return None, None

    def _extract_opening(self, text: str) -> Optional[Decimal]:
        m = _OPENING_RE.search(text)
        return self._parse_any_amount(m.group(1)) if m else None

    def _extract_closing(self, text: str) -> Optional[Decimal]:
        m = _CLOSING_RE.search(text)
        if m:
            return parse_idr_amount(m.group(1))

        summary = _DIRECT_CLOSING_RE.search(text)
        if not summary:
            return None

        opening = self._parse_direct_amount(summary.group(1))
        total_debit = self._parse_direct_amount(summary.group(2))
        total_credit = self._parse_direct_amount(summary.group(3))
        if opening is None or total_debit is None or total_credit is None:
            return None
        return opening - total_debit + total_credit

    def _extract_account(self, text: str) -> Optional[str]:
        m = _ACCOUNT_RE.search(text)
        if m:
            raw = re.sub(r"[\s-]", "", m.group(1))
            return "x" * max(0, len(raw) - 4) + raw[-4:]
        m2 = _DIRECT_ACCOUNT_RE.search(text)
        if m2:
            raw = m2.group(1)
            return "x" * max(0, len(raw) - 4) + raw[-4:]
        return None

    def _extract_holder(self, text: str) -> Optional[str]:
        m = _HOLDER_RE.search(text)
        if m:
            return m.group(1).strip().title()

        m2 = _DIRECT_ACCOUNT_RE.search(text)
        if m2:
            holder = " ".join(m2.group(2).split())
            return holder.title()
        return None

    def _parse_direct_date(self, raw: str) -> Optional[date]:
        raw = raw.strip()
        for fmt in ("%d/%m/%Y", "%d-%b-%Y"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
        return None

    def _parse_any_amount(self, raw: str) -> Optional[Decimal]:
        if not raw:
            return None

        compact = raw.strip().replace(" ", "")
        try:
            if "," in compact and "." in compact and compact.rfind(".") > compact.rfind(","):
                return Decimal(compact.replace(",", ""))
            return parse_idr_amount(compact)
        except InvalidOperation:
            return None

    def _parse_direct_amount(self, raw: str) -> Optional[Decimal]:
        return self._parse_any_amount(raw)

    def _parse_direct_transactions(self, pdf_path: str) -> list[CanonicalTransaction]:
        try:
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is unavailable; falling back to BNI table parser")
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
            cells = self._direct_cells_from_words(row_words)
            row_no = cells["no"]
            row_date = self._parse_direct_date(cells["post_date"])

            if row_no.isdigit() and row_date:
                if current:
                    self._append_direct_transaction(txns, current)
                current = {
                    "date": row_date,
                    "time": "",
                    "branch_parts": [cells["branch"]] if cells["branch"] else [],
                    "journal_no": cells["journal_no"],
                    "description_parts": [cells["description"]] if cells["description"] else [],
                    "amount": self._parse_direct_amount(cells["amount"]),
                    "direction": cells["direction"].upper(),
                    "balance": self._parse_direct_amount(cells["balance"]),
                }
                continue

            if current is None:
                continue

            if _DIRECT_TIME_RE.match(cells["post_date"]):
                current["time"] = cells["post_date"]
            if cells["branch"]:
                current["branch_parts"].append(cells["branch"])
            if cells["description"]:
                current["description_parts"].append(cells["description"])

        if current:
            self._append_direct_transaction(txns, current)

        return txns

    def _direct_cells_from_words(self, words: list[dict]) -> dict[str, str]:
        buckets: dict[str, list[str]] = {
            "no": [],
            "post_date": [],
            "branch": [],
            "journal_no": [],
            "description": [],
            "amount": [],
            "direction": [],
            "balance": [],
        }

        for word in words:
            text = str(word.get("text", "")).strip()
            x0 = float(word.get("x0", 0))

            if x0 < 58:
                buckets["no"].append(text)
            elif x0 < 145:
                buckets["post_date"].append(text)
            elif x0 < 235:
                buckets["branch"].append(text)
            elif x0 < 305:
                buckets["journal_no"].append(text)
            elif x0 < 585:
                buckets["description"].append(text)
            elif x0 < 665:
                buckets["amount"].append(text)
            elif x0 < 715:
                buckets["direction"].append(text)
            else:
                buckets["balance"].append(text)

        return {key: " ".join(value).strip() for key, value in buckets.items()}

    def _append_direct_transaction(self, txns: list[CanonicalTransaction], current: dict) -> None:
        amount = current.get("amount")
        direction = current.get("direction")
        if amount is None or direction not in {"D", "C"}:
            return

        debit = amount if direction == "D" else None
        credit = amount if direction == "C" else None
        description = " ".join(" ".join(current.get("description_parts", [])).split())
        branch = " ".join(" ".join(current.get("branch_parts", [])).split())

        txns.append(CanonicalTransaction(
            row=len(txns) + 1,
            date=current["date"],
            description_raw=description or f"TXN-{len(txns) + 1}",
            debit=debit if debit and debit > 0 else None,
            credit=credit if credit and credit > 0 else None,
            balance=current.get("balance"),
            confidence=0.96 if current.get("balance") is not None else 0.82,
            source=TransactionSource.adapter,
            raw_meta={
                "time": current.get("time"),
                "branch": branch,
                "journal_no": current.get("journal_no"),
                "db_cr": direction,
            },
        ))

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

                date_raw = cells[COL_DATE]
                if not date_raw or any(kw in date_raw.upper() for kw in _HEADER_KEYWORDS):
                    continue

                txn_date = parse_date_id(date_raw)
                if txn_date is None:
                    continue

                debit = parse_idr_amount(cells[COL_DEBIT]) if len(cells) > COL_DEBIT else None
                credit = parse_idr_amount(cells[COL_CREDIT]) if len(cells) > COL_CREDIT else None
                balance = parse_idr_amount(cells[COL_BALANCE]) if len(cells) > COL_BALANCE else None

                if debit is None and credit is None:
                    continue

                row_idx += 1
                conf = 0.96 if balance is not None else 0.78

                txns.append(CanonicalTransaction(
                    row=row_idx,
                    date=txn_date,
                    description_raw=cells[COL_DESC],
                    debit=debit if debit and debit > 0 else None,
                    credit=credit if credit and credit > 0 else None,
                    balance=balance,
                    confidence=conf,
                    source=TransactionSource.adapter,
                ))

        return txns

    def _is_transaction_table(self, table: list) -> bool:
        for row in table[:3]:
            joined = " ".join(str(c or "") for c in row).upper()
            if "SALDO" in joined and ("DEBIT" in joined or "KREDIT" in joined):
                return True
        return False
