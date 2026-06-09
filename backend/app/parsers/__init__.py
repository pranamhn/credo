from __future__ import annotations

__all__ = [
    "BankDetector",
    "DetectionResult",
    "ReconciliationEngine",
    "ParsingPipeline",
]


def __getattr__(name: str):
    if name in {"BankDetector", "DetectionResult"}:
        from .detector import BankDetector, DetectionResult

        return {"BankDetector": BankDetector, "DetectionResult": DetectionResult}[name]

    if name == "ReconciliationEngine":
        from .reconciliation import ReconciliationEngine

        return ReconciliationEngine

    if name == "ParsingPipeline":
        from .pipeline import ParsingPipeline

        return ParsingPipeline

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
