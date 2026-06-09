"""
RISK-01, RISK-02 — Cash Flow Metrics & DSR Estimation
Compute all financial summary metrics from a canonical statement.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionCategory

# Income categories for DSR numerator
_INCOME_CATEGORIES = {
    TransactionCategory.income_salary,
    TransactionCategory.income_transfer,
    TransactionCategory.income_other,
}

# Obligation categories for DSR denominator
_OBLIGATION_CATEGORIES = {
    TransactionCategory.loan_repayment,
}

# Low balance threshold (configurable per use-case)
LOW_BALANCE_THRESHOLD = Decimal("1_000_000")  # Rp 1 juta


@dataclass
class DailyBalance:
    date: date
    balance: Decimal


@dataclass
class CashFlowMetrics:
    # Inflow / Outflow
    total_credit: Decimal = Decimal(0)
    total_debit: Decimal = Decimal(0)
    net_flow: Decimal = Decimal(0)

    # Balance statistics
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None
    avg_daily_balance: Optional[Decimal] = None
    min_balance: Optional[Decimal] = None
    max_balance: Optional[Decimal] = None
    min_balance_date: Optional[date] = None
    max_balance_date: Optional[date] = None

    # Threshold days
    days_below_threshold: int = 0
    negative_balance_days: int = 0

    # Counts
    transaction_count: int = 0
    credit_count: int = 0
    debit_count: int = 0

    # Category totals
    category_summary: dict[str, Decimal] = field(default_factory=dict)

    # DSR
    estimated_monthly_income: Optional[Decimal] = None
    estimated_monthly_obligations: Optional[Decimal] = None
    dsr: Optional[float] = None

    # Period
    period_months: float = 1.0


def compute_metrics(statement: CanonicalStatement) -> CashFlowMetrics:
    txns = statement.transactions
    m = CashFlowMetrics()
    m.transaction_count = len(txns)
    m.opening_balance = statement.opening_balance
    m.closing_balance = statement.closing_balance

    if not txns:
        return m

    # Compute period in months for monthly normalization
    if statement.period_start and statement.period_end:
        days = (statement.period_end - statement.period_start).days + 1
        m.period_months = max(1.0, days / 30.44)

    # Aggregate totals
    category_totals: dict[str, Decimal] = {}
    for txn in txns:
        credit = txn.credit or Decimal(0)
        debit = txn.debit or Decimal(0)

        m.total_credit += credit
        m.total_debit += debit

        if credit > 0:
            m.credit_count += 1
        if debit > 0:
            m.debit_count += 1

        cat = txn.category or TransactionCategory.unknown
        category_totals[cat] = category_totals.get(cat, Decimal(0)) + credit - debit

    m.net_flow = m.total_credit - m.total_debit
    m.category_summary = {k: v for k, v in category_totals.items()}

    # Balance statistics (from rows that carry balance column)
    balances: list[tuple[date, Decimal]] = [
        (txn.date, txn.balance)
        for txn in txns
        if txn.balance is not None
    ]

    if balances:
        balance_values = [b for _, b in balances]
        m.min_balance = min(balance_values)
        m.max_balance = max(balance_values)

        min_idx = balance_values.index(m.min_balance)
        max_idx = balance_values.index(m.max_balance)
        m.min_balance_date = balances[min_idx][0]
        m.max_balance_date = balances[max_idx][0]

        m.avg_daily_balance = sum(balance_values) / len(balance_values)
        m.days_below_threshold = sum(1 for b in balance_values if 0 <= b < LOW_BALANCE_THRESHOLD)
        m.negative_balance_days = sum(1 for b in balance_values if b < 0)

    # DSR estimation
    income_cats = {c.value for c in _INCOME_CATEGORIES}
    obligation_cats = {c.value for c in _OBLIGATION_CATEGORIES}

    monthly_income = sum(
        v for k, v in category_totals.items() if k in income_cats and v > 0
    ) / Decimal(str(m.period_months))

    monthly_obligations = sum(
        abs(category_totals.get(k, Decimal(0)))
        for k in obligation_cats
    ) / Decimal(str(m.period_months))

    m.estimated_monthly_income = monthly_income if monthly_income > 0 else None
    m.estimated_monthly_obligations = monthly_obligations if monthly_obligations > 0 else None

    if m.estimated_monthly_income and m.estimated_monthly_income > 0:
        obligations_for_dsr = monthly_obligations if monthly_obligations > 0 else Decimal(0)
        m.dsr = float(
            (obligations_for_dsr / m.estimated_monthly_income).quantize(Decimal("0.0001"))
        )

    return m
