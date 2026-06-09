import { NextRequest, NextResponse } from "next/server";
import { patchMockTransaction, store } from "../../../store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; row: string }> }
) {
  const { id, row } = await params;
  const stmt = store.get(id);
  if (!stmt) return NextResponse.json({ detail: "Not found" }, { status: 404 });

  const rowNumber = Number(row);
  if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
    return NextResponse.json({ detail: "Invalid row" }, { status: 400 });
  }

  const patch = await req.json().catch(() => ({}));
  const updated = patchMockTransaction(id, rowNumber, patch);
  if (!updated) return NextResponse.json({ detail: `Row ${row} tidak ditemukan` }, { status: 404 });

  return NextResponse.json(updated);
}
