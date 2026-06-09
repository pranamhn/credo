"""
ENG-05 — Celery parsing tasks.
Async worker: downloads file → runs pipeline → stores results → updates status.
"""
from __future__ import annotations
import logging
import os
import tempfile
from datetime import datetime
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Statement, Transaction, RiskResult
from app.models.statement import StatementStatus
from app.parsers.pipeline import ParsingPipeline
from app.risk.metrics import compute_metrics
from app.risk.flags import RedFlagEngine
from app.workers.celery_app import celery

logger = logging.getLogger(__name__)


def _get_sync_db() -> Session:
    engine = create_engine(settings.database_url_sync)
    return Session(engine)


def _download_from_storage(storage_key: str, dest_path: str) -> None:
    """Download file from S3-compatible storage to local temp path."""
    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.storage_endpoint or None,
        aws_access_key_id=settings.storage_access_key,
        aws_secret_access_key=settings.storage_secret_key,
        region_name=settings.storage_region,
    )
    s3.download_file(settings.storage_bucket, storage_key, dest_path)


@celery.task(bind=True, max_retries=3, default_retry_delay=30)
def parse_statement_task(self, statement_id: str) -> dict:
    """
    Main parsing task. Flow:
    1. Load statement record, set status=parsing
    2. Download PDF from storage
    3. Run 4-layer parsing pipeline
    4. Compute risk metrics + red flags
    5. Persist transactions, risk result, update statement status
    """
    db = _get_sync_db()
    try:
        stmt = db.get(Statement, statement_id)
        if not stmt:
            raise ValueError(f"Statement {statement_id} not found")

        stmt.status = StatementStatus.parsing
        db.commit()

        # Download to temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            _download_from_storage(stmt.storage_key, tmp_path)

            # Run parsing pipeline
            pipeline = ParsingPipeline()
            canonical = pipeline.run(tmp_path)

            # Compute risk
            metrics = compute_metrics(canonical)
            flag_engine = RedFlagEngine()
            flags = flag_engine.analyze(canonical, metrics.estimated_monthly_income)

            # Persist transactions
            db.query(Transaction).filter(Transaction.statement_id == statement_id).delete()
            for txn in canonical.transactions:
                db.add(Transaction(
                    statement_id=statement_id,
                    row=txn.row,
                    date=txn.date,
                    value_date=txn.value_date,
                    description_raw=txn.description_raw,
                    description_normalized=txn.description_normalized,
                    debit=txn.debit,
                    credit=txn.credit,
                    balance=txn.balance,
                    category=txn.category,
                    flags=[f for f in (txn.flags or [])],
                    confidence=txn.confidence,
                    source=txn.source,
                    is_low_confidence=txn.is_low_confidence,
                    raw_meta=txn.raw_meta,
                ))

            # Persist risk result
            db.query(RiskResult).filter(RiskResult.statement_id == statement_id).delete()
            risk = RiskResult(
                statement_id=statement_id,
                total_credit=metrics.total_credit,
                total_debit=metrics.total_debit,
                net_flow=metrics.net_flow,
                avg_daily_balance=metrics.avg_daily_balance,
                min_balance=metrics.min_balance,
                max_balance=metrics.max_balance,
                days_below_threshold=metrics.days_below_threshold,
                negative_balance_days=metrics.negative_balance_days,
                transaction_count=metrics.transaction_count,
                estimated_monthly_income=metrics.estimated_monthly_income,
                estimated_monthly_obligations=metrics.estimated_monthly_obligations,
                dsr=metrics.dsr,
                flags={k: vars(v) for k, v in flags.flags.items()},
                flag_count=flags.flag_count,
                has_judol=flags.has_judol,
                has_pinjol=flags.has_pinjol,
                has_passthrough=flags.has_passthrough,
                category_summary={
                    k: str(v) for k, v in (metrics.category_summary or {}).items()
                },
            )
            db.add(risk)

            # Update statement
            recon = canonical.reconciliation
            stmt.bank_code = canonical.bank_code
            stmt.bank_name = canonical.bank_name
            stmt.account_no_masked = canonical.account_no_masked
            stmt.account_holder = canonical.account_holder
            stmt.period_start = canonical.period_start
            stmt.period_end = canonical.period_end
            stmt.opening_balance = canonical.opening_balance
            stmt.closing_balance = canonical.closing_balance
            stmt.is_reconciled = recon.balanced if recon else False
            stmt.reconciliation_delta = recon.delta if recon else None
            stmt.detection_confidence = canonical.detection_confidence
            stmt.is_scanned = canonical.parse_meta.ocr if canonical.parse_meta else False
            stmt.parse_meta = canonical.parse_meta.model_dump() if canonical.parse_meta else None
            stmt.status = StatementStatus.done if (recon and recon.balanced) else StatementStatus.needs_review
            stmt.parsed_at = datetime.utcnow()

            db.commit()
            logger.info("Statement %s parsed OK: %d txns", statement_id, len(canonical.transactions))
            return {"status": "done", "transaction_count": len(canonical.transactions)}

        finally:
            os.unlink(tmp_path)

    except Exception as exc:
        logger.error("Parsing failed for %s: %s", statement_id, exc, exc_info=True)
        try:
            stmt = db.get(Statement, statement_id)
            if stmt:
                stmt.status = StatementStatus.failed
                stmt.parse_error = str(exc)
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
