import { NextRequest, NextResponse } from "next/server";
import { createStatement } from "../store";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const companyId = form.get("company_id")?.toString() || null;
    const documentType = form.get("document_type")?.toString() || "bank_statement";

    if (!file) {
      return NextResponse.json({ detail: "File tidak ditemukan" }, { status: 400 });
    }

    const allowedExts = [".pdf", ".csv", ".xlsx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ detail: `Format tidak didukung: ${ext}` }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ detail: "File terlalu besar (maks 50MB)" }, { status: 413 });
    }

    const allowedDocumentTypes = ["bank_statement", "profit_loss", "cash_flow", "balance_sheet", "other"] as const;
    if (!allowedDocumentTypes.includes(documentType as typeof allowedDocumentTypes[number])) {
      return NextResponse.json({ detail: `Tipe dokumen tidak didukung: ${documentType}` }, { status: 400 });
    }

    const stmt = createStatement(file.name, {
      companyId,
      documentType: documentType as typeof allowedDocumentTypes[number],
    });
    return NextResponse.json(stmt, { status: 202 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
