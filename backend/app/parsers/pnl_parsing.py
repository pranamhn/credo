"""
Profit & Loss parser for ACCURATE-style multi-period reports.

Expected format:
  PT Example
  Laba/Rugi (Multi Periode)
  From Period January 2026 until May 2026
  Branch : [All Branch], Currency : Indonesian Rupiah
  Deskripsi January (IDR) February (IDR) ... Total (IDR)
  PENDAPATAN
  Operating Revenue 506.033.580 ... 3.346.750.700
  ...

The parser intentionally does not depend on table extraction because this PDF
format is usually emitted as positioned text rather than bordered tables.
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
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "januari": 1,
    "februari": 2,
    "maret": 3,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "agustus": 8,
    "oktober": 10,
    "desember": 12,
}

_AMOUNT_RE = re.compile(r"-?\(?\d[\d.,]*\)?")
_FOOTER_MARKERS = (
    "accurate accounting system report",
    "printed on",
    "page break",
)


@dataclass
class PnlLineItem:
    description: str
    section: str = ""
    values: dict[str, float] = field(default_factory=dict)
    total: Optional[float] = None
    is_total: bool = False


@dataclass
class PnlReport:
    company_name: str = ""
    report_title: str = ""
    period_start: str = ""
    period_end: str = ""
    branch: str = ""
    currency: str = ""
    periods: list[str] = field(default_factory=list)
    line_items: list[PnlLineItem] = field(default_factory=list)
    summaries: dict[str, dict[str, float]] = field(default_factory=dict)
    raw_pages: int = 0


def parse_pnl_pdf(file_path: str | Path) -> PnlReport:
    """Parse a multi-period P&L PDF into structured line items."""
    path = Path(file_path)
    report = PnlReport()
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

    return report


def _parse_header(lines: list[str], report: PnlReport) -> None:
    if lines:
        report.company_name = lines[0]

    for line in lines[:20]:
        low = line.lower()
        if "laba/rugi" in low or "profit" in low and "loss" in low:
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

        branch_match = re.search(r"branch\s*:\s*(.+?)(?:,\s*currency\s*:|$)", line, re.IGNORECASE)
        if branch_match:
            report.branch = _clean(branch_match.group(1))

        currency_match = re.search(r"currency\s*:\s*(.+)$", line, re.IGNORECASE)
        if currency_match:
            report.currency = _clean(currency_match.group(1))


def _parse_line_items(lines: list[str], report: PnlReport) -> None:
    header_idx = _find_table_header(lines)
    if header_idx is None:
        return

    period_labels = _extract_period_labels(lines[header_idx])
    if not period_labels:
        return

    report.periods = _period_labels_to_keys(period_labels, report.period_start)
    expected_amounts = len(report.periods) + 1
    current_section = ""

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
            if not _contains_amount(line):
                current_section = line
            continue

        description, amounts = parsed
        values = {
            period: amount
            for period, amount in zip(report.periods, amounts[:-1])
        }
        report.line_items.append(PnlLineItem(
            description=description,
            section=current_section,
            values=values,
            total=amounts[-1],
            is_total=_is_total_line(description),
        ))


def _find_table_header(lines: list[str]) -> Optional[int]:
    for idx, line in enumerate(lines):
        low = line.lower()
        if low.startswith("deskripsi ") and "total" in low and "(idr)" in low:
            return idx
    return None


def _extract_period_labels(header_line: str) -> list[str]:
    labels = re.findall(r"([A-Za-z]+)\s*\(IDR\)", header_line, flags=re.IGNORECASE)
    return [label for label in labels if label.lower() != "total"]


def _period_labels_to_keys(labels: list[str], period_start: str) -> list[str]:
    start_year = int(period_start[:4]) if re.match(r"\d{4}-\d{2}", period_start) else None
    start_month = int(period_start[5:7]) if re.match(r"\d{4}-\d{2}", period_start) else None
    year = start_year
    previous_month = start_month
    keys: list[str] = []

    for idx, label in enumerate(labels):
        month = _MONTHS.get(label.lower())
        if month is None:
            keys.append(label)
            continue
        if year is None:
            year = start_year or 0
        elif previous_month is not None and idx > 0 and month < previous_month:
            year += 1
        previous_month = month
        keys.append(f"{year:04d}-{month:02d}" if year else label)

    return keys


def _parse_item_line(line: str, expected_amounts: int) -> Optional[tuple[str, list[float]]]:
    matches = list(_AMOUNT_RE.finditer(line))
    if len(matches) < expected_amounts:
        return None

    amount_matches = matches[-expected_amounts:]
    description = _clean(line[:amount_matches[0].start()])
    if not description:
        return None

    amounts = [_parse_amount(match.group(0)) for match in amount_matches]
    return description, amounts


def _build_summaries(report: PnlReport) -> None:
    summary_patterns = {
        "revenue": r"^jumlah\s+pendapatan$",
        "cost_of_goods_sold": r"^jumlah\s+beban\s+pokok\s+penjualan$",
        "gross_profit": r"^laba\s+kotor$",
        "operating_expense": r"^jumlah\s+beban\s+operasional$",
        "operating_profit": r"^pendapatan\s+operasional$",
        "non_operating": r"^jumlah\s+pendapatan\s+dan\s+beban\s+non\s+operasional$",
        "net_income": r"^laba\s+bersih$",
    }

    for key, pattern in summary_patterns.items():
        item = next(
            (line for line in report.line_items if re.search(pattern, line.description, re.IGNORECASE)),
            None,
        )
        if item is None:
            continue
        summary = dict(item.values)
        if item.total is not None:
            summary["total"] = item.total
        report.summaries[key] = summary


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
    return low.startswith("deskripsi ") and "total" in low


def _is_report_chrome(line: str) -> bool:
    low = line.lower()
    return (
        "laba/rugi" in low
        or low.startswith("from period ")
        or low.startswith("branch :")
        or low.startswith("currency :")
        or re.match(r"^pt\s+", low) is not None
    )


def _is_total_line(description: str) -> bool:
    desc = description.strip()
    return desc.lower().startswith("jumlah ") or desc.isupper()


def _main() -> None:
    parser = argparse.ArgumentParser(description="Parse ACCURATE multi-period Profit & Loss PDF.")
    parser.add_argument("pdf", help="Path to P&L PDF")
    args = parser.parse_args()
    report = parse_pnl_pdf(args.pdf)
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
