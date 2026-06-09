"""Quick diagnostic: test what pdfplumber extracts from the uploaded Kopra PDF."""
import sys
import glob
import pdfplumber
from app.parsers.detector import BankDetector
from app.parsers.pipeline import ParsingPipeline

def find_latest_pdf() -> str | None:
    pdfs = sorted(glob.glob("/tmp/risklens_uploads/*.pdf"))
    return pdfs[-1] if pdfs else None

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else find_latest_pdf()
    if not path:
        print("No PDF found. Provide path as argument.")
        sys.exit(1)

    print(f"\n=== Testing: {path} ===\n")

    # Step 1: raw text extraction
    print("─── Raw text (first 3 pages) ───")
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages[:3]):
            t = page.extract_text()
            print(f"\n--- Page {i+1} ---")
            print(t[:2000] if t else "(no text)")

    # Step 2: table extraction
    print("\n\n─── Tables (first 3 pages) ───")
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages[:3]):
            tables = page.extract_tables()
            print(f"\n--- Page {i+1}: {len(tables)} table(s) ---")
            for j, table in enumerate(tables):
                print(f"  Table {j+1}: {len(table)} rows")
                for row in table[:5]:
                    print(f"    {row}")

    # Step 3: bank detection
    print("\n\n─── Bank Detection ───")
    detector = BankDetector()
    result = detector.detect(path)
    print(f"  bank_code: {result.bank_code}")
    print(f"  bank_name: {result.bank_name}")
    print(f"  confidence: {result.confidence}")
    print(f"  is_scanned: {result.is_scanned}")
    print(f"  matched_keywords: {result.matched_keywords}")

    # Step 4: full pipeline
    print("\n\n─── Full Pipeline ───")
    try:
        pipeline = ParsingPipeline()
        canonical = pipeline.run(path)
        print(f"  bank: {canonical.bank_code} ({canonical.bank_name})")
        print(f"  account: {canonical.account_no_masked}")
        print(f"  holder: {canonical.account_holder}")
        print(f"  period: {canonical.period_start} → {canonical.period_end}")
        print(f"  opening: {canonical.opening_balance}")
        print(f"  closing: {canonical.closing_balance}")
        print(f"  transactions: {len(canonical.transactions)}")
        for txn in canonical.transactions[:5]:
            print(f"    row={txn.row} date={txn.date} dr={txn.debit} cr={txn.credit} desc={txn.description_raw[:40]!r}")
        recon = canonical.reconciliation
        if recon:
            print(f"  reconciled: {recon.balanced} (delta={recon.delta})")
    except Exception as e:
        import traceback
        print(f"  FAILED: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
