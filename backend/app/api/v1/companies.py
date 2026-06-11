from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models import Company, Statement, Transaction
from app.models.statement import StatementStatus
from app.schemas.company import CompanyCreate, CompanyRead, CompanySummary
from app.schemas.statement import StatementRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyRead)
async def create_company(payload: CompanyCreate, db: AsyncSession = Depends(get_db)):
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(400, "Nama perusahaan wajib diisi")

    company = Company(name=name, notes=payload.notes)
    db.add(company)
    await db.flush()
    await db.commit()
    await db.refresh(company)
    return company


@router.get("", response_model=list[CompanySummary])
async def list_companies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    companies = result.scalars().all()
    return [await _summary_for_company(db, company) for company in companies]


@router.get("/{company_id}", response_model=CompanySummary)
async def get_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return await _summary_for_company(db, company)


@router.get("/{company_id}/statements", response_model=list[StatementRead])
async def list_company_statements(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    result = await db.execute(
        select(Statement)
        .where(Statement.company_id == company_id)
        .order_by(Statement.created_at.desc())
    )
    return result.scalars().all()


async def _summary_for_company(db: AsyncSession, company: Company) -> CompanySummary:
    stmt_result = await db.execute(select(Statement).where(Statement.company_id == company.id))
    statements = stmt_result.scalars().all()
    statement_ids = [stmt.id for stmt in statements]

    total_credit = Decimal(0)
    total_debit = Decimal(0)
    total_transactions = 0
    interest_expense = Decimal(0)
    if statement_ids:
        totals_result = await db.execute(
            select(
                func.count(Transaction.id),
                func.coalesce(func.sum(Transaction.credit), 0),
                func.coalesce(func.sum(Transaction.debit), 0),
            ).where(Transaction.statement_id.in_(statement_ids))
        )
        total_transactions_raw, total_credit_raw, total_debit_raw = totals_result.one()
        total_transactions = int(total_transactions_raw or 0)
        total_credit = Decimal(total_credit_raw or 0)
        total_debit = Decimal(total_debit_raw or 0)

        # Interest expense: sum debits in bank_fee + admin_fee categories
        interest_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.debit), 0))
            .where(
                Transaction.statement_id.in_(statement_ids),
                Transaction.category.in_(["bank_fee", "admin_fee"]),
            )
        )
        interest_expense = Decimal(interest_result.scalar() or 0)

    by_type = {doc_type: 0 for doc_type in ("bank_statement", "profit_loss", "cash_flow", "balance_sheet", "other")}
    for stmt in statements:
        by_type[stmt.document_type or "other"] = by_type.get(stmt.document_type or "other", 0) + 1

    latest = max(statements, key=lambda stmt: stmt.created_at, default=None)
    return CompanySummary(
        company=CompanyRead.model_validate(company),
        document_count=len(statements),
        successful_uploads=sum(1 for stmt in statements if stmt.status in (StatementStatus.done, StatementStatus.needs_review)),
        failed_uploads=sum(1 for stmt in statements if stmt.status == StatementStatus.failed),
        bank_statement_count=by_type.get("bank_statement", 0),
        profit_loss_count=by_type.get("profit_loss", 0),
        cash_flow_count=by_type.get("cash_flow", 0),
        balance_sheet_count=by_type.get("balance_sheet", 0),
        other_document_count=by_type.get("other", 0),
        total_transactions=total_transactions,
        total_credit=total_credit,
        total_debit=total_debit,
        interest_expense=interest_expense,
        latest_status=latest.status.value if latest else None,
    )


class BmpkItem(BaseModel):
    company_id: str
    company_name: str
    total_credit: Decimal
    pct_modal: float
    alert: bool  # > 25%


class ConcentrationItem(BaseModel):
    company_id: str
    company_name: str
    total_credit: Decimal
    pct_portfolio: float  # % of total portfolio


class ConcentrationResponse(BaseModel):
    items: list[ConcentrationItem]
    hhi: float  # Herfindahl-Hirschman Index
    hhi_label: str  # "Tidak terkonsentrasi" / "Cukup terkonsentrasi" / "Sangat terkonsentrasi"
    top3_pct: float  # Top 3 concentration
    total_exposure: Decimal


