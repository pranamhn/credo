import { NextRequest, NextResponse } from "next/server";
import { store } from "../store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stmt = store.get(id);
  if (!stmt) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return NextResponse.json(stmt);
}
