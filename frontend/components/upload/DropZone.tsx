"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, CheckCircle2, Clock, AlertCircle, Loader2, FileSearch } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { DocumentType, statementsApi, Statement, StatementStatus } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface FileEntry {
  file: File;
  status: "pending" | "uploading" | "parsing" | "done" | "error";
  statement?: Statement;
  error?: string;
  uploadProgress: number;
  parseProgress: number;
  currentPage: number;
  totalPages: number;
  currentRow: number;
  finalRows?: number;
  startedAt?: number;
  parsingStartedAt?: number;
  etaSeconds?: number;
}

const statusIcon: Record<FileEntry["status"], React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-slate-400" />,
  uploading: <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />,
  parsing: <FileSearch className="w-4 h-4 text-indigo-500 animate-pulse" />,
  done: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

const stmtStatusCls: Record<StatementStatus, string> = {
  queued: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  parsing: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200",
  done: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  needs_review: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  failed: "bg-red-50 text-red-600 ring-1 ring-red-200",
};

const barColor: Record<FileEntry["status"], string> = {
  pending: "bg-slate-300",
  uploading: "bg-teal-500",
  parsing: "bg-indigo-500",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fileSizeWeight(size: number): number {
  return Math.min(45, Math.max(6, Math.round(size / 450_000)));
}

function formatEta(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "sebentar lagi";
  const rounded = Math.max(1, Math.round(seconds));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes < 60) return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}j ${minutes % 60}m`;
}

function estimateRemainingSeconds(progress: number, startedAt: number | undefined, floorSeconds = 4): number | undefined {
  if (!startedAt || progress <= 2) return undefined;
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  const remaining = elapsedSeconds * ((100 - progress) / progress);
  return Math.max(floorSeconds, Math.min(3600, remaining));
}

async function estimatePdfPages(file: File): Promise<number> {
  if (!file.name.toLowerCase().endsWith(".pdf")) return 1;
  try {
    const sampleSize = Math.min(file.size, 2 * 1024 * 1024);
    const buffer = await file.slice(0, sampleSize).arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter((count) => count > 0 && count < 5000);
    if (counts.length > 0) return Math.max(...counts);
    const pageMarkers = text.match(/\/Type\s*\/Page\b/g)?.length;
    if (pageMarkers && pageMarkers > 0) return pageMarkers;
  } catch {
    return Math.max(1, Math.ceil(file.size / 350_000));
  }
  return Math.max(1, Math.ceil(file.size / 350_000));
}

export function DropZone({
  companyId,
  documentType = "bank_statement",
  onComplete,
  onStatementReady,
}: {
  companyId?: string;
  documentType?: DocumentType;
  onComplete?: () => void;
  onStatementReady?: (statement: Statement) => void;
}) {
  const [entries, setEntries] = useState<FileEntry[]>([]);

  const updateEntry = useCallback((file: File, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.file === file ? { ...e, ...patch } : e)));
  }, []);

  const pollParsing = useCallback(
    async (entry: FileEntry, statement: Statement) => {
      let parseProgress = 28;
      let currentRow = 0;
      let currentPage = 1;
      const parsingStartedAt = entry.parsingStartedAt || Date.now();

      while (true) {
        await delay(1200);
        try {
          const { data: latest } = await statementsApi.get(statement.id);
          if (latest.status === "done" || latest.status === "needs_review") {
            const finalRows = await statementsApi
              .allTransactions(latest.id)
              .then((rows) => rows.length)
              .catch(() => currentRow);
            updateEntry(entry.file, {
              status: "done",
              statement: latest,
              parseProgress: 100,
              currentPage: entry.totalPages,
              currentRow: finalRows,
              finalRows,
              etaSeconds: 0,
            });
            toast.success(`${entry.file.name} selesai (${finalRows} row)`);
            onComplete?.();
            onStatementReady?.(latest);
            return;
          }
          if (latest.status === "failed") {
            updateEntry(entry.file, {
              status: "error",
              statement: latest,
              error: latest.parse_error || "Parsing gagal",
            });
            return;
          }
          parseProgress = Math.min(94, parseProgress + 5 + Math.round(Math.random() * 7));
          currentPage = Math.min(entry.totalPages, Math.max(1, Math.ceil((parseProgress / 100) * entry.totalPages)));
          currentRow += Math.max(4, Math.round(fileSizeWeight(entry.file.size) * (0.7 + Math.random())));
          updateEntry(entry.file, {
            status: "parsing",
            statement: latest,
            parseProgress,
            currentPage,
            currentRow,
            parsingStartedAt,
            etaSeconds: estimateRemainingSeconds(parseProgress, parsingStartedAt, 8),
          });
        } catch {
          parseProgress = Math.min(90, parseProgress + 3);
          currentPage = Math.min(entry.totalPages, Math.max(1, Math.ceil((parseProgress / 100) * entry.totalPages)));
          currentRow += Math.max(2, Math.round(fileSizeWeight(entry.file.size) * 0.6));
          updateEntry(entry.file, { parseProgress, currentPage, currentRow, parsingStartedAt });
        }
      }
    },
    [updateEntry, onComplete, onStatementReady]
  );

  const uploadFile = useCallback(
    async (entry: FileEntry) => {
      const totalPages = await estimatePdfPages(entry.file);
      updateEntry(entry.file, {
        status: "uploading",
        totalPages,
        currentPage: 0,
        currentRow: 0,
        uploadProgress: 0,
        parseProgress: 0,
        startedAt: Date.now(),
      });
      try {
        const uploadStartedAt = Date.now();
        const { data } = await statementsApi.upload(entry.file, {
          companyId,
          documentType,
          onUploadProgress: (event) => {
            const total = event.total || entry.file.size || 1;
            const progress = Math.min(100, Math.round((event.loaded / total) * 100));
            updateEntry(entry.file, {
              uploadProgress: progress,
              etaSeconds: estimateRemainingSeconds(progress, uploadStartedAt, 2),
            });
          },
        });
        if (documentType !== "bank_statement") {
          updateEntry(entry.file, {
            status: "done",
            statement: data,
            uploadProgress: 100,
            parseProgress: 100,
            currentPage: totalPages,
            finalRows: 0,
          });
          toast.success(`${entry.file.name} disimpan`);
          onComplete?.();
          onStatementReady?.(data);
          return;
        }
        const parsingStartedAt = Date.now();
        const parsingEntry = {
          ...entry,
          status: "parsing" as const,
          statement: data,
          uploadProgress: 100,
          parseProgress: 12,
          currentPage: 1,
          totalPages,
          currentRow: 0,
          parsingStartedAt,
        };
        updateEntry(entry.file, parsingEntry);
        toast.success(`${entry.file.name} diunggah — parsing dimulai`);
        void pollParsing(parsingEntry, data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Upload gagal";
        updateEntry(entry.file, { status: "error", error: msg });
        toast.error(msg);
      }
    },
    [pollParsing, updateEntry, companyId, documentType, onComplete, onStatementReady]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newEntries: FileEntry[] = accepted.map((file) => ({
        file,
        status: "pending",
        uploadProgress: 0,
        parseProgress: 0,
        currentPage: 0,
        totalPages: 1,
        currentRow: 0,
        startedAt: Date.now(),
      }));
      setEntries((prev) => [...prev, ...newEntries]);
      newEntries.forEach(uploadFile);
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  const remove = (file: File) => setEntries((p) => p.filter((e) => e.file !== file));

  return (
    <div className="space-y-3">
      {/* Drop target */}
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed py-10 px-6 text-center transition-all duration-200",
          isDragActive
            ? "border-teal-400 bg-teal-50 shadow-md"
            : "border-slate-200 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/50 hover:shadow-sm"
        )}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-teal-50 ring-1 ring-teal-200 shadow-sm">
          <Upload className="h-6 w-6 text-teal-600" />
        </div>
        <p className="text-base font-semibold text-slate-800">
          {isDragActive ? "Lepas file di sini…" : "Drag & drop atau klik untuk pilih"}
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          PDF · CSV · XLSX · maks 50 MB per file · multiple upload
        </p>
      </div>

      {/* File entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const stmt = entry.statement;
            const progress =
              entry.status === "uploading" ? entry.uploadProgress : entry.parseProgress;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">{entry.file.name}</p>
                    {entry.status === "uploading" && (
                      <span className="text-[11px] text-teal-600 font-semibold">{entry.uploadProgress}%</span>
                    )}
                    {entry.status === "parsing" && (
                      <span className="text-[11px] text-indigo-600 font-semibold">{entry.parseProgress}%</span>
                    )}
                  </div>
                  {stmt && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {stmt.bank_name || stmt.bank_code || "—"} ·{" "}
                      {formatDate(stmt.period_start)} – {formatDate(stmt.period_end)}
                    </p>
                  )}
                  {(entry.status === "uploading" || entry.status === "parsing" || entry.status === "done") && (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", barColor[entry.status])}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                        {entry.status === "uploading" && (
                          <>
                            <span>Mengunggah</span>
                            <span>ETA {formatEta(entry.etaSeconds)}</span>
                          </>
                        )}
                        {entry.status === "parsing" && (
                          <>
                            <span>Parsing hal. {entry.currentPage}/{entry.totalPages}</span>
                            <span>±{entry.currentRow} row</span>
                            <span>ETA {formatEta(entry.etaSeconds)}</span>
                          </>
                        )}
                        {entry.status === "done" && (
                          <>
                            <span className="text-emerald-500">Selesai</span>
                            <span>{entry.finalRows ?? entry.currentRow} row</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {entry.error && <p className="text-[11px] text-red-400 mt-1">{entry.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {statusIcon[entry.status]}
                  {stmt && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stmtStatusCls[stmt.status]}`}>
                      {stmt.status === "done" ? "Done" : stmt.status === "needs_review" ? "Review" : stmt.status === "parsing" ? "Parsing" : stmt.status === "failed" ? "Failed" : "Queued"}
                    </span>
                  )}
                  {stmt && (
                    <Link
                      href={`/statements/${stmt.id}`}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
                    >
                      Lihat
                    </Link>
                  )}
                  <button
                    onClick={() => remove(entry.file)}
                    className="text-slate-300 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
