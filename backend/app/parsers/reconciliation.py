"""
PARSE-03 — Reconciliation Engine
The universal QA gate: saldo_sebelum + kredit - debit = saldo_sesudah.
This rule holds for every Indonesian bank regardless of parser method.
"""
from __future__ import annotations
import logging
from decimal import Decimal, ROUND_HALF_UP

from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, ReconciliationResult

logger = logging.getLogger(__name__)

TOLERANCE = Decimal("1.00")  # Rp1 rounding tolerance


class ReconciliationEngine:
    """
    PARSE-03: Validate saldo balance row-by-row and statement-level.
    Returns ReconciliationResult with detailed diagnostics.
    """

    def reconcile(self, statement: CanonicalStatement) -> ReconciliationResult:
        txns = statement.transactions
        opening = statement.opening_balance
        closing = statement.closing_balance

        if not txns:
            return ReconciliationResult(
                balanced=False,
                notes="No transactions to reconcile",
            )

        unbalanced_rows: list[int] = []
        running_balance = opening

        # Row-by-row check
        for txn in txns:
            if txn.balance is None or running_balance is None:
                # Skip rows without balance field
                running_balance = txn.balance
                continue

            expected = running_balance + (txn.credit or Decimal(0)) - (txn.debit or Decimal(0))
            delta = abs(expected - txn.balance)
            if delta > TOLERANCE:
                unbalanced_rows.append(txn.row)
                logger.debug(
                    "Row %d imbalance: expected %s got %s (delta %s)",
                    txn.row, expected, txn.balance, delta
                )
            running_balance = txn.balance

        # Statement-level check: opening + Σcredit - Σdebit = closing
        total_credit = sum(t.credit or Decimal(0) for t in txns)
        total_debit = sum(t.debit or Decimal(0) for t in txns)
        computed_closing: Decimal | None = None
        statement_delta = Decimal(0)

        if opening is not None:
            computed_closing = (opening + total_credit - total_debit).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if closing is not None:
                statement_delta = abs(computed_closing - closing)

        balanced = (
            len(unbalanced_rows) == 0
            and statement_delta <= TOLERANCE
        )

        return ReconciliationResult(
            balanced=balanced,
            delta=statement_delta,
            computed_closing=computed_closing,
            stated_closing=closing,
            unbalanced_rows=unbalanced_rows,
            notes=self._build_notes(balanced, unbalanced_rows, statement_delta),
        )

    def _build_notes(
        self,
        balanced: bool,
        unbalanced_rows: list[int],
        delta: Decimal,
    ) -> str:
        if balanced:
            return "Rekonsiliasi saldo: OK"
        parts: list[str] = []
        if unbalanced_rows:
            parts.append(f"Baris tidak balance: {unbalanced_rows}")
        if delta > TOLERANCE:
            parts.append(f"Selisih saldo akhir: Rp{delta:,.2f}")
        return "; ".join(parts)
