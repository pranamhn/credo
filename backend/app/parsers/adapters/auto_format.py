"""
General bank statement adapter for formats without a trained bank-specific parser.

This adapter favors broad extraction over strict bank identity. It handles common
Indonesian/English statement tables and simple text/OCR layouts.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from .base import BaseAdapter, parse_date_id
from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionSource

logger = logging.getLogger(__name__)

_LARGE_PDF_PAGE_THRESHOLD = 100
_LARGE_PDF_TEXT_SAMPLE_PAGES = 8

_HEADER_KEYWORDS = {
    "DATE", "TANGGAL", "POSTING", "VALUE", "KETERANGAN", "URAIAN", "DESCRIPTION",
    "REMARK", "TRANSACTION", "DEBIT", "DEBET", "CREDIT", "KREDIT", "MUTASI",
    "AMOUNT", "BALANCE", "SALDO",
}
_COLUMN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "date": (
        "TANGGAL", "DATE", "POSTING DATE", "POST DATE", "VALUE DATE", "TGL",
        "TRX DATE", "TXN DATE", "TRANSACTION DATE",
    ),
    "description": (
        "KETERANGAN", "URAIAN", "DESCRIPTION", "DESKRIPSI", "REMARK",
        "DETAIL", "NARRATIVE", "BERITA", "TRANSACTION", "TRANSAKSI",
    ),
    "debit": (
        "DEBIT", "DEBET", "WITHDRAWAL", "PENARIKAN", "KELUAR",
        "MONEY OUT", "OUT", "DB",
    ),
    "credit": (
        "CREDIT", "KREDIT", "DEPOSIT", "SETORAN", "MASUK",
        "MONEY IN", "IN", "CR",
    ),
    "mutation": (
        "MUTASI", "AMOUNT", "JUMLAH", "NOMINAL", "TRANSACTION AMOUNT",
        "NILAI TRANSAKSI", "TRX AMOUNT",
    ),
    "balance": (
        "SALDO", "BALANCE", "RUNNING BALANCE", "ENDING BALANCE",
        "SISA SALDO", "AVAILABLE BALANCE",
    ),
}
_COLUMN_PRIORITY = ("date", "balance", "debit", "credit", "mutation", "description")
_DATE_START_RE = re.compile(
    r"^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}|[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{1,2}-\d{1,2})\b",
    re.I,
)
_DUAL_SHORT_DATE_RE = re.compile(r"^(\d{1,2}/\d{1,2})\s+(\d{1,2}/\d{1,2})\s+(.+)$")
_AMOUNT_RE = re.compile(r"(?<!\d)([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|[\d]+(?:[.,]\d{2})?)\s*(CR|DB|C|D)?\b", re.I)
_PERIOD_RE = re.compile(
    r"(?:PERIODE|PERIOD|FROM|DARI)\s*:?\s*"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}|[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4})"
    r"\s*(?:-|–|S/D|SD|TO|SAMPAI)\s*"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}|[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4})",
    re.I,
)
_OPENING_RE = re.compile(r"(?:SALDO\s+AWAL|OPENING\s+BALANCE|BEGINNING\s+BALANCE)\s*:?\s*([\d.,]+)", re.I)
_CLOSING_RE = re.compile(r"(?:SALDO\s+AKHIR|CLOSING\s+BALANCE|ENDING\s+BALANCE)\s*:?\s*([\d.,]+)", re.I)
_ACCOUNT_RE = re.compile(r"(?:NO\.?\s*(?:REKENING|REK)|NOMOR\s+REKENING|ACCOUNT\s+(?:NO|NUMBER))\s*:?\s*([0-9][0-9\s.-]{5,}[0-9])", re.I)
_HOLDER_RE = re.compile(r"(?:NAMA\s+(?:NASABAH|PEMILIK)?|ACCOUNT\s+NAME|CUSTOMER\s+NAME|NAME)\s*:?\s*([A-Z0-9 .,&'/-]{3,80})", re.I)
_BANK_RE = re.compile(r"\b(?:PT\s+)?BANK\s+([A-Z][A-Z0-9 .&'-]{2,40})", re.I)

_ID_MONTHS = {
    "JANUARI": "JANUARY", "FEBRUARI": "FEBRUARY", "MARET": "MARCH", "APRIL": "APRIL",
    "MEI": "MAY", "JUNI": "JUNE", "JULI": "JULY", "AGUSTUS": "AUGUST",
    "SEPTEMBER": "SEPTEMBER", "OKTOBER": "OCTOBER", "NOVEMBER": "NOVEMBER", "DESEMBER": "DECEMBER",
}


class AutoFormatAdapter(BaseAdapter):
    bank_code = "AUTO"
    bank_name = "Auto Format Bank Statement"

    def parse(self, pdf_path: str) -> CanonicalStatement:
        import time

        t0 = time.time()
        page_count = self._pdf_page_count(pdf_path)
        large_pdf = page_count is not None and page_count > _LARGE_PDF_PAGE_THRESHOLD
        text = self._extract_text(pdf_path, max_pages=_LARGE_PDF_TEXT_SAMPLE_PAGES if large_pdf else None)
        period_start, period_end = self._extract_period(text)
        default_year = (period_end or period_start).year if (period_end or period_start) else None
        ocr_used = False

        if large_pdf:
            logger.info("Auto-format large PDF mode enabled: %s pages", page_count)
            transactions = self._parse_tables_streaming(pdf_path)
        else:
            tables = self._extract_tables(pdf_path)
            transactions = self._parse_tables(tables)

        if not transactions:
            transactions = self._parse_text_transactions(text, default_year=default_year)

        if not transactions and not text.strip():
            ocr_max_pages = _LARGE_PDF_TEXT_SAMPLE_PAGES if large_pdf else None
            ocr_text = self._extract_ocr_text(pdf_path, max_pages=ocr_max_pages)
            if ocr_text:
                ocr_used = True
                text = ocr_text
                period_start, period_end = self._extract_period(text)
                default_year = (period_end or period_start).year if (period_end or period_start) else default_year
                transactions = self._parse_text_transactions(text, default_year=default_year)

        transactions = self._infer_missing_directions(transactions)
        opening = self._extract_opening(text)
        closing = self._extract_closing(text)
        if opening is None and transactions and transactions[0].balance is not None:
            opening = transactions[0].balance - (transactions[0].credit or Decimal(0)) + (transactions[0].debit or Decimal(0))
        if closing is None and transactions and transactions[-1].balance is not None:
            closing = transactions[-1].balance

        elapsed_ms = int((time.time() - t0) * 1000)
        bank_name = self._extract_bank_name(text)

        return CanonicalStatement(
            bank_code=self.bank_code,
            bank_name=bank_name or self.bank_name,
            account_no_masked=self._extract_account(text),
            account_holder=self._extract_holder(text),
            period_start=period_start,
            period_end=period_end,
            currency="IDR",
            opening_balance=opening,
            closing_balance=closing,
            transactions=transactions,
            parse_meta=self._make_meta(
                processing_time_ms=elapsed_ms,
                ocr=ocr_used,
                template_version=2 if large_pdf else None,
            ),
        )

    def _pdf_page_count(self, pdf_path: str) -> Optional[int]:
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                return len(pdf.pages)
        except Exception as exc:
            logger.warning("Unable to count PDF pages: %s", exc)
            return None

    def _parse_tables(self, tables: list) -> list[CanonicalTransaction]:
        txns: list[CanonicalTransaction] = []
        for table in tables:
            header_map = self._find_header_map(table)
            if not header_map:
                continue

            for row in table:
                cells = [self._clean_cell(cell) for cell in row]
                if not cells or self._looks_like_header(cells):
                    continue
                txn = self._transaction_from_cells(cells, header_map, len(txns) + 1)
                if txn:
                    txns.append(txn)
        return txns

    def _parse_tables_streaming(self, pdf_path: str) -> list[CanonicalTransaction]:
        try:
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is unavailable; large PDF table parser cannot run")
            return []

        txns: list[CanonicalTransaction] = []
        header_map: Optional[dict[str, int]] = None

        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                try:
                    tables = page.extract_tables() or []
                except Exception as exc:
                    logger.warning("Skipping page %d table extraction failure: %s", page_idx + 1, exc)
                    continue

                for table in tables:
                    if not table:
                        continue

                    page_map = self._find_header_map(table)
                    if page_map:
                        header_map = page_map
                    if not header_map:
                        continue

                    for row in table:
                        cells = [self._clean_cell(cell) for cell in row or []]
                        if not cells or self._looks_like_header(cells):
                            continue
                        txn = self._transaction_from_cells(cells, header_map, len(txns) + 1)
                        if txn:
                            txns.append(txn)

                if (page_idx + 1) % 25 == 0:
                    logger.info("Auto-format large PDF progress: page %d/%d, rows=%d", page_idx + 1, len(pdf.pages), len(txns))

        return txns

    def _find_header_map(self, table: list) -> Optional[dict[str, int]]:
        best_mapping: Optional[dict[str, int]] = None
        best_score = 0

        for row_idx in range(len(table)):
            for window_size in (1, 2, 3):
                cells = self._merged_header_cells(table, row_idx, window_size)
                if not cells:
                    continue

                joined = " ".join(cells)
                if self._header_hit_count(joined) < 2:
                    continue

                mapping = self._map_header_cells(cells)
                if not self._is_usable_mapping(mapping):
                    continue

                score = self._score_mapping(mapping, joined, table, row_idx, window_size)
                if score > best_score:
                    best_score = score
                    best_mapping = mapping

        if best_mapping and best_score >= 8:
            return best_mapping

        return self._infer_mapping_from_data(table)

    def _merged_header_cells(self, table: list, start_row: int, window_size: int) -> list[str]:
        rows = table[start_row:start_row + window_size]
        if not rows:
            return []

        width = max((len(row or []) for row in rows), default=0)
        merged: list[str] = []
        for col_idx in range(width):
            parts = []
            for row in rows:
                if row and col_idx < len(row):
                    value = self._clean_cell(row[col_idx])
                    if value:
                        parts.append(value.upper())
            merged.append(" ".join(parts))
        return merged

    def _header_hit_count(self, joined: str) -> int:
        return sum(1 for keyword in _HEADER_KEYWORDS if keyword in joined)

    def _map_header_cells(self, cells: list[str]) -> dict[str, int]:
        mapping: dict[str, int] = {}
        for idx, cell in enumerate(cells):
            if not cell:
                continue

            field_scores: dict[str, int] = {}
            for field, keywords in _COLUMN_KEYWORDS.items():
                score = sum(2 if keyword == cell else 1 for keyword in keywords if keyword in cell)
                if score:
                    field_scores[field] = score

            if not field_scores:
                continue

            best_field = max(
                field_scores,
                key=lambda field: (field_scores[field], -_COLUMN_PRIORITY.index(field)),
            )
            if best_field not in mapping:
                mapping[best_field] = idx

        return mapping

    def _is_usable_mapping(self, mapping: dict[str, int]) -> bool:
        has_amount = "debit" in mapping or "credit" in mapping or "mutation" in mapping
        has_context = "description" in mapping or "mutation" in mapping
        return "date" in mapping and has_context and has_amount

    def _score_mapping(
        self,
        mapping: dict[str, int],
        joined_header: str,
        table: list,
        header_row_idx: int,
        window_size: int,
    ) -> int:
        score = self._header_hit_count(joined_header) * 2
        score += len(mapping)
        if "balance" in mapping:
            score += 2
        if "debit" in mapping and "credit" in mapping:
            score += 3

        sample_rows = table[:header_row_idx] + table[header_row_idx + window_size:]
        valid_rows = 0
        for row in sample_rows:
            cells = [self._clean_cell(cell) for cell in row or []]
            if not cells or self._looks_like_header(cells):
                continue

            date_value = self._cell(cells, mapping.get("date"))
            if self._parse_date(date_value) is None:
                continue

            amount_hits = 0
            for field in ("debit", "credit", "mutation", "balance"):
                if self._parse_amount(self._cell(cells, mapping.get(field))) is not None:
                    amount_hits += 1
            if amount_hits:
                valid_rows += 1

        return score + min(valid_rows, 10) * 3

    def _infer_mapping_from_data(self, table: list) -> Optional[dict[str, int]]:
        width = max((len(row or []) for row in table), default=0)
        if width < 3:
            return None

        column_stats: list[dict[str, int]] = [
            {"date": 0, "amount": 0, "text": 0} for _ in range(width)
        ]
        for row in table:
            cells = [self._clean_cell(cell) for cell in row or []]
            if not cells or self._looks_like_header(cells):
                continue
            for idx in range(width):
                cell = self._cell(cells, idx)
                if not cell:
                    continue
                if self._parse_date(cell) is not None:
                    column_stats[idx]["date"] += 1
                if self._parse_amount(cell) is not None:
                    column_stats[idx]["amount"] += 1
                if re.search(r"[A-Za-z]", cell) and len(cell) >= 3:
                    column_stats[idx]["text"] += 1

        date_col = self._best_stat_column(column_stats, "date")
        amount_cols = [
            idx for idx, stats in enumerate(column_stats)
            if stats["amount"] >= 2 and idx != date_col
        ]
        if date_col is None or not amount_cols:
            return None

        text_candidates = [
            idx for idx, stats in enumerate(column_stats)
            if stats["text"] >= 2 and idx != date_col
        ]
        description_col = max(text_candidates, key=lambda idx: column_stats[idx]["text"], default=None)

        mapping: dict[str, int] = {"date": date_col}
        if description_col is not None:
            mapping["description"] = description_col

        if len(amount_cols) >= 3:
            mapping["debit"] = amount_cols[-3]
            mapping["credit"] = amount_cols[-2]
            mapping["balance"] = amount_cols[-1]
        elif len(amount_cols) == 2:
            mapping["mutation"] = amount_cols[0]
            mapping["balance"] = amount_cols[1]
        else:
            mapping["mutation"] = amount_cols[0]

        return mapping if self._is_usable_mapping(mapping) else None

    def _best_stat_column(self, stats: list[dict[str, int]], key: str) -> Optional[int]:
        best_idx: Optional[int] = None
        best_value = 0
        for idx, value in enumerate(stats):
            if value[key] > best_value:
                best_idx = idx
                best_value = value[key]
        return best_idx if best_value >= 2 else None

    def _transaction_from_cells(self, cells: list[str], mapping: dict[str, int], row_number: int) -> Optional[CanonicalTransaction]:
        date_raw = self._cell(cells, mapping.get("date"))
        txn_date = self._parse_date(date_raw)
        if txn_date is None:
            return None

        debit = self._parse_amount(self._cell(cells, mapping.get("debit")))
        credit = self._parse_amount(self._cell(cells, mapping.get("credit")))
        mutation_raw = self._cell(cells, mapping.get("mutation"))
        if debit is None and credit is None and mutation_raw:
            mutation, direction = self._parse_mutation(mutation_raw)
            if mutation is not None:
                if direction in ("CR", "C"):
                    credit = mutation
                else:
                    debit = mutation

        if debit is None and credit is None:
            return None

        description = self._cell(cells, mapping.get("description")) or self._build_description(cells, mapping)
        balance = self._parse_amount(self._cell(cells, mapping.get("balance")))
        return CanonicalTransaction(
            row=row_number,
            date=txn_date,
            description_raw=description or f"TXN-{row_number}",
            debit=debit,
            credit=credit,
            balance=balance,
            confidence=0.78 if balance is not None else 0.66,
            source=TransactionSource.adapter,
        )

    def _parse_text_transactions(self, text: str, default_year: Optional[int] = None) -> list[CanonicalTransaction]:
        cimb_rows = self._parse_cimb_like_text_transactions(text, default_year)
        if cimb_rows:
            return cimb_rows

        rows: list[str] = []
        current: list[str] = []
        for raw_line in text.splitlines():
            line = " ".join(raw_line.split())
            if not line or self._looks_like_header([line]):
                continue
            if _DATE_START_RE.match(line):
                if current:
                    rows.append(" ".join(current))
                current = [line]
            elif current:
                current.append(line)
        if current:
            rows.append(" ".join(current))

        txns: list[CanonicalTransaction] = []
        for row in rows:
            txn = self._transaction_from_text_row(row, len(txns) + 1, default_year=default_year)
            if txn:
                txns.append(txn)
        return txns

    def _parse_cimb_like_text_transactions(self, text: str, default_year: Optional[int]) -> list[CanonicalTransaction]:
        if "TGL. TXN" not in text.upper() or "TGL. VALUTA" not in text.upper():
            return []

        txns: list[CanonicalTransaction] = []
        pending_desc: list[str] = []
        skip_terms = (
            "KEPADA / TO",
            "LAPORAN TRANSAKSI",
            "ACCOUNT STATEMENT",
            "TANGGAL LAPORAN",
            "STATEMENT DATE",
            "TGL. PEMBUKAAN",
            "OPENING DATE",
            "PERIODE",
            "PERIOD",
            "NO. REKENING",
            "ACCOUNT NUMBER",
            "NAMA PRODUK",
            "PRODUCT NAME",
            "MATA UANG",
            "CURRENCY",
            "NOMOR CIF",
            "CIF NUMBER",
            "TGL. TXN",
            "TXN. DATE",
            "SALDO AWAL",
            "TERIMA KASIH",
            "THANK YOU",
            "HALAMAN / PAGE",
        )

        for raw_line in text.splitlines():
            line = " ".join(raw_line.split())
            if not line:
                continue
            upper = line.upper()

            match = _DUAL_SHORT_DATE_RE.match(line)
            if not match:
                if any(term in upper for term in skip_terms):
                    pending_desc = []
                    continue
                if self._looks_like_reference_line(line):
                    continue
                if re.search(r"[A-Za-z]", line) and len(line) >= 3:
                    pending_desc.append(line)
                    pending_desc = pending_desc[-4:]
                continue

            txn_date = self._parse_date(match.group(1), default_year=default_year)
            value_date = self._parse_date(match.group(2), default_year=default_year)
            body = match.group(3).strip()
            amount_matches = [m for m in _AMOUNT_RE.finditer(body) if self._parse_amount(m.group(1)) is not None]
            if len(amount_matches) < 2:
                pending_desc = []
                continue

            mutation_match = amount_matches[-2]
            balance_match = amount_matches[-1]
            amount = self._parse_amount(mutation_match.group(1))
            balance = self._parse_amount(balance_match.group(1))
            if txn_date is None or amount is None:
                pending_desc = []
                continue

            inline_desc = body[:mutation_match.start()].strip(" -")
            description = " ".join([*pending_desc, inline_desc]).strip() or f"TXN-{len(txns) + 1}"

            txns.append(CanonicalTransaction(
                row=len(txns) + 1,
                date=txn_date,
                value_date=value_date,
                description_raw=description,
                debit=amount,
                credit=None,
                balance=balance,
                confidence=0.74 if balance is not None else 0.62,
                source=TransactionSource.adapter,
            ))
            pending_desc = []

        return txns

    def _looks_like_reference_line(self, line: str) -> bool:
        compact = line.replace(" ", "")
        if re.match(r"^\d{6}[A-Z]{2,}\d+$", compact):
            return True
        if re.match(r"^[A-Z]{2}\d{8,}$", compact):
            return True
        return False

    def _transaction_from_text_row(self, row_text: str, row_number: int, default_year: Optional[int] = None) -> Optional[CanonicalTransaction]:
        date_match = _DATE_START_RE.match(row_text)
        if not date_match:
            return None
        txn_date = self._parse_date(date_match.group(1), default_year=default_year)
        if txn_date is None:
            return None

        body = row_text[date_match.end():].strip()
        matches = [match for match in _AMOUNT_RE.finditer(body) if self._parse_amount(match.group(1)) is not None]
        if not matches:
            return None

        balance = self._parse_amount(matches[-1].group(1)) if len(matches) >= 2 else None
        mutation_match = next((match for match in matches if match.group(2)), None)
        if mutation_match is None:
            mutation_match = matches[-2] if len(matches) >= 2 else matches[-1]

        amount = self._parse_amount(mutation_match.group(1))
        if amount is None:
            return None

        direction = (mutation_match.group(2) or "DB").upper()
        debit = amount if direction in ("DB", "D") else None
        credit = amount if direction in ("CR", "C") else None
        description = body[:mutation_match.start()].strip(" -")

        return CanonicalTransaction(
            row=row_number,
            date=txn_date,
            description_raw=description or f"TXN-{row_number}",
            debit=debit,
            credit=credit,
            balance=balance,
            confidence=0.62 if balance is not None else 0.55,
            source=TransactionSource.adapter,
        )

    def _infer_missing_directions(self, transactions: list[CanonicalTransaction]) -> list[CanonicalTransaction]:
        previous_balance: Optional[Decimal] = None
        fixed: list[CanonicalTransaction] = []
        for txn in transactions:
            if previous_balance is not None and txn.balance is not None:
                amount = txn.debit or txn.credit
                if amount is not None:
                    delta = txn.balance - previous_balance
                    if delta > 0 and txn.debit == amount and txn.credit is None:
                        txn.credit = amount
                        txn.debit = None
                    elif delta < 0 and txn.credit == amount and txn.debit is None:
                        txn.debit = amount
                        txn.credit = None
            if txn.balance is not None:
                previous_balance = txn.balance
            fixed.append(txn)
        return fixed

    def _extract_period(self, text: str) -> tuple[Optional[date], Optional[date]]:
        match = _PERIOD_RE.search(text)
        if not match:
            return None, None
        return self._parse_date(match.group(1)), self._parse_date(match.group(2))

    def _extract_opening(self, text: str) -> Optional[Decimal]:
        match = _OPENING_RE.search(text)
        return self._parse_amount(match.group(1)) if match else None

    def _extract_closing(self, text: str) -> Optional[Decimal]:
        match = _CLOSING_RE.search(text)
        return self._parse_amount(match.group(1)) if match else None

    def _extract_account(self, text: str) -> Optional[str]:
        match = _ACCOUNT_RE.search(text)
        if not match:
            match = re.search(r"\b(\d{9,16})\b", text)
        if not match:
            return None
        raw = re.sub(r"\D", "", match.group(1))
        return "x" * max(0, len(raw) - 4) + raw[-4:] if raw else None

    def _extract_holder(self, text: str) -> Optional[str]:
        match = _HOLDER_RE.search(text)
        if not match:
            return None
        holder = " ".join(match.group(1).split())
        holder = re.split(r"\s+(?:NO\.?\s*REK|ACCOUNT|PERIODE|PERIOD|SALDO)\b", holder, maxsplit=1, flags=re.I)[0].strip()
        return holder.title() if holder.isupper() else holder

    def _extract_bank_name(self, text: str) -> Optional[str]:
        match = _BANK_RE.search(text.upper())
        if not match:
            return None
        name = "Bank " + " ".join(match.group(1).split())
        return re.split(r"\s+(?:TBK|STATEMENT|LAPORAN|CABANG)\b", name, maxsplit=1, flags=re.I)[0].title()

    def _parse_mutation(self, raw: str) -> tuple[Optional[Decimal], Optional[str]]:
        match = _AMOUNT_RE.search(raw)
        if not match:
            return None, None
        return self._parse_amount(match.group(1)), (match.group(2) or "").upper() or None

    def _parse_amount(self, raw: str) -> Optional[Decimal]:
        if not raw:
            return None
        compact = raw.strip().replace(" ", "")
        if not compact or compact in ("-", "0", "0.00", "0,00"):
            return None
        compact = re.sub(r"[^0-9.,-]", "", compact)
        if not compact or compact in ("-", ".", ","):
            return None

        try:
            if "," in compact and "." in compact:
                if compact.rfind(".") > compact.rfind(","):
                    amount = Decimal(compact.replace(",", ""))
                else:
                    amount = Decimal(compact.replace(".", "").replace(",", "."))
            elif "," in compact:
                parts = compact.split(",")
                if len(parts[-1]) == 2:
                    amount = Decimal(compact.replace(".", "").replace(",", "."))
                else:
                    amount = Decimal(compact.replace(",", ""))
            elif "." in compact:
                parts = compact.split(".")
                if len(parts[-1]) == 2:
                    amount = Decimal(compact.replace(",", ""))
                else:
                    amount = Decimal(compact.replace(".", ""))
            else:
                amount = Decimal(compact)
        except InvalidOperation:
            return None

        return None if amount == 0 else amount

    def _parse_date(self, raw: str, default_year: Optional[int] = None) -> Optional[date]:
        raw = self._normalize_month(raw.strip())
        if default_year and re.match(r"^\d{1,2}[/-]\d{1,2}$", raw):
            raw = f"{raw}/{default_year}"
        parsed = parse_date_id(raw)
        if parsed:
            return parsed
        for fmt in ("%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
        return None

    def _normalize_month(self, raw: str) -> str:
        normalized = raw
        for source, target in _ID_MONTHS.items():
            normalized = re.sub(rf"\b{source}\b", target, normalized, flags=re.I)
        return normalized

    def _looks_like_header(self, cells: list[str]) -> bool:
        joined = " ".join(cells).upper()
        return sum(1 for keyword in _HEADER_KEYWORDS if keyword in joined) >= 3

    def _cell(self, cells: list[str], idx: Optional[int]) -> str:
        if idx is None or idx >= len(cells):
            return ""
        return cells[idx]

    def _build_description(self, cells: list[str], mapping: dict[str, int]) -> str:
        used = {idx for idx in mapping.values()}
        return " ".join(cell for idx, cell in enumerate(cells) if idx not in used and cell).strip()
