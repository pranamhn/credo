import { NextRequest, NextResponse } from "next/server";
import { applyMockProfitLossParse, store } from "../../store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stmt = store.get(id);
  if (!stmt) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  if (stmt.document_type !== "bank_statement" && stmt.document_type !== "profit_loss") {
    return NextResponse.json({ detail: "Hanya bank statement dan Profit & Loss yang bisa di-reparse" }, { status: 400 });
  }
  if (stmt.status === "queued" || stmt.status === "parsing") {
    return NextResponse.json({ detail: "Statement sedang diproses" }, { status: 409 });
  }

  Object.assign(stmt, {
    status: "queued",
    parse_error: null,
    parsed_at: null,
    is_reconciled: false,
    reconciliation_delta: null,
  });

  if (stmt.document_type === "profit_loss") {
    applyMockProfitLossParse(stmt);
    store.set(id, stmt);
    return NextResponse.json(stmt);
  }

  store.set(id, stmt);

  setTimeout(() => {
    const current = store.get(id);
    if (current) { current.status = "parsing"; store.set(id, current); }
  }, 500);

  setTimeout(() => {
    const current = store.get(id);
    if (!current) return;
    Object.assign(current, {
      status: "done",
      is_reconciled: true,
      reconciliation_delta: 0,
      detection_confidence: 0.98,
      page_count: current.page_count ?? 12,
      parsed_at: new Date().toISOString(),
    });
    store.set(id, current);
  }, 2500);

  return NextResponse.json(stmt);
}
