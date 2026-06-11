from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ClickReportRead(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    original_filename: str
    tanggal_laporan: Optional[str]
    nama_debitur: Optional[str]
    no_identitas: Optional[str]
    cb_score: Optional[int]
    risk_grade: Optional[str]
    jumlah_kontrak: Optional[int]
    jumlah_kreditur: Optional[int]
    raw_pages: Optional[int]
    parse_error: Optional[str]
    parsed_data: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class ClickReportCompanyUpdate(BaseModel):
    company_id: Optional[UUID] = None
