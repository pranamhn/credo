"""
Main parsing pipeline — orchestrates all 4 layers:
  Lapis 1: Bank Detector
  Lapis 2: Adapter (deterministik per bank)
  Lapis 3: LLM fallback (jika adapter gagal / confidence rendah)
  Lapis 4: Reconciliation (QA gate universal)
"""
from __future__ import annotations
import logging
from pathlib import Path

from app.config import settings
from app.parsers.detector import BankDetector
from app.parsers.adapters import get_adapter
from app.parsers.categorizer import TransactionCategorizer
from app.parsers.reconciliation import ReconciliationEngine
from app.schemas.canonical import CanonicalStatement, TransactionSource

logger = logging.getLogger(__name__)


class ParsingPipeline:

    def __init__(self):
        self._detector = BankDetector()
        self._categorizer = TransactionCategorizer()
        self._recon = ReconciliationEngine()

    def run(self, pdf_path: str) -> CanonicalStatement:
        # Lapis 1: Detect
        detection = self._detector.detect(pdf_path)
        logger.info("Detected: %s (confidence=%.2f, scanned=%s)",
                    detection.bank_code, detection.confidence, detection.is_scanned)

        statement: CanonicalStatement | None = None
        used_llm = False

        # Lapis 2: Try deterministic adapter
        if detection.confidence >= settings.confidence_threshold:
            adapter = get_adapter(detection.bank_code)
            if adapter:
                try:
                    statement = adapter.parse(pdf_path)
                    # Apply detection metadata not available to adapter
                    if not statement.account_no_masked and detection.account_no_masked:
                        statement.account_no_masked = detection.account_no_masked
                    statement.detection_confidence = detection.confidence
                    logger.info("Adapter parse OK: %d transactions", len(statement.transactions))
                except Exception as exc:
                    logger.warning("Adapter failed (%s), falling back to LLM: %s",
                                   detection.bank_code, exc)

        # General deterministic fallback for untrained banks/formats.
        if statement is None:
            adapter = get_adapter("AUTO")
            if adapter:
                try:
                    statement = adapter.parse(pdf_path)
                    if detection.bank_code != "UNKNOWN":
                        statement.bank_code = detection.bank_code
                        statement.bank_name = detection.bank_name or statement.bank_name
                    if not statement.account_no_masked and detection.account_no_masked:
                        statement.account_no_masked = detection.account_no_masked
                    statement.detection_confidence = detection.confidence
                    logger.info("Auto-format parse OK: %d transactions", len(statement.transactions))
                except Exception as exc:
                    logger.warning("Auto-format adapter failed, falling back to LLM: %s", exc)

        # Lapis 3: LLM fallback
        if statement is None or (
            len(statement.transactions) == 0
            or self._low_confidence(statement)
        ):
            if not settings.anthropic_api_key:
                logger.warning("LLM fallback needed but ANTHROPIC_API_KEY not set")
            else:
                logger.info("Using LLM fallback for %s", detection.bank_code)
                from app.parsers.llm_fallback import LLMFallbackParser
                statement = LLMFallbackParser().parse(pdf_path, detection.bank_code)
                statement.detection_confidence = detection.confidence
                used_llm = True

        if statement is None:
            raise ValueError(f"All parsing methods failed for {Path(pdf_path).name}")

        # Lapis 3.5: Normalize transaction categories from descriptions.
        self._categorizer.apply(statement)

        # Lapis 4: Reconciliation
        recon_result = self._recon.reconcile(statement)
        statement.reconciliation = recon_result
        self._boost_confidence(statement)
        if statement.parse_meta:
            statement.parse_meta.llm_used = used_llm

        logger.info(
            "Reconciliation: balanced=%s delta=%s",
            recon_result.balanced, recon_result.delta
        )

        return statement

    def _low_confidence(self, statement: CanonicalStatement) -> bool:
        if not statement.transactions:
            return True
        avg_conf = sum(t.confidence for t in statement.transactions) / len(statement.transactions)
        return avg_conf < settings.confidence_threshold

    def _boost_confidence(self, statement: CanonicalStatement) -> None:
        recon = statement.reconciliation
        if not recon or not statement.transactions:
            return

        unbalanced = set(recon.unbalanced_rows or [])
        for txn in statement.transactions:
            if txn.row in unbalanced:
                txn.confidence = min(txn.confidence, 0.70)
                txn.raw_meta = {
                    **(txn.raw_meta or {}),
                    "confidence_tier": "review",
                    "confidence_reason": "Row tidak lolos rekonsiliasi saldo.",
                }
                continue

            if recon.balanced:
                if txn.balance is not None and txn.source == TransactionSource.adapter:
                    txn.confidence = 1.0
                    tier = "verified"
                    reason = "Deterministic parser + row punya saldo + statement rekonsiliasi OK."
                else:
                    txn.confidence = max(txn.confidence, 0.96)
                    tier = "high"
                    reason = "Deterministic parser + statement rekonsiliasi OK; row tidak punya saldo eksplisit."
            elif txn.balance is not None:
                txn.confidence = max(txn.confidence, 0.90)
                tier = "medium"
                reason = "Row punya saldo, tapi statement belum rekonsiliasi penuh."
            else:
                tier = "review"
                reason = "Belum ada bukti saldo per-row dan statement belum rekonsiliasi penuh."

            txn.raw_meta = {
                **(txn.raw_meta or {}),
                "confidence_tier": tier,
                "confidence_reason": reason,
                "category_reason": f"Kategori dipilih dari rule deskripsi: {txn.category}",
            }
