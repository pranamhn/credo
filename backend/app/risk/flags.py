"""
RISK-04 to RISK-07 — Red Flag Detection Engine
Detects: judol, pinjol stacking, passthrough/kiting, rejected txns,
         negative balance, large inflow spikes, income inconsistency.
All detection is rule-based keyword + pattern matching (Fase 1).
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionFlag

# ─── Keyword lists ────────────────────────────────────────────────────────────

# Gambling / judol indicators
_JUDOL_KEYWORDS = re.compile(
    r"\b(slot|togel|judi|bet|casino|poker|jackpot|pragmatic|pgsoft|habanero"
    r"|sbobet|maxbet|ibcbet|338a|sportbook|sabung|ayam|dingdong"
    r"|top\s*up.*game|withdraw.*game|77superslot|olympus|mahjong)\b",
    re.I,
)
_JUDOL_MERCHANTS = re.compile(
    r"(DANA\s+KEMENANGAN|WITHDRAW\s+KEMENANGAN|TOPUP\s+SALDO\s+GAME|SLOT\s+WIN)",
    re.I,
)

# Pinjol disbursement / repayment indicators
_PINJOL_DISBURSE = re.compile(
    r"\b(kredivo|akulaku|julo|easycash|kredit\s*pintar|finmas|maucash|danacita"
    r"|cashcepat|pinjaman\s*online|p2p|lending|pinjol|dana\s*cair|cair\s*pinjaman"
    r"|cicilan\s*pinjaman)\b",
    re.I,
)
_PINJOL_REPAY = re.compile(
    r"\b(cicilan|angsuran\s+pinjaman|bayar\s+pinjaman|pelunasan\s+pinjaman"
    r"|repayment|auto\s+debit\s+kredit)\b",
    re.I,
)

# Rejected transaction
_REJECTED_KEYWORDS = re.compile(
    r"\b(tolak|ditolak|gagal|reject|rejected|insufficient\s+fund"
    r"|dana\s+tidak\s+cukup|kekurangan\s+dana|return\s+debit)\b",
    re.I,
)

# Salary / income keywords
_SALARY_KEYWORDS = re.compile(
    r"\b(gaji|salary|payroll|thr|bonus|insentif|komisi"
    r"|transfer\s+gaji|upah)\b",
    re.I,
)

# Large inflow spike threshold (relative to avg monthly income)
_SPIKE_MULTIPLIER = 3.0

# Passthrough detection: outflow/inflow ratio
_PASSTHROUGH_OUTFLOW_RATIO = 0.85  # 85% of credit goes out quickly
_PASSTHROUGH_WINDOW_DAYS = 3


@dataclass
class FlagDetail:
    flag_type: str
    severity: str  # high | medium | low
    count: int
    total_amount: Optional[Decimal]
    supporting_rows: list[int]
    description: str
    confidence: float = 1.0


@dataclass
class FlagReport:
    flags: dict[str, FlagDetail] = field(default_factory=dict)
    has_judol: bool = False
    has_pinjol: bool = False
    has_passthrough: bool = False
    flag_count: int = 0

    def add(self, detail: FlagDetail) -> None:
        self.flags[detail.flag_type] = detail
        self.flag_count += 1
        if detail.flag_type == TransactionFlag.judol:
            self.has_judol = True
        elif detail.flag_type == TransactionFlag.pinjol:
            self.has_pinjol = True
        elif detail.flag_type == TransactionFlag.passthrough:
            self.has_passthrough = True


class RedFlagEngine:
    """RISK-04–07: Detect all red flags from canonical transactions."""

    def analyze(self, statement: CanonicalStatement, avg_monthly_income: Optional[Decimal] = None) -> FlagReport:
        report = FlagReport()
        txns = statement.transactions

        self._detect_judol(txns, report)
        self._detect_pinjol(txns, report)
        self._detect_passthrough(txns, report)
        self._detect_rejected(txns, report)
        self._detect_negative_balance(txns, report)
        self._detect_large_inflow_spike(txns, report, avg_monthly_income)
        self._detect_income_inconsistency(txns, report)

        return report

    # ── RISK-04: Judol ────────────────────────────────────────────────────────
    def _detect_judol(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        hits: list[CanonicalTransaction] = []
        for txn in txns:
            desc = txn.description_raw
            if _JUDOL_KEYWORDS.search(desc) or _JUDOL_MERCHANTS.search(desc):
                hits.append(txn)

        if not hits:
            return

        total = sum((t.debit or Decimal(0)) + (t.credit or Decimal(0)) for t in hits)
        report.add(FlagDetail(
            flag_type=TransactionFlag.judol,
            severity="high",
            count=len(hits),
            total_amount=total,
            supporting_rows=[t.row for t in hits],
            description=f"Terdeteksi {len(hits)} transaksi indikasi judi online (judol). Total: Rp{total:,.0f}",
            confidence=0.90,
        ))

    # ── RISK-05: Pinjol stacking ──────────────────────────────────────────────
    def _detect_pinjol(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        disburse_hits = [t for t in txns if _PINJOL_DISBURSE.search(t.description_raw)]
        repay_hits = [t for t in txns if _PINJOL_REPAY.search(t.description_raw)]

        # Stacking = multiple disbursements from different pinjol in short window
        if len(disburse_hits) < 2 and len(repay_hits) < 2:
            return

        all_hits = list({t.row: t for t in disburse_hits + repay_hits}.values())
        total = sum((t.credit or Decimal(0)) for t in disburse_hits)

        report.add(FlagDetail(
            flag_type=TransactionFlag.pinjol,
            severity="high" if len(disburse_hits) >= 3 else "medium",
            count=len(all_hits),
            total_amount=total,
            supporting_rows=[t.row for t in all_hits],
            description=(
                f"Terdeteksi {len(disburse_hits)} pencairan pinjol & "
                f"{len(repay_hits)} cicilan. Indikasi over-indebtedness."
            ),
            confidence=0.85,
        ))

    # ── RISK-06: Passthrough / Kiting ─────────────────────────────────────────
    def _detect_passthrough(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        if not txns:
            return

        # Sort by date
        sorted_txns = sorted(txns, key=lambda t: t.date)
        passthrough_windows: list[list[CanonicalTransaction]] = []

        i = 0
        while i < len(sorted_txns):
            txn = sorted_txns[i]
            if not txn.credit or txn.credit == 0:
                i += 1
                continue

            credit_amt = txn.credit
            window_end = txn.date + timedelta(days=_PASSTHROUGH_WINDOW_DAYS)

            # Capture the exact debit rows in the window, not only the credit row.
            outflow_txns = [
                t for t in sorted_txns[i + 1:]
                if t.date <= window_end and t.debit
            ]
            outflows = sum(t.debit or Decimal(0) for t in outflow_txns)

            if credit_amt > 0 and (outflows / credit_amt) >= Decimal(str(_PASSTHROUGH_OUTFLOW_RATIO)):
                passthrough_windows.append([txn, *outflow_txns])

            i += 1

        if len(passthrough_windows) < 2:
            return

        all_rows = sorted({t.row for window in passthrough_windows for t in window})
        report.add(FlagDetail(
            flag_type=TransactionFlag.passthrough,
            severity="high",
            count=len(passthrough_windows),
            total_amount=None,
            supporting_rows=all_rows,
            description=(
                f"Terdeteksi {len(passthrough_windows)} pola passthrough: "
                f"dana masuk lalu keluar ≥{int(_PASSTHROUGH_OUTFLOW_RATIO*100)}% dalam {_PASSTHROUGH_WINDOW_DAYS} hari."
            ),
            confidence=0.75,
        ))

    # ── RISK-07a: Rejected transactions ──────────────────────────────────────
    def _detect_rejected(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        hits = [t for t in txns if _REJECTED_KEYWORDS.search(t.description_raw)]
        if not hits:
            return

        report.add(FlagDetail(
            flag_type=TransactionFlag.rejected,
            severity="medium",
            count=len(hits),
            total_amount=None,
            supporting_rows=[t.row for t in hits],
            description=f"Terdeteksi {len(hits)} transaksi ditolak/gagal.",
        ))

    # ── RISK-07b: Negative balance ────────────────────────────────────────────
    def _detect_negative_balance(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        hits = [t for t in txns if t.balance is not None and t.balance < 0]
        if not hits:
            return

        min_balance = min(t.balance for t in hits)
        report.add(FlagDetail(
            flag_type=TransactionFlag.negative_balance,
            severity="high",
            count=len(hits),
            total_amount=abs(min_balance),
            supporting_rows=[t.row for t in hits],
            description=f"Saldo negatif/cerukan terdeteksi {len(hits)} kali. Minimum: Rp{min_balance:,.0f}",
        ))

    # ── RISK-07c: Large inflow spike ──────────────────────────────────────────
    def _detect_large_inflow_spike(
        self,
        txns: list[CanonicalTransaction],
        report: FlagReport,
        avg_monthly_income: Optional[Decimal],
    ) -> None:
        if not avg_monthly_income or avg_monthly_income <= 0:
            return

        threshold = avg_monthly_income * Decimal(str(_SPIKE_MULTIPLIER))
        hits = [t for t in txns if t.credit and t.credit >= threshold]

        if not hits:
            return

        total = sum(t.credit for t in hits)
        report.add(FlagDetail(
            flag_type=TransactionFlag.large_inflow,
            severity="medium",
            count=len(hits),
            total_amount=total,
            supporting_rows=[t.row for t in hits],
            description=(
                f"{len(hits)} transaksi kredit > {_SPIKE_MULTIPLIER}x pendapatan rata-rata "
                f"(threshold: Rp{threshold:,.0f}). Potensi window dressing."
            ),
            confidence=0.70,
        ))

    # ── RISK-07d: Income inconsistency ───────────────────────────────────────
    def _detect_income_inconsistency(self, txns: list[CanonicalTransaction], report: FlagReport) -> None:
        salary_txns = [t for t in txns if _SALARY_KEYWORDS.search(t.description_raw) and t.credit]
        if len(salary_txns) < 2:
            return

        amounts = [t.credit for t in salary_txns]
        avg = sum(amounts) / len(amounts)
        deviations = [abs(a - avg) / avg for a in amounts if avg > 0]
        high_deviation = [d for d in deviations if d > Decimal("0.30")]

        if not high_deviation:
            return

        report.add(FlagDetail(
            flag_type=TransactionFlag.low_confidence,
            severity="low",
            count=len(high_deviation),
            total_amount=None,
            supporting_rows=[t.row for t in salary_txns],
            description=(
                f"Pendapatan tidak konsisten: {len(high_deviation)} dari {len(salary_txns)} "
                "transaksi gaji bervariasi >30% dari rata-rata."
            ),
            confidence=0.80,
        ))