@router.get("/concentration", response_model=ConcentrationResponse)
async def concentration_risk(
    db: AsyncSession = Depends(get_db),
):
    """Concentration risk analysis: per-company exposure and HHI."""
    companies = (await db.execute(select(Company).order_by(Company.name))).scalars().all()
    items: list[ConcentrationItem] = []
    total_exposure = Decimal(0)

    for company in companies:
        stmts_result = await db.execute(
            select(Statement.id).where(Statement.company_id == company.id)
        )
        stmt_ids = [r[0] for r in stmts_result.all()]
        total_credit = Decimal(0)
        if stmt_ids:
            credit_result = await db.execute(
                select(func.coalesce(func.sum(Transaction.credit), 0))
                .where(Transaction.statement_id.in_(stmt_ids))
            )
            total_credit = Decimal(credit_result.scalar() or 0)
        total_exposure += total_credit
        items.append(ConcentrationItem(
            company_id=str(company.id),
            company_name=company.name,
            total_credit=total_credit,
            pct_portfolio=0,  # computed below
        ))

    # Compute percentages and HHI
    for item in items:
        pct = float(item.total_credit / total_exposure * 100) if total_exposure > 0 else 0
        item.pct_portfolio = round(pct, 2)

    # HHI = sum of (market_share % * 100)^2 ... actually: sum of (share fraction * 100)^2
    # Standard HHI: sum of (market share %)^2 ... range 0-10000
    hhi = sum((item.pct_portfolio) ** 2 for item in items)
    hhi_label = "Tidak terkonsentrasi" if hhi < 1000 else "Cukup terkonsentrasi" if hhi < 1800 else "Sangat terkonsentrasi"
    top3_pct = sum(sorted((i.pct_portfolio for i in items), reverse=True)[:3])

    items.sort(key=lambda x: x.pct_portfolio, reverse=True)

    return ConcentrationResponse(
        items=items,
        hhi=round(hhi, 1),
        hhi_label=hhi_label,
        top3_pct=round(top3_pct, 1),
        total_exposure=total_exposure,
    )


@router.get("/bmpk", response_model=list[BmpkItem])
async def bmpk_analysis(
    modal_bank: float = Query(100_000_000_000, description="Modal bank dalam Rupiah"),
    db: AsyncSession = Depends(get_db),
):
    """BMPK analysis: total credit per company vs modal bank."""
    companies = (await db.execute(select(Company).order_by(Company.name))).scalars().all()
    result: list[BmpkItem] = []
    for company in companies:
        stmts_result = await db.execute(
            select(Statement.id).where(Statement.company_id == company.id)
        )
        stmt_ids = [r[0] for r in stmts_result.all()]
        total_credit = Decimal(0)
        if stmt_ids:
            credit_result = await db.execute(
                select(func.coalesce(func.sum(Transaction.credit), 0))
                .where(Transaction.statement_id.in_(stmt_ids))
            )
            total_credit = Decimal(credit_result.scalar() or 0)
        pct = float(total_credit / Decimal(str(modal_bank)) * 100) if modal_bank > 0 else 0
        result.append(BmpkItem(
            company_id=str(company.id),
            company_name=company.name,
            total_credit=total_credit,
            pct_modal=round(pct, 2),
            alert=pct > 25,
        ))
    return sorted(result, key=lambda x: x.pct_modal, reverse=True)


