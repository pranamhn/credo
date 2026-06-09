"""
PARSE-06 — BRI Adapter
Handles BRI e-statement PDFs.

Supported layouts:
  - Retail table: Tanggal | Keterangan | Debit | Kredit | Saldo
  - IBBIZ financial transaction report:
    Tanggal Transaksi | Uraian Transaksi | Teller | Debet | Kredit | Saldo
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

_PERIOD_RE = re.compile(r"(?:PERIODE|TANGGAL\s+CETAK)\s*:?\s*(\d{2}/\d{2}/\d{4})\s*[-–]\s*(\d{2}/\d{2}/\d{4})", re.I)
_IBBIZ_PERIOD_RE = re.compile(r"Periode\s+Transaksi\s*:?\s*(\d{2}/\d{2}/\d{2})\s*[-–]\s*(\d{2}/\d{2}/\d{2})", re.I)
_OPENING_RE = re.compile(r"SALDO\s+AWAL\s*:?\s*([\d.,]+)", re.I)
_CLOSING_RE = re.compile(r"SALDO\s+AKHIR\s*:?\s*([\d.,]+)", re.I)
_ACCOUNT_RE = re.compile(r"NO\.?\s*(?:REKENING|REK)\s*:?\s*(\d[\d\s-]+\d)", re.I)
_IBBIZ_HOLDER_RE = re.compile(r"Kepada\s+Yth\.?\s*/?\s*([A-Z0-9 .,&'-]+?)\s+(?:JL|JLN|No\.?\s*Rekening|Tanggal\s+Laporan)\b", re.I | re.S)
_HOLDER_RE = re.compile(r"(?:NAMA|PEMILIK)\s*:?\s*(.+)", re.I)
_HEADER_KEYWORDS = {"TANGGAL", "KETERANGAN", "DEBET", "KREDIT", "SALDO"}
_IBBIZ_DATETIME_RE = re.compile(r"^\d{2}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}$")
_IBBIZ_SUMMARY_RE = re.compile(
    r"Saldo\s+Awal\s+Total\s+Transaksi\s+Debet\s+Total\s+Transaksi\s+Kredit\s+Saldo\s+Akhir\s+"
    r"([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})",
    re.I | re.S,
)


class BRIAdapter(BaseAdapter):
    bank_code = "BRI"
    bank_name = "Bank Rakyat Indonesia"

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

        transactions = self._parse_ibbiz_transactions(pdf_path)
        if not transactions:
            transactions = self._parse_transactions(tables)

        if opening is None and transactions and transactions[0].balance is not None:
            opening = transactions[0].balance - (transactions[0].credit or Decimal(0)) + (transactions[0].debit or Decimal(0))
        if closing is None and transactions and transactions[-1].balance is not None:
            closing = transactions[-1].balance
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
        m2 = _IBBIZ_PERIOD_RE.search(text)
        if m2:
            return parse_date_id(m2.group(1), "%d/%m/%y"), parse_date_id(m2.group(2), "%d/%m/%y")
        return None, None

    def _extract_opening(self, text: str) -> Optional[Decimal]:
        m = _OPENING_RE.search(text)
        if m:
            return parse_idr_amount(m.group(1))
        summary = _IBBIZ_SUMMARY_RE.search(text)
        return self._parse_ibbiz_amount(summary.group(1)) if summary else None

    def _extract_closing(self, text: str) -> Optional[Decimal]:
        m = _CLOSING_RE.search(text)
        if m:
            return parse_idr_amount(m.group(1))
        summary = _IBBIZ_SUMMARY_RE.search(text)
        return self._parse_ibbiz_amount(summary.group(4)) if summary else None

    def _extract_account(self, text: str) -> Optional[str]:
        m = _ACCOUNT_RE.search(text)
        if m:
            raw = re.sub(r"[\s-]", "", m.group(1))
            return "x" * max(0, len(raw) - 4) + raw[-4:]
        return None

    def _extract_holder(self, text: str) -> Optional[str]:
        m = _HOLDER_RE.search(text)
        if m:
            return m.group(1).strip().title()
        m2 = _IBBIZ_HOLDER_RE.search(text)
        if m2:
            holder = " ".join(m2.group(1).split())
            return holder.title() if holder.isupper() else holder
        return None

    def _parse_ibbiz_datetime(self, raw: str) -> Optional[date]:
        raw = raw.strip()
        try:
            return datetime.strptime(raw, "%d/%m/%y %H:%M:%S").date()
        except ValueError:
            return None

    def _parse_ibbiz_amount(self, raw: str) -> Optional[Decimal]:
        if not raw:
            return None
        compact = raw.strip().replace(" ", "")
        try:
            if "," in compact and "." in compact and compact.rfind(".") > compact.rfind(","):
                amount = Decimal(compact.replace(",", ""))
            else:
                parsed = parse_idr_amount(compact)
                amount = parsed if parsed is not None else Decimal(0)
        except InvalidOperation:
            return None
        return None if amount == 0 else amount

    def _parse_ibbiz_transactions(self, pdf_path: str) -> list[CanonicalTransaction]:
        try:
            # pyrefly: ignore [missing-import]
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is unavailable; falling back to BRI table parser")
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
            cells = self._ibbiz_cells_from_words(row_words)
            txn_date = self._parse_ibbiz_datetime(cells["date"])

            if txn_date:
                if current:
                    self._append_ibbiz_transaction(txns, current)
                current = {
                    "date": txn_date,
                    "datetime": cells["date"],
                    "description_parts": [cells["description"]] if cells["description"] else [],
                    "teller": cells["teller"],
                    "debit": self._parse_ibbiz_amount(cells["debit"]),
                    "credit": self._parse_ibbiz_amount(cells["credit"]),
                    "balance": self._parse_ibbiz_amount(cells["balance"]),
                }
                continue

            if current is None:
                continue

            if cells["description"]:
                current["description_parts"].append(cells["description"])
            if cells["teller"] and not current.get("teller"):
                current["teller"] = cells["teller"]

        if current:
            self._append_ibbiz_transaction(txns, current)

        return txns

    def _ibbiz_cells_from_words(self, words: list[dict]) -> dict[str, str]:
        buckets: dict[str, list[str]] = {
            "date": [],
            "description": [],
            "teller": [],
            "debit": [],
            "credit": [],
            "balance": [],
        }

        for word in words:
            text = str(word.get("text", "")).strip()
            x0 = float(word.get("x0", 0))

            if x0 < 108:
                buckets["date"].append(text)
            elif x0 < 292:
                buckets["description"].append(text)
            elif x0 < 370:
                buckets["teller"].append(text)
            elif x0 < 470:
                buckets["debit"].append(text)
            elif x0 < 560:
                buckets["credit"].append(text)
            else:
                buckets["balance"].append(text)

        return {key: " ".join(value).strip() for key, value in buckets.items()}

    def _append_ibbiz_transaction(self, txns: list[CanonicalTransaction], current: dict) -> None:
        debit = current.get("debit")
        credit = current.get("credit")
        if debit is None and credit is None:
            return

        description = " ".join(" ".join(current.get("description_parts", [])).split())
        teller = " ".join(str(current.get("teller", "")).split())

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
                "datetime": current.get("datetime"),
                "teller": teller,
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
            if ("DEBET" in joined or "KREDIT" in joined) and "SALDO" in joined:
                return True
        return False
