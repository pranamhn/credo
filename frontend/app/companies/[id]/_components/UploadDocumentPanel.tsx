import type { DocumentType } from "@/lib/api";
import { docTypeInfo } from "../_lib/company-detail-constants";

interface Props {
  selectedDocType: DocumentType;
  onDocTypeSelect: (type: DocumentType) => void;
}

export function UploadDocumentPanel({ selectedDocType, onDocTypeSelect }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800 mb-0.5">Upload Dokumen Baru</p>
      <p className="text-xs text-slate-400 mb-4">Pilih tipe sebelum mengunggah file.</p>
      <div className="space-y-1.5 mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tipe Dokumen</p>
        <div className="grid gap-1.5">
          {(Object.keys(docTypeInfo) as DocumentType[])
            .filter((type) => !["nib", "ahu", "akta"].includes(type))
            .map((type) => {
              const info = docTypeInfo[type];
              const Icon = info.icon;
              const isActive = selectedDocType === type;
              return (
                <button
                  key={type}
                  onClick={() => onDocTypeSelect(type)}
                  className={`flex items-center gap-3 w-full rounded-lg border p-2.5 text-left transition-all ${
                    isActive
                      ? "border-violet-300 bg-violet-50 text-violet-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${isActive ? info.active : info.idle} ring-current/20`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{info.label}</p>
                    <p className={`text-[10px] ${isActive ? "text-violet-600" : "text-slate-400"}`}>
                      {type === "bank_statement" ? "Akan diparse transaksinya" : "Disimpan sebagai dokumen"}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
