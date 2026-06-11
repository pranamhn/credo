"""
CBI API — upload and retrieve Credit Bureau Indonesia reports.
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
from app.models.cbi_report import CbiReport
from app.schemas.cbi import CbiReportCompanyUpdate, CbiReportRead

router = APIRouter(prefix="/cbi", tags=["cbi"])

UPLOAD_DIR = Path("/tmp/risklens_cbi")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=CbiReportRead, status_code=status.HTTP_201_CREATED)
async def upload_cbi(
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
    storage_key = f"cbi/{file_id}.pdf"
    dest = UPLOAD_DIR / f"{file_id}.pdf"
    dest.write_bytes(content)

    report = CbiReport(
        id=file_id,
        company_id=uuid.UUID(company_id) if company_id else None,
        original_filename=file.filename,
        storage_key=storage_key,
    )

    try:
        from app.parsers.cbi_parser import parse_cbi_pdf, CbiReport as ParsedReport
        parsed: ParsedReport = parse_cbi_pdf(str(dest))

        report.tanggal_laporan    = parsed.tanggal_laporan or None
        report.npwp_query         = parsed.npwp_query or None
        report.nama_debitur       = parsed.debitur.nama or None
        report.npwp               = parsed.debitur.npwp or parsed.npwp_query or None
        report.jenis_badan_usaha  = parsed.debitur.jenis_badan_usaha or None
        report.jumlah_kreditur_aktif   = parsed.jumlah_kreditur_aktif or None
        report.jumlah_fasilitas_aktif  = parsed.jumlah_fasilitas_aktif or None
        report.jumlah_kreditur_selesai = parsed.jumlah_kreditur_selesai or None
        report.jumlah_fasilitas_selesai = parsed.jumlah_fasilitas_selesai or None
        report.raw_pages          = parsed.raw_pages

        report.parsed_data = dataclasses.asdict(parsed)

    except Exception as exc:
        report.parse_error = str(exc)
        report.raw_pages = 0

    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/", response_model=list[CbiReportRead])
async def list_cbi(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(CbiReport).order_by(CbiReport.created_at.desc())
    if company_id:
        q = q.where(CbiReport.company_id == uuid.UUID(company_id))
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{report_id}", response_model=CbiReportRead)
async def get_cbi(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(CbiReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return row


@router.patch("/{report_id}/company", response_model=CbiReportRead)
async def update_cbi_company(
    report_id: uuid.UUID,
    payload: CbiReportCompanyUpdate,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CbiReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if payload.company_id and not await db.get(Company, payload.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    row.company_id = payload.company_id
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cbi(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(CbiReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(row)
    await db.commit()
