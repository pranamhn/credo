"""
SLIK/IDEB API — upload and retrieve OJK credit bureau reports.
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
from app.models.slik_report import SlikReport
from app.schemas.slik import SlikReportCompanyUpdate, SlikReportRead

router = APIRouter(prefix="/slik", tags=["slik"])

UPLOAD_DIR = Path("/tmp/risklens_slik")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=SlikReportRead, status_code=status.HTTP_201_CREATED)
async def upload_slik(
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
    storage_key = f"slik/{file_id}.pdf"
    dest = UPLOAD_DIR / f"{file_id}.pdf"
    dest.write_bytes(content)

    report = SlikReport(
        id=file_id,
        company_id=uuid.UUID(company_id) if company_id else None,
        original_filename=file.filename,
        storage_key=storage_key,
    )

    try:
        from app.parsers.slik_parser import parse_slik_pdf, SlikReport as ParsedReport
        parsed: ParsedReport = parse_slik_pdf(str(dest))

        report.nomor_laporan = parsed.nomor_laporan or None
        report.tanggal_laporan = parsed.tanggal_laporan or None
        report.pemohon = parsed.pemohon or None
        report.nama_debitur = parsed.debitur.nama or None
        report.no_identitas = parsed.debitur.no_identitas or None
        report.npwp = parsed.debitur.npwp or None
        report.tanggal_lahir = parsed.debitur.tanggal_lahir or None
        report.jumlah_kreditur = parsed.jumlah_kreditur or None
        report.jumlah_fasilitas = parsed.jumlah_fasilitas or None
        report.raw_pages = parsed.raw_pages

        # Serialise full parsed payload as JSONB
        report.parsed_data = dataclasses.asdict(parsed)

    except Exception as exc:
        report.parse_error = str(exc)
        report.raw_pages = 0

    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/", response_model=list[SlikReportRead])
async def list_slik(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(SlikReport).order_by(SlikReport.created_at.desc())
    if company_id:
        q = q.where(SlikReport.company_id == uuid.UUID(company_id))
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{report_id}", response_model=SlikReportRead)
async def get_slik(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(SlikReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return row


@router.patch("/{report_id}/company", response_model=SlikReportRead)
async def update_slik_company(
    report_id: uuid.UUID,
    payload: SlikReportCompanyUpdate,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(SlikReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if payload.company_id and not await db.get(Company, payload.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    row.company_id = payload.company_id
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slik(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(SlikReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(row)
    await db.commit()