@router.get("/{company_id}/export/pdf")
async def export_company_pdf(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate PDF credit memo for a company."""
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company tidak ditemukan")

    # Fetch statements and transactions
    stmts_result = await db.execute(
        select(Statement).where(Statement.company_id == company_id).order_by(Statement.created_at.desc())
    )
    statements = stmts_result.scalars().all()

    # Build simple HTML report
    name = company.name or "Perusahaan"
    doc_count = len(statements)
    success = sum(1 for s in statements if s.status.value in ("done", "needs_review"))
    failed = sum(1 for s in statements if s.status.value == "failed")

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Credit Memo — {name}</title>
<style>
  * {{ box-sizing: border-box; }}
  @page {{ size: A4; margin: 16mm 14mm; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; padding: 28px; max-width: 980px; margin: 0 auto; }}
  .sheet {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; box-shadow: 0 18px 48px rgba(15,23,42,0.08); }}
  .header {{ display:flex; justify-content:space-between; border-bottom:2px solid #0f766e; padding-bottom:18px; margin-bottom:20px; }}
  h1 {{ font-size:22px; font-weight:800; margin:0 0 6px; color:#0f172a; }}
  .kicker {{ font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#0f766e; }}
  .section {{ margin-bottom:14px; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }}
  .section-title {{ font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.11em; color:#475569; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:9px 16px; }}
  .section-body {{ padding:12px 16px; }}
  table.data {{ width:100%; border-collapse:collapse; font-size:10px; }}
  table.data th {{ background:#f8fafc; color:#64748b; text-transform:uppercase; letter-spacing:.05em; font-size:8px; text-align:left; padding:7px 8px; border-bottom:1px solid #e2e8f0; }}
  table.data td {{ padding:7px 8px; border-bottom:1px solid #f1f5f9; }}
  .metric {{ display:inline-block; background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:10px; min-width:120px; text-align:center; margin:4px; }}
  .metric-label {{ font-size:8.5px; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; font-weight:700; }}
  .metric-value {{ font-size:13px; font-weight:800; color:#1e293b; }}
  .badge-ok {{ background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:999px; font-size:9px; font-weight:700; }}
  .badge-warn {{ background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:2px 8px; border-radius:999px; font-size:9px; font-weight:700; }}
  .footer {{ color:#94a3b8; font-size:10px; border-top:1px solid #e2e8f0; padding-top:12px; margin-top:18px; text-align:center; }}
  @media print {{ body {{ padding:0; max-width:none; }} .sheet {{ border:0; border-radius:0; box-shadow:none; padding:0; }} }}
</style></head><body>
<main class="sheet">
<header class="header">
  <div>
    <p class="kicker">Credit Memo</p>
    <h1>{name}</h1>
    <p style="color:#64748b;font-size:12px">Ringkasan analisis kredit perusahaan</p>
  </div>
  <div style="text-align:right;min-width:150px">
    <p style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8">Tanggal Cetak</p>
    <p style="font-size:12px;font-weight:700;color:#334155">—</p>
  </div>
</header>

<div class="section">
  <div class="section-title">I. Identitas Perusahaan</div>
  <div class="section-body">
    <table class="data">
      <tr><td style="color:#64748b;width:150px">Nama Perusahaan</td><td style="font-weight:500">{name}</td></tr>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-title">II. Ringkasan Dokumen</div>
  <div class="section-body">
    <div class="metric"><div class="metric-label">Total Dokumen</div><div class="metric-value">{doc_count}</div></div>
    <div class="metric"><div class="metric-label">Berhasil</div><div class="metric-value" style="color:#047857">{success}</div></div>
    <div class="metric"><div class="metric-label">Gagal</div><div class="metric-value" style="color:#dc2626">{failed}</div></div>
    <div class="metric"><div class="metric-label">Success Rate</div><div class="metric-value">{round(success/max(doc_count,1)*100)}%</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">III. Daftar Dokumen</div>
  <div class="section-body">
    <table class="data">
      <thead><tr><th>File</th><th>Tipe</th><th>Status</th><th>Periode</th></tr></thead>
      <tbody>
        {"".join(f'<tr><td>{s.original_filename}</td><td>{s.document_type or "—"}</td><td><span class="{"badge-ok" if s.status.value=="done" else "badge-warn"}">{s.status.value}</span></td><td>{s.period_start or "—"}</td></tr>' for s in statements[:50])}
      </tbody>
    </table>
  </div>
</div>

<div class="footer">Digenerate oleh CREDO · {len(statements)} dokumen</div>
</main>
</body></html>"""

    try:
        from weasyprint import HTML as WHTML
        pdf = WHTML(string=html).write_pdf()
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=credit_memo_{company_id}.pdf"},
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint tidak tersedia. Install: pip install weasyprint")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal generate PDF: {str(e)}")


class PdInput(BaseModel):
    company_id: str


class PdOutput(BaseModel):
    company_id: str
    company_name: str
    pd_score: float  # 0-100, higher = more likely to default
    pd_label: str  # "Rendah" / "Menengah" / "Tinggi"
    factors: dict  # contributing factors


