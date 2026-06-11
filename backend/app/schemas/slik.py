from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SlikFasilitasRead(BaseModel):
    kreditur: str
    jenis_kredit: str
    plafon: Optional[float]
    baki_debet: Optional[float]
    tanggal_mulai: str
    tanggal_jatuh_tempo: str
    bunga: str
    kualitas: str
    kualitas_history: list[str]
    agunan: str
    nilai_agunan: Optional[float]
    penjamin: str


class SlikDebiturRead(BaseModel):
    nama: str
    no_identitas: str
    npwp: str
    tempat_lahir: str
    tanggal_lahir: str
    alamat: str
    jenis_debitur: str


class SlikReportRead(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    original_filename: str
    nomor_laporan: Optional[str]
    tanggal_laporan: Optional[str]
    pemohon: Optional[str]
    nama_debitur: Optional[str]
    no_identitas: Optional[str]
    npwp: Optional[str]
    tanggal_lahir: Optional[str]
    jumlah_kreditur: Optional[int]
    jumlah_fasilitas: Optional[int]
    raw_pages: Optional[int]
    parse_error: Optional[str]
    parsed_data: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class SlikReportCompanyUpdate(BaseModel):
    company_id: Optional[UUID] = None
