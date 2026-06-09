import { NextResponse } from "next/server";
import { store } from "./store";

export async function GET() {
  const all = Array.from(store.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return NextResponse.json(all);
}