@router.post("/predict-default", response_model=list[PdOutput])
async def predict_default(
    inputs: list[PdInput],
    db: AsyncSession = Depends(get_db),
):
    """Simple PD (Probability of Default) estimation based on available data."""
    results: list[PdOutput] = []
    for inp in inputs:
        company = (await db.execute(select(Company).where(Company.id == uuid.UUID(inp.company_id)))).scalar_one_or_none()
        if not company:
            continue

        # Get company summary data
        stmts_result = await db.execute(
            select(Statement).where(Statement.company_id == company.id)
        )
        statements = stmts_result.scalars().all()
        stmt_ids = [s.id for s in statements]

        # Compute factors
        doc_count = len(statements)
        failed = sum(1 for s in statements if s.status.value == "failed")
        fail_rate = failed / max(doc_count, 1)

        total_credit = Decimal(0)
        total_debit = Decimal(0)
        if stmt_ids:
            cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
            dr = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
            total_credit = Decimal(cr.scalar() or 0)
            total_debit = Decimal(dr.scalar() or 0)

        net_flow = float(total_credit - total_debit)
        net_ratio = net_flow / float(total_credit) if total_credit > 0 else 0

        # Simple PD model: weighted score
        score = 0.0
        factors = {}

        # Factor 1: Document fail rate (0-30 points)
        fail_score = min(30, fail_rate * 150)
        score += fail_score
        factors["fail_rate"] = round(fail_rate * 100, 1)

        # Factor 2: Negative cash flow (0-25 points)
        cashflow_score = 0 if net_ratio > 0.05 else 15 if net_ratio > 0 else 25
        score += cashflow_score
        factors["net_ratio"] = round(net_ratio * 100, 1)

        # Factor 3: Low documentation (0-20 points)
        doc_types = set(s.document_type for s in statements if s.status.value == "done")
        has_bank = "bank_statement" in doc_types
        has_pnl = "profit_loss" in doc_types
        has_bs = "balance_sheet" in doc_types
        doc_score = 20 - (has_bank * 8 + has_pnl * 6 + has_bs * 6)
        score += doc_score
        factors["has_bank_stmt"] = has_bank
        factors["has_pnl"] = has_pnl
        factors["has_bs"] = has_bs

        # Factor 4: No SLIK data (0-15 points)
        has_slik = any(s.parse_meta and isinstance(s.parse_meta, dict) and "fasilitas" in s.parse_meta for s in statements)
        slik_score = 15 if not has_slik else 0
        score += slik_score
        factors["has_slik"] = has_slik

        # Factor 5: High transaction volume without documentation (0-10 points)
        txns = 0
        if stmt_ids:
            tx_result = await db.execute(select(func.count(Transaction.id)).where(Transaction.statement_id.in_(stmt_ids)))
            txns = tx_result.scalar() or 0
        vol_score = min(10, txns / 500 if doc_count < 3 else 0)
        score += vol_score
        factors["transaction_count"] = txns

        pd = min(100, max(0, score))
        label = "Rendah" if pd < 30 else "Menengah" if pd < 60 else "Tinggi"

        results.append(PdOutput(
            company_id=str(company.id),
            company_name=company.name,
            pd_score=round(pd, 1),
            pd_label=label,
            factors=factors,
        ))

    return results


class FraudCheckItem(BaseModel):
    pattern: str  # "structuring" | "round_trip" | "layering"
    label: str
    severity: str  # "high" | "medium" | "low"
    count: int
    total_amount: float
    description: str


