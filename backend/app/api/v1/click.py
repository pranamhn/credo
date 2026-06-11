"""
CLICK API — upload and retrieve CRIF CLICK individual credit reports.
"""
from __future__ import annotations
import uuid
import dataclasses
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.click_report import ClickReport
from app.schemas.click import ClickReportCompanyUpdate, ClickReportRead

router = APIRouter(prefix="/click", tags=["click"])

UPLOAD_DIR = Path("/tmp/risklens_click")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=ClickReportRead, status_code=status.HTTP_201_CREATED)
async def upload_click(
    file: UploadFile = File(...),
    company_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    file_id = uuid.uuid4()
    storage_key = f"click/{file_id}.pdf"
    dest = UPLOAD_DIR / f"{file_id}.pdf"
    dest.write_bytes(content)

    report = ClickReport(
        id=file_id,
        company_id=uuid.UUID(company_id) if company_id else None,
        original_filename=file.filename,
        storage_key=storage_key,
    )

    try:
        from app.parsers.click_parser import parse_click_pdf, ClickReport as ParsedReport
        parsed: ParsedReport = parse_click_pdf(str(dest))

        report.tanggal_laporan = parsed.tanggal_laporan or None
        report.nama_debitur    = parsed.subject.nama or None
        report.no_identitas    = parsed.subject.no_identitas or None
        report.cb_score        = parsed.cb_score
        report.risk_grade      = parsed.risk_grade or None
        report.jumlah_kontrak  = parsed.jumlah_kontrak or None
        report.jumlah_kreditur = parsed.jumlah_kreditur or None
        report.raw_pages       = parsed.raw_pages

        report.parsed_data = dataclasses.asdict(parsed)

    except Exception as exc:
        report.parse_error = str(exc)
        report.raw_pages = 0

    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/", response_model=list[ClickReportRead])
async def list_click(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ClickReport).order_by(ClickReport.created_at.desc())
    if company_id:
        q = q.where(ClickReport.company_id == uuid.UUID(company_id))
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{report_id}", response_model=ClickReportRead)
async def get_click(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(ClickReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return row


@router.patch("/{report_id}/company", response_model=ClickReportRead)
async def update_click_company(
    report_id: uuid.UUID,
    payload: ClickReportCompanyUpdate,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(ClickReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if payload.company_id and not await db.get(Company, payload.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    row.company_id = payload.company_id
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_click(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(ClickReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(row)
    await db.commit()
