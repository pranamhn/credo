"""
PARSE-10 — LLM Fallback Parser (Claude API)
Used when: adapter fails, confidence < threshold, unknown bank, or scanned PDF.
Sends page content to Claude with structured-output prompt.
PII is redacted before sending if configured.
"""
from __future__ import annotations
import json
import logging
import re
import time
from datetime import date
from decimal import Decimal
from typing import Optional

import anthropic

from app.config import settings
from app.schemas.canonical import (
    CanonicalStatement,
    CanonicalTransaction,
    ParseMeta,
    TransactionSource,
    TransactionCategory,
)

logger = logging.getLogger(__name__)

_REDACT_PATTERNS = [
    (re.compile(r"\b\d{10,16}\b"), "[ACCT]"),             # Account numbers
    (re.compile(r"\b\d{16}\b"), "[CARD]"),                 # Card numbers
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),      # General ID numbers
]

SYSTEM_PROMPT = """Kamu adalah parser rekening koran bank Indonesia yang sangat akurat.
Tugasmu: ekstrak semua transaksi dari teks rekening koran yang diberikan dan kembalikan
dalam format JSON yang tepat.

Aturan:
- Setiap baris transaksi harus memiliki: row, date (YYYY-MM-DD), description_raw, debit ATAU credit (integer IDR, bukan keduanya), balance (jika tersedia)
- Jika ada kolom saldo, isi balance
- Jika tidak ada kolom saldo, biarkan null
- Pisahkan debit dan kredit — jangan gabungkan
- Format angka: hapus titik separator ribuan, koma jadi titik desimal. Hasilkan integer (tanpa desimal) jika tidak ada sen
- Jangan sertakan baris header atau baris total sebagai transaksi
- Perkirakan bank_code dari header (BCA/MDR/BRI/BNI/BTN/BSI/CIMB/dst)
- Kembalikan HANYA JSON, tidak ada teks lain

Format output JSON:
{
  "bank_code": "BCA",
  "bank_name": "Bank Central Asia",
  "account_no_masked": "xxxxxx1234",
  "account_holder": "NAMA NASABAH",
  "period_start": "2026-01-01",
  "period_end": "2026-01-31",
  "currency": "IDR",
  "opening_balance": 5000000,
  "closing_balance": 3500000,
  "transactions": [
    {
      "row": 1,
      "date": "2026-01-03",
      "description_raw": "TRSF E-BANKING CR ...",
      "debit": null,
      "credit": 1500000,
      "balance": 6500000
    }
  ]
}"""


def _redact_pii(text: str) -> str:
    for pattern, replacement in _REDACT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def _extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from PDF for LLM consumption."""
    import pdfplumber
    parts: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


def _parse_llm_transaction(raw: dict, row_offset: int = 0) -> Optional[CanonicalTransaction]:
    try:
        row = raw.get("row", row_offset + 1)
        date_raw = raw.get("date", "")
        date_parsed: Optional[date] = None
        if date_raw:
            from datetime import datetime
            try:
                date_parsed = datetime.strptime(date_raw, "%Y-%m-%d").date()
            except ValueError:
                return None

        debit_raw = raw.get("debit")
        credit_raw = raw.get("credit")
        balance_raw = raw.get("balance")

        debit = Decimal(str(debit_raw)) if debit_raw is not None else None
        credit = Decimal(str(credit_raw)) if credit_raw is not None else None
        balance = Decimal(str(balance_raw)) if balance_raw is not None else None

        if debit is None and credit is None:
            return None

        # Validate: not both non-zero
        if debit and credit and debit > 0 and credit > 0:
            logger.warning("LLM returned both debit and credit for row %d; skipping", row)
            return None

        return CanonicalTransaction(
            row=row,
            date=date_parsed,
            description_raw=raw.get("description_raw", ""),
            debit=debit if debit and debit > 0 else None,
            credit=credit if credit and credit > 0 else None,
            balance=balance,
            confidence=0.80,
            source=TransactionSource.llm,
        )
    except Exception as exc:
        logger.warning("Failed to parse LLM transaction: %s — %s", raw, exc)
        return None


class LLMFallbackParser:
    """
    PARSE-10: Sends statement text to Claude and parses structured JSON output.
    Only invoked when deterministic adapter fails or confidence is below threshold.
    """

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def parse(self, pdf_path: str, bank_code: str = "UNKNOWN") -> CanonicalStatement:
        t0 = time.time()
        raw_text = _extract_text_from_pdf(pdf_path)

        # Redact PII before sending externally
        text_to_send = _redact_pii(raw_text)

        try:
            result_json = self._call_claude(text_to_send)
        except Exception as exc:
            logger.error("LLM fallback Claude call failed: %s", exc)
            raise

        elapsed_ms = int((time.time() - t0) * 1000)

        transactions: list[CanonicalTransaction] = []
        for i, txn_raw in enumerate(result_json.get("transactions", [])):
            txn = _parse_llm_transaction(txn_raw, row_offset=i)
            if txn:
                transactions.append(txn)

        def _to_decimal(val) -> Optional[Decimal]:
            return Decimal(str(val)) if val is not None else None

        def _to_date(val: str | None) -> Optional[date]:
            if not val:
                return None
            from datetime import datetime
            try:
                return datetime.strptime(val, "%Y-%m-%d").date()
            except ValueError:
                return None

        return CanonicalStatement(
            bank_code=result_json.get("bank_code", bank_code),
            bank_name=result_json.get("bank_name"),
            account_no_masked=result_json.get("account_no_masked"),
            account_holder=result_json.get("account_holder"),
            period_start=_to_date(result_json.get("period_start")),
            period_end=_to_date(result_json.get("period_end")),
            currency=result_json.get("currency", "IDR"),
            opening_balance=_to_decimal(result_json.get("opening_balance")),
            closing_balance=_to_decimal(result_json.get("closing_balance")),
            transactions=transactions,
            parse_meta=ParseMeta(
                method=TransactionSource.llm,
                llm_used=True,
                processing_time_ms=elapsed_ms,
            ),
        )

    def _call_claude(self, text: str) -> dict:
        message = self._client.messages.create(
            model=settings.llm_model,
            max_tokens=settings.llm_max_tokens,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Berikut adalah teks rekening koran. Ekstrak semua transaksi:\n\n{text[:30000]}",
                }
            ],
        )
        raw_content = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw_content.startswith("```"):
            raw_content = re.sub(r"^```(?:json)?\n?", "", raw_content)
            raw_content = re.sub(r"\n?```$", "", raw_content)

        return json.loads(raw_content)