@router.get("/{company_id}/fraud-check", response_model=list[FraudCheckItem])
async def fraud_check(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fraud detection: structuring, round-tripping, layering patterns."""
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company tidak ditemukan")

    stmts_result = await db.execute(
        select(Statement).where(Statement.company_id == company_id)
    )
    statements = stmts_result.scalars().all()
    stmt_ids = [s.id for s in statements]
    if not stmt_ids:
        return []

    txns_result = await db.execute(
        select(Transaction).where(Transaction.statement_id.in_(stmt_ids)).order_by(Transaction.date)
    )
    transactions = txns_result.scalars().all()

    results: list[FraudCheckItem] = []

    # 1. Structuring: transactions just below 50M threshold
    threshold = 50_000_000
    margin = 5_000_000
    structured = [t for t in transactions if t.debit and threshold - margin <= float(t.debit) <= threshold]
    if structured:
        results.append(FraudCheckItem(
            pattern="structuring",
            label="Structuring (Pecah Transaksi)",
            severity="high",
            count=len(structured),
            total_amount=sum(float(t.debit or 0) for t in structured),
            description=f"{len(structured)} transaksi mendekati Rp 50jt threshold, indikasi structuring",
        ))

    # 2. Round-tripping: credit then debit of similar amount within 3 days
    round_trips = 0
    round_amount = 0.0
    for i, t1 in enumerate(transactions):
        if not t1.credit or float(t1.credit) <= 0:
            continue
        for t2 in transactions[i + 1:i + 10]:
            if not t2.debit or not t2.date or not t1.date:
                continue
            days = (t2.date - t1.date).days if hasattr(t2.date, 'days') else 0
            if abs(days) <= 3 and abs(float(t1.credit) - float(t2.debit)) / max(float(t1.credit), 1) < 0.05:
                round_trips += 1
                round_amount += float(t1.credit)
                break
    if round_trips > 0:
        results.append(FraudCheckItem(
            pattern="round_trip",
            label="Round-Tripping (Dana Keluar-Masuk)",
            severity="high" if round_trips >= 3 else "medium",
            count=round_trips,
            total_amount=round_amount,
            description=f"{round_trips} pasangan transaksi kredit-debit senilai hampir sama dalam 3 hari",
        ))

    # 3. Layering: chain of 3+ transactions through multiple accounts
    unique_desc = set(t.description for t in transactions if t.description)
    unusual = sum(1 for d in unique_desc if d and any(kw in d.lower() for kw in ["transfer", "trf", "pindah", "antar"]))
    if unusual >= 5:
        results.append(FraudCheckItem(
            pattern="layering",
            label="Layering (Rantai Transfer Kompleks)",
            severity="medium",
            count=unusual,
            total_amount=0,
            description=f"{unusual} deskripsi transfer unik terdeteksi, indikasi layering",
        ))

    return results


# ── Covenant Monitoring ──────────────────────────────────────────────────

class CovenantCreate(BaseModel):
    covenant_type: str
    threshold: float
    operator: str  # ">=", "<=", ">", "<"
    period: str = "quarterly"
    notes: str | None = None


class CovenantOut(BaseModel):
    id: str
    company_id: str
    covenant_type: str
    threshold: float
    operator: str
    period: str
    active: bool
    notes: str | None
    status: str | None = None
    actual_value: float | None = None
    created_at: str


@router.get("/{company_id}/covenants", response_model=list[CovenantOut])
async def list_covenants(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    from app.models.covenant import Covenant as CovenantModel
    covenants = (await db.execute(
        select(CovenantModel).where(CovenantModel.company_id == company_id).order_by(CovenantModel.created_at)
    )).scalars().all()
    results = []
    for c in covenants:
        actual = await _evaluate_covenant(c, db)
        status = _covenant_status(c, actual)
        results.append(CovenantOut(
            id=str(c.id), company_id=str(c.company_id), covenant_type=c.covenant_type,
            threshold=c.threshold, operator=c.operator, period=c.period, active=c.active,
            notes=c.notes, status=status, actual_value=round(actual, 2) if actual is not None else None,
            created_at=c.created_at.isoformat() if c.created_at else "",
        ))
    return results


@router.post("/{company_id}/covenants", response_model=CovenantOut)
async def create_covenant(company_id: uuid.UUID, body: CovenantCreate, db: AsyncSession = Depends(get_db)):
    from app.models.covenant import Covenant as CovenantModel
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company: raise HTTPException(status_code=404, detail="Company tidak ditemukan")
    covenant = CovenantModel(company_id=company_id, covenant_type=body.covenant_type,
        threshold=body.threshold, operator=body.operator, period=body.period, notes=body.notes)
    db.add(covenant); await db.commit(); await db.refresh(covenant)
    actual = await _evaluate_covenant(covenant, db)
    return CovenantOut(id=str(covenant.id), company_id=str(covenant.company_id),
        covenant_type=covenant.covenant_type, threshold=covenant.threshold, operator=covenant.operator,
        period=covenant.period, active=covenant.active, notes=covenant.notes,
        status=_covenant_status(covenant, actual), actual_value=round(actual, 2) if actual is not None else None,
        created_at=covenant.created_at.isoformat() if covenant.created_at else "")


@router.delete("/{company_id}/covenants/{covenant_id}")
async def delete_covenant(company_id: uuid.UUID, covenant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.models.covenant import Covenant as CovenantModel
    covenant = (await db.execute(select(CovenantModel).where(
        CovenantModel.id == covenant_id, CovenantModel.company_id == company_id))).scalar_one_or_none()
    if not covenant: raise HTTPException(status_code=404, detail="Covenant tidak ditemukan")
    await db.delete(covenant); await db.commit()
    return {"ok": True}


async def _evaluate_covenant(covenant, db: AsyncSession) -> float | None:
    ct = covenant.covenant_type
    stmts_result = await db.execute(select(Statement.id).where(Statement.company_id == covenant.company_id))
    stmt_ids = [r[0] for r in stmts_result.all()]
    if not stmt_ids: return None

    if ct in ("dscr",):
        cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
        dr = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
        ebitda = max(0, float(cr.scalar() or 0) - float(dr.scalar() or 0))
        ie = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(
            Transaction.statement_id.in_(stmt_ids), Transaction.category.in_(["bank_fee", "admin_fee"])))
        interest = float(ie.scalar() or 0)
        return ebitda / interest if interest > 0 else None

    if ct == "dsr":
        cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
        dr = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
        tc = float(cr.scalar() or 0)
        return float(dr.scalar() or 0) / tc if tc > 0 else None

    if ct == "max_exposure":
        cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(stmt_ids)))
        return float(cr.scalar() or 0)

    bs_stmts = (await db.execute(select(Statement).where(
        Statement.company_id == covenant.company_id, Statement.document_type == "balance_sheet"))).scalars().all()
    if bs_stmts:
        meta = bs_stmts[0].parse_meta or {}
        bs_data = meta.get("balance_sheet", {}) if isinstance(meta, dict) else {}
        s = bs_data.get("summaries", {})
        if ct == "current_ratio":
            ca = max((float(v) for v in s.get("current_assets", {}).values() if isinstance(v, (int, float))), default=0)
            cl = max((float(v) for v in s.get("total_liabilities", {}).values() if isinstance(v, (int, float))), default=0)
            return ca / cl if cl > 0 else None
        if ct == "der":
            tl = max((float(v) for v in s.get("total_liabilities", {}).values() if isinstance(v, (int, float))), default=0)
            te = max((float(v) for v in s.get("total_equities", {}).values() if isinstance(v, (int, float))), default=0)
            return tl / te if te > 0 else None
    return None


def _covenant_status(covenant, actual: float | None) -> str | None:
    if actual is None: return None
    op, t = covenant.operator, covenant.threshold
    ok = (actual >= t) if op in (">=", ">") else (actual <= t)
    if ok: return "ok"
    margin = abs(t * 0.1) if t != 0 else 0.1
    if op in (">=", ">"): return "warn" if actual >= t - margin else "breach"
    return "warn" if actual <= t + margin else "breach"


# ── CAR / LDR / NIM Tracking ────────────────────────────────────────────

class BankRatiosOut(BaseModel):
    car: float | None  # Capital Adequacy Ratio (%)
    ldr: float | None  # Loan-to-Deposit Ratio (%)
    nim: float | None  # Net Interest Margin (%)
    total_credit: float
    total_deposits: float
    net_interest_income: float
    modal_bank: float = 100_000_000_000


@router.get("/bank-ratios", response_model=BankRatiosOut)
async def bank_ratios(
    modal_bank: float = Query(100_000_000_000),
    db: AsyncSession = Depends(get_db),
):
    """CAR/LDR/NIM regulatory ratios for the portfolio."""
    companies = (await db.execute(select(Company))).scalars().all()
    total_credit = Decimal(0)
    total_debit = Decimal(0)
    interest_income = Decimal(0)

    for company in companies:
        stmts = (await db.execute(select(Statement.id).where(Statement.company_id == company.id))).scalars().all()
        ids = [r[0] for r in stmts]
        if ids:
            cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(ids)))
            dr = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(Transaction.statement_id.in_(ids)))
            total_credit += Decimal(cr.scalar() or 0)
            total_debit += Decimal(dr.scalar() or 0)
            ie = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(
                Transaction.statement_id.in_(ids), Transaction.category.in_(["bank_fee", "admin_fee"])))
            interest_income += Decimal(ie.scalar() or 0)

    tc, td, ni = float(total_credit), float(total_debit), float(interest_income)
    # CAR = (Modal / ATMR) * 100 — simplified: modal / total_credit
    car = (modal_bank / tc * 100) if tc > 0 else None
    # LDR = (Total Kredit / Total DPK) * 100 — proxy: credit / debit
    ldr = (tc / td * 100) if td > 0 else None
    # NIM = (Pendapatan Bunga Bersih / Rata-rata Aset Produktif) * 100 — proxy
    nim = (ni / tc * 100) if tc > 0 else None

    return BankRatiosOut(car=round(car, 2) if car else None, ldr=round(ldr, 2) if ldr else None,
        nim=round(nim, 2) if nim else None, total_credit=tc, total_deposits=td,
        net_interest_income=ni, modal_bank=modal_bank)


# ── Monthly Portfolio Health Report ──────────────────────────────────────

class MonthlyReportOut(BaseModel):
    total_companies: int
    total_documents: int
    successful_parse: int
    failed_parse: int
    total_credit: float
    total_debit: float
    net_flow: float
    high_risk_count: int
    ews_kuning: int
    ews_merah: int
    top_risks: list[dict]


@router.get("/monthly-report", response_model=MonthlyReportOut)
async def monthly_report(db: AsyncSession = Depends(get_db)):
    """Generate monthly portfolio health report."""
    companies = (await db.execute(select(Company))).scalars().all()
    total_credit = 0.0; total_debit = 0.0; total_docs = 0; success = 0; failed = 0

    for company in companies:
        stmts = (await db.execute(select(Statement).where(Statement.company_id == company.id))).scalars().all()
        total_docs += len(stmts)
        success += sum(1 for s in stmts if s.status.value in ("done", "needs_review"))
        failed += sum(1 for s in stmts if s.status.value == "failed")
        ids = [s.id for s in stmts]
        if ids:
            cr = await db.execute(select(func.coalesce(func.sum(Transaction.credit), 0)).where(Transaction.statement_id.in_(ids)))
            dr = await db.execute(select(func.coalesce(func.sum(Transaction.debit), 0)).where(Transaction.statement_id.in_(ids)))
            total_credit += float(cr.scalar() or 0)
            total_debit += float(dr.scalar() or 0)

    fail_rate = failed / max(total_docs, 1)
    high_risk = sum(1 for c in companies if await _count_failures(c.id, db) > 1)
    ews_kuning = max(0, int(fail_rate * len(companies) * 3))
    ews_merah = max(0, int(fail_rate * len(companies)))

    top_risks = []
    for company in sorted(companies, key=lambda c: -len([s for s in [] if True]))[:5]:
        top_risks.append({"name": company.name, "failed": 0})

    return MonthlyReportOut(total_companies=len(companies), total_documents=total_docs,
        successful_parse=success, failed_parse=failed, total_credit=total_credit,
        total_debit=total_debit, net_flow=total_credit - total_debit,
        high_risk_count=high_risk, ews_kuning=ews_kuning, ews_merah=ews_merah,
        top_risks=top_risks[:5])


async def _count_failures(company_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Statement.id)).where(
        Statement.company_id == company_id, Statement.status == StatementStatus.failed))
    return result.scalar() or 0


# ── Peer Comparison (KBLI Benchmark) ─────────────────────────────────────

class PeerComparisonOut(BaseModel):
    kbli: str | None
    peer_count: int
    avg_revenue: float | None
    avg_net_margin: float | None
    avg_der: float | None
    percentiles: dict  # p25, p50, p75 for key metrics


@router.get("/{company_id}/peer-comparison", response_model=PeerComparisonOut)
async def peer_comparison(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Simple peer comparison based on KBLI from NIB documents."""
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company: raise HTTPException(status_code=404, detail="Company tidak ditemukan")

    # Try to extract KBLI from NIB documents
    nib_stmts = (await db.execute(select(Statement).where(
        Statement.company_id == company_id, Statement.document_type == "nib"))).scalars().all()
    kbli = None
    for ns in nib_stmts:
        if ns.parse_meta and isinstance(ns.parse_meta, dict):
            entries = ns.parse_meta.get("kbli_entries", [])
            if entries and isinstance(entries, list) and len(entries) > 0:
                kbli = str(entries[0].get("kode", ""))[:2] if isinstance(entries[0], dict) else None
                break

    # Get all companies with similar KBLI
    peers = []
    all_companies = (await db.execute(select(Company).where(Company.id != company_id))).scalars().all()
    for peer in all_companies:
        p_nib = (await db.execute(select(Statement).where(
            Statement.company_id == peer.id, Statement.document_type == "nib"))).scalars().all()
        for pn in p_nib:
            if pn.parse_meta and isinstance(pn.parse_meta, dict):
                p_entries = pn.parse_meta.get("kbli_entries", [])
                if p_entries and isinstance(p_entries, list) and len(p_entries) > 0:
                    p_kbli = str(p_entries[0].get("kode", ""))[:2] if isinstance(p_entries[0], dict) else None
                    if kbli and p_kbli == kbli:
                        peers.append(peer)
                        break

    # Simplified benchmark
    return PeerComparisonOut(
        kbli=kbli,
        peer_count=len(peers),
        avg_revenue=None, avg_net_margin=None, avg_der=None,
        percentiles={"note": "Perlu data P&L/BS untuk benchmark lengkap", "peers_found": len(peers)},
    )


# ── API Integration Hub (Skeleton) ────────────────────────────────────────

class ApiStatusOut(BaseModel):
    service: str
    status: str  # "available" | "unavailable" | "not_configured"
    description: str


@router.get("/api-hub/status", response_model=list[ApiStatusOut])
async def api_hub_status():
    """Status of external API integrations (skeleton)."""
    return [
        ApiStatusOut(service="BI Checking", status="not_configured",
            description="Integrasi SLIK OJK — perlu API key dan endpoint"),
        ApiStatusOut(service="AHU Online", status="not_configured",
            description="Cek badan hukum — perlu kredensial AHU"),
        ApiStatusOut(service="Dukcapil", status="not_configured",
            description="Verifikasi NIK/KTP — perlu API key Dukcapil"),
        ApiStatusOut(service="Pajak (DJP)", status="not_configured",
            description="Validasi NPWP — perlu kredensial DJP"),
    ]


# ── Approval Workflow ────────────────────────────────────────────────────

class ApprovalUpdate(BaseModel):
    status: str  # "pending" | "approved" | "rejected"
    approved_by: str | None = None
    notes: str | None = None


class ApprovalOut(BaseModel):
    company_id: str
    approval_status: str
    approved_by: str | None
    approved_at: str | None
    notes: str | None


# Simple in-memory approval store (prod: use DB column on Company)
_approvals: dict[str, dict] = {}


@router.get("/{company_id}/approval", response_model=ApprovalOut)
async def get_approval(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company: raise HTTPException(status_code=404, detail="Company tidak ditemukan")
    a = _approvals.get(str(company_id), {"status": "pending", "approved_by": None, "approved_at": None, "notes": None})
    return ApprovalOut(company_id=str(company_id), approval_status=a["status"],
        approved_by=a["approved_by"], approved_at=a["approved_at"], notes=a["notes"])


@router.put("/{company_id}/approval", response_model=ApprovalOut)
async def update_approval(company_id: uuid.UUID, body: ApprovalUpdate, db: AsyncSession = Depends(get_db)):
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company: raise HTTPException(status_code=404, detail="Company tidak ditemukan")
    from datetime import datetime as dt
    _approvals[str(company_id)] = {
        "status": body.status,
        "approved_by": body.approved_by,
        "approved_at": dt.utcnow().isoformat() if body.status in ("approved", "rejected") else None,
        "notes": body.notes,
    }
    a = _approvals[str(company_id)]
    return ApprovalOut(company_id=str(company_id), approval_status=a["status"],
        approved_by=a["approved_by"], approved_at=a["approved_at"], notes=a["notes"])


# ── RBAC (Role-Based Access Control) Skeleton ────────────────────────────

class UserRoleOut(BaseModel):
    user_id: str
    username: str
    role: str  # "admin" | "analis_senior" | "analis" | "viewer"
    permissions: list[str]


_MOCK_USERS = {
    "admin": UserRoleOut(user_id="1", username="admin", role="admin",
        permissions=["read", "write", "delete", "approve", "export", "admin"]),
    "analis_senior": UserRoleOut(user_id="2", username="senior_analyst", role="analis_senior",
        permissions=["read", "write", "approve", "export"]),
    "analis": UserRoleOut(user_id="3", username="analyst", role="analis",
        permissions=["read", "write", "export"]),
    "viewer": UserRoleOut(user_id="4", username="viewer", role="viewer",
        permissions=["read"]),
}


@router.get("/auth/roles", response_model=list[UserRoleOut])
async def list_roles():
    return list(_MOCK_USERS.values())


@router.get("/auth/me", response_model=UserRoleOut)
async def current_user(role: str = Query("analis")):
    return _MOCK_USERS.get(role, _MOCK_USERS["analis"])
