"""
Balance Sheet parser for ACCURATE-style multi-period reports.

Expected format:
  PT Example
  Balance Sheet (Multi Period)
  From Period January 2026 until May 2026
  Currency : Indonesian Rupiah
  Description 31 Jan 2026 (IDR) 28 Feb 2026 (IDR) ... 31 May 2026 (IDR)
  ASSETS
  CURRENT ASSETS
  Cash and Bank 4.083.193 ...
  ...

The parser intentionally uses positioned text extraction rather than table
extraction because ACCURATE PDFs are often emitted as text blocks.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import pdfplumber


_MONTHS: dict[str, int] = {
    "jan": 1,
    "january": 1,
    "januari": 1,
    "feb": 2,
    "february": 2,
    "februari": 2,
    "mar": 3,
    "march": 3,
    "maret": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "mei": 5,
    "jun": 6,
    "june": 6,
    "juni": 6,
    "jul": 7,
    "july": 7,
    "juli": 7,
    "aug": 8,
    "august": 8,
    "agustus": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "oktober": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
    "desember": 12,
}

_AMOUNT_RE = re.compile(r"-?\(?\d[\d.,]*\)?")
_PERIOD_LABEL_RE = re.compile(
    r"(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*\(([A-Za-z]{3})\)",
    flags=re.IGNORECASE,
)
_FOOTER_MARKERS = (
    "accurate accounting system report",
    "printed on",
    "page break",
)
_TOP_SECTIONS = {
    "assets": "ASSETS",
    "liabilities": "LIABILITIES",
    "equities": "EQUITIES",
    "liabilities and equities": "LIABILITIES and EQUITIES",
}


@dataclass
class BalanceSheetLineItem:
    description: str
    section: str = ""
    subsection: str = ""
    account_group: str = ""
    values: dict[str, float] = field(default_factory=dict)
    is_total: bool = False


@dataclass
class BalanceCheck:
    period: str
    total_assets: Optional[float] = None
    total_liabilities_and_equities: Optional[float] = None
    delta: Optional[float] = None
    balanced: bool = False


@dataclass
class BalanceSheetReport:
    company_name: str = ""
    report_title: str = ""
    period_start: str = ""
    period_end: str = ""
    currency: str = ""
    periods: list[str] = field(default_factory=list)
    period_labels: list[str] = field(default_factory=list)
    line_items: list[BalanceSheetLineItem] = field(default_factory=list)
    summaries: dict[str, dict[str, float]] = field(default_factory=dict)
    balance_checks: list[BalanceCheck] = field(default_factory=list)
    raw_pages: int = 0


def parse_balance_sheet_pdf(file_path: str | Path) -> BalanceSheetReport:
    """Parse a multi-period Balance Sheet PDF into structured line items."""
    path = Path(file_path)
    report = BalanceSheetReport()
    page_texts: list[str] = []

    with pdfplumber.open(path) as pdf:
        report.raw_pages = len(pdf.pages)
        for page in pdf.pages:
            page_texts.append(page.extract_text(x_tolerance=3, y_tolerance=3) or "")

    lines = [_clean(line) for text in page_texts for line in text.splitlines()]
    lines = [line for line in lines if line]

    _parse_header(lines, report)
    _parse_line_items(lines, report)
    _build_summaries(report)
    _build_balance_checks(report)

    return report


def _parse_header(lines: list[str], report: BalanceSheetReport) -> None:
    if lines:
        report.company_name = lines[0]

    for line in lines[:30]:
        low = line.lower()
        if "balance sheet" in low or "neraca" in low:
            report.report_title = line

        period_match = re.search(
            r"from\s+period\s+([A-Za-z]+)\s+(\d{4})\s+until\s+([A-Za-z]+)\s+(\d{4})",
            line,
            re.IGNORECASE,
        )
        if period_match:
            start_month, start_year, end_month, end_year = period_match.groups()
            report.period_start = _month_to_period(start_month, int(start_year))
            report.period_end = _month_to_period(end_month, int(end_year))

        currency_match = re.search(r"currency\s*:\s*(.+)$", line, re.IGNORECASE)
        if currency_match:
            report.currency = _clean(currency_match.group(1))


def _parse_line_items(lines: list[str], report: BalanceSheetReport) -> None:
    header_idx = _find_table_header(lines)
    if header_idx is None:
        return

    period_labels = _extract_period_labels(lines[header_idx])
    if not period_labels:
        return

    report.period_labels = period_labels
    report.periods = [_period_label_to_key(label) for label in period_labels]
    expected_amounts = len(report.periods)
    current_section = ""
    current_subsection = ""
    current_account_group = ""

    for line in lines[header_idx + 1 :]:
        low = line.lower()
        if any(marker in low for marker in _FOOTER_MARKERS):
            continue
        if _is_report_chrome(line):
            continue
        if _looks_like_repeated_header(line):
            continue

        parsed = _parse_item_line(line, expected_amounts)
        if parsed is None:
            if _contains_amount(line):
                continue
            section = _normalize_top_section(line)
            if section and section != "LIABILITIES and EQUITIES":
                current_section = section
                current_subsection = ""
                current_account_group = ""
            elif current_section and line.isupper():
                current_subsection = line
                current_account_group = ""
            elif current_section:
                current_account_group = line
            continue

        description, amounts = parsed
        section, subsection = _line_section(description, current_section, current_subsection)
        report.line_items.append(
            BalanceSheetLineItem(
                description=description,
                section=section,
                subsection=subsection,
                account_group=current_account_group,
                values={
                    period: amount
                    for period, amount in zip(report.periods, amounts)
                },
                is_total=_is_total_line(description),
            )
        )


def _find_table_header(lines: list[str]) -> Optional[int]:
    for idx, line in enumerate(lines):
        low = line.lower()
        if low.startswith("description ") and "(idr)" in low:
            return idx
        if low.startswith("deskripsi ") and "(idr)" in low:
            return idx
    return None


def _extract_period_labels(header_line: str) -> list[str]:
    return [match.group(1) for match in _PERIOD_LABEL_RE.finditer(header_line)]


def _parse_item_line(line: str, expected_amounts: int) -> Optional[tuple[str, list[float]]]:
    matches = list(_AMOUNT_RE.finditer(line))
    if len(matches) < expected_amounts:
        return None

    amount_matches = matches[-expected_amounts:]
    description = _clean(line[: amount_matches[0].start()])
    if not description:
        return None

    amounts = [_parse_amount(match.group(0)) for match in amount_matches]
    return description, amounts


def _build_summaries(report: BalanceSheetReport) -> None:
    summary_patterns = {
        "current_assets": r"^total\s+current\s+assets$",
        "fixed_assets": r"^total\s+fixed\s+assets$",
        "other_assets": r"^total\s+other\s+assets$",
        "total_assets": r"^total\s+assets$",
        "current_liabilities": r"^total\s+current\s+liabilities$",
        "long_term_liabilities": r"^total\s+long\s+term\s+liabilities$",
        "total_liabilities": r"^total\s+liabilities$",
        "total_equities": r"^total\s+equities$",
        "total_liabilities_and_equities": r"^total\s+liabilities\s+and\s+equities$",
    }

    for key, pattern in summary_patterns.items():
        item = next(
            (
                line
                for line in report.line_items
                if re.search(pattern, line.description, re.IGNORECASE)
            ),
            None,
        )
        if item is not None:
            report.summaries[key] = dict(item.values)


def _build_balance_checks(report: BalanceSheetReport) -> None:
    assets = report.summaries.get("total_assets", {})
    liabilities_equities = report.summaries.get("total_liabilities_and_equities", {})

    for period in report.periods:
        total_assets = assets.get(period)
        total_liabilities_and_equities = liabilities_equities.get(period)
        delta = None
        balanced = False
        if total_assets is not None and total_liabilities_and_equities is not None:
            delta = total_assets - total_liabilities_and_equities
            balanced = abs(delta) < 0.01

        report.balance_checks.append(
            BalanceCheck(
                period=period,
                total_assets=total_assets,
                total_liabilities_and_equities=total_liabilities_and_equities,
                delta=delta,
                balanced=balanced,
            )
        )


def _period_label_to_key(label: str) -> str:
    match = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", label.strip())
    if not match:
        return label

    day, month_name, year = match.groups()
    month = _MONTHS.get(month_name.lower())
    if month is None:
        return label

    return f"{int(year):04d}-{month:02d}-{int(day):02d}"


def _month_to_period(month_name: str, year: int) -> str:
    month = _MONTHS.get(month_name.lower())
    return f"{year:04d}-{month:02d}" if month else f"{year:04d}-{month_name}"


def _parse_amount(value: str) -> float:
    text = value.strip()
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    text = text.strip("-()").replace(" ", "")

    if "." in text and "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif "." in text:
        text = text.replace(".", "")
    elif "," in text:
        text = text.replace(",", ".")

    amount = float(text or "0")
    return -amount if negative else amount


def _clean(value: str) -> str:
    return " ".join(value.split()).strip()


def _contains_amount(line: str) -> bool:
    return bool(_AMOUNT_RE.search(line))


def _looks_like_repeated_header(line: str) -> bool:
    low = line.lower()
    return (
        (low.startswith("description ") or low.startswith("deskripsi "))
        and "(idr)" in low
    )


def _is_report_chrome(line: str) -> bool:
    low = line.lower()
    return (
        "balance sheet" in low
        or "neraca" in low
        or low.startswith("from period ")
        or low.startswith("currency :")
        or re.match(r"^pt\s+", low) is not None
    )


def _normalize_top_section(line: str) -> str:
    low = line.lower()
    if low in _TOP_SECTIONS:
        return _TOP_SECTIONS[low]
    return ""


def _line_section(description: str, current_section: str, current_subsection: str) -> tuple[str, str]:
    low = description.lower()
    if low == "total assets":
        return "ASSETS", ""
    if low == "total liabilities":
        return "LIABILITIES", ""
    if low == "total equities":
        return "EQUITIES", ""
    if low == "total liabilities and equities":
        return "LIABILITIES and EQUITIES", ""
    return current_section, current_subsection


def _is_total_line(description: str) -> bool:
    desc = description.strip()
    return desc.lower().startswith("total ") or desc.isupper()


def _main() -> None:
    parser = argparse.ArgumentParser(description="Parse ACCURATE multi-period Balance Sheet PDF.")
    parser.add_argument("pdf", help="Path to Balance Sheet PDF")
    args = parser.parse_args()
    report = parse_balance_sheet_pdf(args.pdf)
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
