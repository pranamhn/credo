from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CbiReportRead(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    original_filename: str
    tanggal_laporan: Optional[str]
    npwp_query: Optional[str]
    nama_debitur: Optional[str]
    npwp: Optional[str]
    jenis_badan_usaha: Optional[str]
    jumlah_kreditur_aktif: Optional[int]
    jumlah_fasilitas_aktif: Optional[int]
    jumlah_kreditur_selesai: Optional[int]
    jumlah_fasilitas_selesai: Optional[int]
    raw_pages: Optional[int]
    parse_error: Optional[str]
    parsed_data: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class CbiReportCompanyUpdate(BaseModel):
    company_id: Optional[UUID] = None
