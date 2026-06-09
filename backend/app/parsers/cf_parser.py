"""
Cash Flow parser for ACCURATE-style direct cash flow reports.

Expected format:
  PT Example
  Cash Flow (Direct)
  From Period January 2026 until May 2026
  Branch : [All Branch]
  Description Amount
  Operational Activity
  Cash from Sales 0
  ...
  Net cash provided by/(used in) in this period -772.637.695
  Cash & Cash equivalent on Opening period 3.811.798.850
  Cash & Cash equivalent on End period 3.039.161.155

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
    "january": 1,
    "januari": 1,
    "february": 2,
    "februari": 2,
    "march": 3,
    "maret": 3,
    "april": 4,
    "may": 5,
    "mei": 5,
    "june": 6,
    "juni": 6,
    "july": 7,
    "juli": 7,
    "august": 8,
    "agustus": 8,
    "september": 9,
    "october": 10,
    "oktober": 10,
    "november": 11,
    "december": 12,
    "desember": 12,
}

_AMOUNT_RE = re.compile(r"-?\(?\d[\d.,]*\)?")
_FOOTER_MARKERS = (
    "accurate accounting system report",
    "printed on",
    "page break",
)


@dataclass
class CashFlowLineItem:
    description: str
    section: str = ""
    subsection: str = ""
    amount: float = 0.0
    is_total: bool = False


@dataclass
class CashFlowCheck:
    opening_cash: Optional[float] = None
    net_cash_change: Optional[float] = None
    ending_cash: Optional[float] = None
    delta: Optional[float] = None
    balanced: bool = False


@dataclass
class CashFlowReport:
    company_name: str = ""
    report_title: str = ""
    period_start: str = ""
    period_end: str = ""
    branch: str = ""
    line_items: list[CashFlowLineItem] = field(default_factory=list)
    summaries: dict[str, float] = field(default_factory=dict)
    cash_check: CashFlowCheck = field(default_factory=CashFlowCheck)
    raw_pages: int = 0


def parse_cash_flow_pdf(file_path: str | Path) -> CashFlowReport:
    """Parse an ACCURATE direct cash flow PDF into structured line items."""
    path = Path(file_path)
    report = CashFlowReport()
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
    _build_cash_check(report)

    return report


def _parse_header(lines: list[str], report: CashFlowReport) -> None:
    if lines:
        report.company_name = lines[0]

    for line in lines[:30]:
        low = line.lower()
        if "cash flow" in low or "arus kas" in low:
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

        branch_match = re.search(r"branch\s*:\s*(.+)$", line, re.IGNORECASE)
        if branch_match:
            report.branch = _clean(branch_match.group(1))


def _parse_line_items(lines: list[str], report: CashFlowReport) -> None:
    header_idx = _find_table_header(lines)
    if header_idx is None:
        return

    current_section = ""
    current_subsection = ""

    for line in lines[header_idx + 1 :]:
        low = line.lower()
        if any(marker in low for marker in _FOOTER_MARKERS):
            continue
        if _is_report_chrome(line):
            continue
        if _looks_like_repeated_header(line):
            continue

        parsed = _parse_item_line(line)
        if parsed is None:
            section = _normalize_section(line)
            if section:
                current_section = section
                current_subsection = ""
            elif current_section:
                current_subsection = line
            continue

        description, amount = parsed
        section, subsection = _line_section(description, current_section, current_subsection)
        report.line_items.append(
            CashFlowLineItem(
                description=description,
                section=section,
                subsection=subsection,
                amount=amount,
                is_total=_is_total_line(description),
            )
        )


def _find_table_header(lines: list[str]) -> Optional[int]:
    for idx, line in enumerate(lines):
        low = line.lower()
        if low in {"description amount", "deskripsi amount", "deskripsi jumlah"}:
            return idx
    return None


def _parse_item_line(line: str) -> Optional[tuple[str, float]]:
    matches = list(_AMOUNT_RE.finditer(line))
    if not matches:
        return None

    amount_match = matches[-1]
    description = _clean(line[: amount_match.start()])
    if not description:
        return None

    return description, _parse_amount(amount_match.group(0))


def _build_summaries(report: CashFlowReport) -> None:
    summary_patterns = {
        "operating_profit_before_working_capital": (
            r"^operating\s+profit\(loss\)\s+before\s+changes\s+in\s+operating\s+assets\s+and\s+liabilities$"
        ),
        "total_operating_assets_change": r"^total\s+decrease\(increase\)\s+in\s+operating\s+assets$",
        "total_operating_liabilities_change": r"^total\s+increase\(decrease\)\s+in\s+operating\s+liabilities$",
        "net_cash_from_operating": r"^total\s+net\s+cash\s+\(used\s+in\)/provided\s+by\s+operating\s+activities$",
        "net_cash_from_investing": r"^total\s+net\s+cash\s+provided\s+by/\(used\s+in\)\s+investing\s+activities$",
        "net_cash_from_financing": r"^total\s+net\s+cash\s+provided\s+by/\(used\s+in\)\s+financing\s+activities$",
        "net_cash_change": r"^net\s+cash\s+provided\s+by/\(used\s+in\)\s+in\s+this\s+period$",
        "opening_cash": r"^cash\s+&\s+cash\s+equivalent\s+on\s+opening\s+period$",
        "ending_cash": r"^cash\s+&\s+cash\s+equivalent\s+on\s+end\s+period$",
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
            report.summaries[key] = item.amount


def _build_cash_check(report: CashFlowReport) -> None:
    opening_cash = report.summaries.get("opening_cash")
    net_cash_change = report.summaries.get("net_cash_change")
    ending_cash = report.summaries.get("ending_cash")

    delta = None
    balanced = False
    if opening_cash is not None and net_cash_change is not None and ending_cash is not None:
        delta = opening_cash + net_cash_change - ending_cash
        balanced = abs(delta) < 0.01

    report.cash_check = CashFlowCheck(
        opening_cash=opening_cash,
        net_cash_change=net_cash_change,
        ending_cash=ending_cash,
        delta=delta,
        balanced=balanced,
    )


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


def _looks_like_repeated_header(line: str) -> bool:
    low = line.lower()
    return low in {"description amount", "deskripsi amount", "deskripsi jumlah"}


def _is_report_chrome(line: str) -> bool:
    low = line.lower()
    return (
        low.startswith("cash flow (")
        or "arus kas" in low
        or low.startswith("from period ")
        or low.startswith("branch :")
        or re.match(r"^pt\s+", low) is not None
    )


def _normalize_section(line: str) -> str:
    low = line.lower()
    if low == "operational activity":
        return "OPERATING"
    if low == "cash flows from investing activities":
        return "INVESTING"
    if low == "cash flows from financing activities":
        return "FINANCING"
    return ""


def _line_section(description: str, current_section: str, current_subsection: str) -> tuple[str, str]:
    low = description.lower()
    if "operating activities" in low:
        return "OPERATING", ""
    if "investing activities" in low:
        return "INVESTING", ""
    if "financing activities" in low:
        return "FINANCING", ""
    if low.startswith("net cash ") or low.startswith("cash & cash equivalent"):
        return "CASH SUMMARY", ""
    return current_section, current_subsection


def _is_total_line(description: str) -> bool:
    low = description.lower()
    return (
        low.startswith("total ")
        or low.startswith("net cash ")
        or low.startswith("cash & cash equivalent")
    )


def _main() -> None:
    parser = argparse.ArgumentParser(description="Parse ACCURATE direct Cash Flow PDF.")
    parser.add_argument("pdf", help="Path to Cash Flow PDF")
    args = parser.parse_args()
    report = parse_cash_flow_pdf(args.pdf)
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
