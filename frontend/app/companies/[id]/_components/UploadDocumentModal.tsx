"use client";

import { X } from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import type { DocumentType } from "@/lib/api";
import { docTypeInfo } from "../_lib/company-detail-constants";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedDocType: DocumentType;
  companyId: string;
  onComplete: () => void;
}

export function UploadDocumentModal({ open, onClose, selectedDocType, companyId, onComplete }: Props) {
  if (!open) return null;

  const docInfo = docTypeInfo[selectedDocType];
  const DocIcon = docInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${docInfo.active}`}>
              <DocIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">Upload {docInfo.label}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                File akan disimpan sebagai dokumen {docInfo.label}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup upload modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <DropZone
            companyId={companyId}
            documentType={selectedDocType}
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}
