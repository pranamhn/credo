import { NextRequest, NextResponse } from "next/server";
import { store, getMockTransactions } from "../../store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stmt = store.get(id);
  if (!stmt) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  if (stmt.status !== "done" && stmt.status !== "needs_review") {
    return NextResponse.json([]);
  }
  return NextResponse.json(getMockTransactions(id));
}
