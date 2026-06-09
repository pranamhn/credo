"""
Rule-based transaction categorizer.

This runs after extraction so every adapter benefits from the same category
labels. The rules intentionally favor explainable, conservative matches.
"""
from __future__ import annotations

import re

from app.schemas.canonical import CanonicalStatement, CanonicalTransaction, TransactionCategory


_CATEGORY_RULES: list[tuple[TransactionCategory, re.Pattern[str]]] = [
    (
        TransactionCategory.income_salary,
        re.compile(r"\b(gaji|salary|payroll|thr|bonus|insentif|komisi|upah)\b", re.I),
    ),
    (
        TransactionCategory.payroll,
        re.compile(r"\b(payroll|gaji\s+karyawan|upah|honor|lembur)\b", re.I),
    ),
    (
        TransactionCategory.loan_disbursement,
        re.compile(r"\b(pencairan|dana\s+cair|disbursement|loan\s+disbursement|pinjaman\s+cair)\b", re.I),
    ),
    (
        TransactionCategory.loan_repayment,
        re.compile(r"\b(angsuran|cicilan|pelunasan|pembayaran\s+pinj|pinjaman|kredit|auto\s*debit)\b", re.I),
    ),
    (
        TransactionCategory.tax,
        re.compile(r"\b(pajak|pph|ppn|spt|djp|bea\s+cukai|tax)\b", re.I),
    ),
    (
        TransactionCategory.insurance,
        re.compile(r"\b(bpjs|asuransi|insurance|premi|jamsostek|ketenagakerjaan|kesehatan)\b", re.I),
    ),
    (
        TransactionCategory.utility,
        re.compile(r"\b(pln|listrik|pdam|air\s+minum|telkom|indihome|internet|telepon|gas)\b", re.I),
    ),
    (
        TransactionCategory.admin_fee,
        re.compile(r"\b(biaya\s+adm|biaya\s+admin|administrasi|admin\s+bulanan)\b", re.I),
    ),
    (
        TransactionCategory.bank_fee,
        re.compile(r"\b(biaya|fee|charge|provisi|materai|bunga|pinalti|penalty)\b", re.I),
    ),
    (
        TransactionCategory.ewallet_topup,
        re.compile(r"\b(gopay|ovo|dana|linkaja|shopeepay|top\s*up|topup|e-?wallet)\b", re.I),
    ),
    (
        TransactionCategory.cash_withdrawal,
        re.compile(r"\b(atm|tarik\s+tunai|cash\s+withdrawal|penarikan)\b", re.I),
    ),
    (
        TransactionCategory.investment,
        re.compile(r"\b(saham|reksadana|obligasi|deposito|investasi|sekuritas|crypto)\b", re.I),
    ),
    (
        TransactionCategory.rent,
        re.compile(r"\b(sewa|rental|kontrak|lease|leasing)\b", re.I),
    ),
    (
        TransactionCategory.transport,
        re.compile(r"\b(transport|trasport|tol|bensin|bbm|solar|pertalite|pertamax|grab|gojek|parkir|travel)\b", re.I),
    ),
    (
        TransactionCategory.vendor_payment,
        re.compile(r"\b(invoice|inv\b|supplier|vendor|pembayaran|bayar|purchase|pembelian|charoen|pokphand)\b", re.I),
    ),
    (
        TransactionCategory.operational_expense,
        re.compile(r"\b(perbaikan|service|maintenance|operasional|atk|kantor|sparepart|logistik)\b", re.I),
    ),
    (
        TransactionCategory.retail_purchase,
        re.compile(r"\b(tokopedia|shopee|lazada|bukalapak|alfamart|indomaret|belanja|merchant|qris|debit\s+card)\b", re.I),
    ),
]

_TRANSFER_OUT_RE = re.compile(r"\b(trsf|transfer|pemindahbukuan|switching|llg|rtgs|skn|bi-fast|bifast)\b", re.I)
_TRANSFER_IN_RE = re.compile(r"\b(kr\s+otomatis|setoran|transfer\s+masuk|trsf.*\bcr\b|llg|rtgs|skn|bi-fast|bifast)\b", re.I)
_SALARY_RE = re.compile(r"\b(gaji|salary|payroll|thr|bonus|insentif|komisi|upah)\b", re.I)
_LOAN_DISBURSE_RE = re.compile(r"\b(pencairan|dana\s+cair|disbursement|loan\s+disbursement|pinjaman\s+cair)\b", re.I)


class TransactionCategorizer:
    def apply(self, statement: CanonicalStatement) -> CanonicalStatement:
        for txn in statement.transactions:
            txn.category = self.categorize(txn)
        return statement

    def categorize(self, txn: CanonicalTransaction) -> TransactionCategory:
        desc = txn.description_raw or ""
        if _SALARY_RE.search(desc):
            return TransactionCategory.income_salary if txn.credit else TransactionCategory.payroll

        if txn.credit and not txn.debit:
            if _LOAN_DISBURSE_RE.search(desc):
                return TransactionCategory.loan_disbursement
            if _TRANSFER_IN_RE.search(desc):
                return TransactionCategory.income_transfer
            return TransactionCategory.income_other

        for category, pattern in _CATEGORY_RULES:
            if pattern.search(desc):
                return category

        if txn.debit and _TRANSFER_OUT_RE.search(desc):
            return TransactionCategory.transfer_out
        if txn.debit and not txn.credit:
            return TransactionCategory.operational_expense
        return TransactionCategory.unknown
