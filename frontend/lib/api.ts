import axios, { AxiosProgressEvent } from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Auth interceptor — aktif saat backend real dipakai
if (process.env.NEXT_PUBLIC_API_URL) {
  api.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

export type StatementStatus = "queued" | "parsing" | "done" | "needs_review" | "failed";
export type DocumentType = "bank_statement" | "profit_loss" | "cash_flow" | "balance_sheet" | "other" | "nib" | "ahu" | "akta";

export interface Statement {
  id: string;
  company_id: string | null;
  document_type: DocumentType;
  original_filename: string;
  bank_code: string | null;
  bank_name: string | null;
  account_no_masked: string | null;
  account_holder: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  status: StatementStatus;
  is_reconciled: boolean;
  reconciliation_delta: number | null;
  is_scanned: boolean;
  detection_confidence: number | null;
  statement_confidence?: number | null;
  low_confidence_count?: number;
  anomaly_count?: number;
  page_count?: number | null;
  parse_meta?: Record<string, unknown> | null;
  parse_error: string | null;
  created_at: string;
  parsed_at: string | null;
}

export interface Company {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySummary {
  company: Company;
  document_count: number;
  successful_uploads: number;
  failed_uploads: number;
  bank_statement_count: number;
  profit_loss_count: number;
  cash_flow_count: number;
  balance_sheet_count: number;
  other_document_count: number;
  total_transactions: number;
  total_credit: number;
  total_debit: number;
  latest_status: string | null;
}

export interface Transaction {
  id: string;
  row: number;
  date: string;
  value_date: string | null;
  description_raw: string;
  description_normalized: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  category: string | null;
  flags: string[] | null;
  confidence: number | null;
  source: string | null;
  is_low_confidence: boolean;
  is_manually_corrected: boolean;
  raw_meta?: Record<string, unknown> | null;
}

export interface RiskResult {
  id: string;
  statement_id: string;
  total_credit: number | null;
  total_debit: number | null;
  net_flow: number | null;
  avg_daily_balance: number | null;
  min_balance: number | null;
  max_balance: number | null;
  days_below_threshold: number | null;
  negative_balance_days: number | null;
  transaction_count: number | null;
  estimated_monthly_income: number | null;
  estimated_monthly_obligations: number | null;
  dsr: number | null;
  flags: Record<string, FlagDetail> | null;
  flag_count: number;
  has_judol: boolean;
  has_pinjol: boolean;
  has_passthrough: boolean;
  risk_score: number | null;
  category_summary: Record<string, string> | null;
  created_at: string;
}

export interface FlagDetail {
  flag_type: string;
  severity: "high" | "medium" | "low";
  count: number;
  total_amount: number | null;
  supporting_rows: number[];
  description: string;
  confidence: number;
}

export const statementsApi = {
  upload: (file: File, options?: { companyId?: string; documentType?: DocumentType; onUploadProgress?: (event: AxiosProgressEvent) => void }) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.companyId) form.append("company_id", options.companyId);
    if (options?.documentType) form.append("document_type", options.documentType);
    return api.post<Statement>("/statements/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: options?.onUploadProgress,
    });
  },
  get: (id: string) => api.get<Statement>(`/statements/${id}`),
  list: () => api.get<Statement[]>("/statements"),
  transactions: (id: string, params?: { skip?: number; limit?: number; flag?: string }) =>
    api.get<Transaction[]>(`/statements/${id}/transactions`, { params }),
  allTransactions: async (id: string, params?: { flag?: string }) => {
    const pageSize = 1000;
    const all: Transaction[] = [];
    let skip = 0;

    while (true) {
      const { data } = await api.get<Transaction[]>(`/statements/${id}/transactions`, {
        params: { ...params, skip, limit: pageSize },
      });
      all.push(...data);
      if (data.length < pageSize) break;
      skip += pageSize;
    }

    return all;
  },
  patchTransaction: (id: string, row: number, data: Partial<Transaction>) =>
    api.patch<Transaction>(`/statements/${id}/transactions/${row}`, data),
  risk: (id: string) => api.get<RiskResult>(`/statements/${id}/risk`),
  reparse: (id: string) => api.post<Statement>(`/statements/${id}/reparse`),
  delete: (id: string) => api.delete(`/statements/${id}`),
  reconcile: (id: string) => api.patch<Statement>(`/statements/${id}`, { is_reconciled: true }),
  assignCompany: (id: string, companyId: string | null) =>
    api.patch<Statement>(`/statements/${id}/assign`, { company_id: companyId }),
  exportUrl: (id: string, format: "xlsx" | "json") =>
    `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/statements/${id}/export?format=${format}`,
};

export const companiesApi = {
  create: (data: { name: string; notes?: string }) => api.post<Company>("/companies", data),
  list: () => api.get<CompanySummary[]>("/companies"),
  get: (id: string) => api.get<CompanySummary>(`/companies/${id}`),
  statements: (id: string) => api.get<Statement[]>(`/companies/${id}/statements`),
};

export interface SlikFasilitas {
  kreditur: string;
  jenis_kredit: string;
  plafon: number | null;
  baki_debet: number | null;
  tanggal_mulai: string;
  tanggal_jatuh_tempo: string;
  bunga: string;
  kualitas: string;
  kualitas_history: string[];
  agunan: string;
  nilai_agunan: number | null;
  penjamin: string;
}

export interface SlikReport {
  id: string;
  company_id: string | null;
  original_filename: string;
  nomor_laporan: string | null;
  tanggal_laporan: string | null;
  pemohon: string | null;
  nama_debitur: string | null;
  no_identitas: string | null;
  npwp: string | null;
  tanggal_lahir: string | null;
  jumlah_kreditur: number | null;
  jumlah_fasilitas: number | null;
  raw_pages: number | null;
  parse_error: string | null;
  parsed_data: {
    nomor_laporan: string;
    tanggal_laporan: string;
    pemohon: string;
    debitur: {
      nama: string;
      no_identitas: string;
      npwp: string;
      tempat_lahir: string;
      tanggal_lahir: string;
      alamat: string;
      jenis_debitur: string;
    };
    total_plafon: number | null;
    total_baki_debet: number | null;
    jumlah_kreditur: number;
    jumlah_fasilitas: number;
    fasilitas: SlikFasilitas[];
  } | null;
  created_at: string;
}

export interface CbiFasilitas {
  kreditur: string;
  jenis_fasilitas: string;
  plafon: number | null;
  baki_debet: number | null;
  tunggakan: number | null;
  dpd: number | null;
  kolektabilitas: string;
  tanggal_mulai: string;
  tanggal_jatuh_tempo: string;
  suku_bunga: string;
  kolektabilitas_history: string[];
  status: "aktif" | "selesai";
}

export interface CbiDebitur {
  nama: string;
  jenis_badan_usaha: string;
  npwp: string;
  alamat: string;
  kota: string;
  provinsi: string;
}

export interface CbiReport {
  id: string;
  company_id: string | null;
  original_filename: string;
  tanggal_laporan: string | null;
  npwp_query: string | null;
  nama_debitur: string | null;
  npwp: string | null;
  jenis_badan_usaha: string | null;
  jumlah_kreditur_aktif: number | null;
  jumlah_fasilitas_aktif: number | null;
  jumlah_kreditur_selesai: number | null;
  jumlah_fasilitas_selesai: number | null;
  raw_pages: number | null;
  parse_error: string | null;
  parsed_data: {
    tanggal_laporan: string;
    npwp_query: string;
    debitur: CbiDebitur;
    total_plafon_aktif: number | null;
    total_baki_debet_aktif: number | null;
    jumlah_kreditur_aktif: number;
    jumlah_fasilitas_aktif: number;
    jumlah_kreditur_selesai: number;
    jumlah_fasilitas_selesai: number;
    fasilitas_aktif: CbiFasilitas[];
    fasilitas_selesai: CbiFasilitas[];
  } | null;
  created_at: string;
}

export interface ClickFasilitas {
  kreditur: string;
  jenis_kredit: string;
  plafon: number | null;
  baki_debet: number | null;
  bunga: string;
  tanggal_mulai: string;
  tanggal_jatuh_tempo: string;
  kualitas: string;
  status: "aktif" | "selesai";
}

export interface ClickReport {
  id: string;
  company_id: string | null;
  original_filename: string;
  tanggal_laporan: string | null;
  nama_debitur: string | null;
  no_identitas: string | null;
  cb_score: number | null;
  risk_grade: string | null;
  jumlah_kontrak: number | null;
  jumlah_kreditur: number | null;
  raw_pages: number | null;
  parse_error: string | null;
  parsed_data: {
    tanggal_laporan: string;
    subject: {
      nama: string;
      no_identitas: string;
      jenis_kelamin: string;
      tanggal_lahir: string;
      tempat_lahir: string;
    };
    cb_score: number | null;
    risk_grade: string;
    jumlah_kontrak: number;
    jumlah_kreditur: number;
    total_credit_limit: number | null;
    total_debit_balance: number | null;
    total_overdue: number | null;
    fasilitas_aktif: ClickFasilitas[];
    fasilitas_selesai: ClickFasilitas[];
    raw_pages: number;
  } | null;
  created_at: string;
}

export const clickApi = {
  upload: (file: File, companyId?: string, onUploadProgress?: (event: AxiosProgressEvent) => void) => {
    const form = new FormData();
    form.append("file", file);
    if (companyId) form.append("company_id", companyId);
    return api.post<ClickReport>("/click/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  list: (companyId?: string) =>
    api.get<ClickReport[]>("/click/", { params: companyId ? { company_id: companyId } : {} }),
  get: (id: string) => api.get<ClickReport>(`/click/${id}`),
  assignCompany: (id: string, companyId: string | null) =>
    api.patch<ClickReport>(`/click/${id}/company`, { company_id: companyId }),
  delete: (id: string) => api.delete(`/click/${id}`),
};

export const cbiApi = {
  upload: (file: File, companyId?: string, onUploadProgress?: (event: AxiosProgressEvent) => void) => {
    const form = new FormData();
    form.append("file", file);
    if (companyId) form.append("company_id", companyId);
    return api.post<CbiReport>("/cbi/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  list: (companyId?: string) =>
    api.get<CbiReport[]>("/cbi/", { params: companyId ? { company_id: companyId } : {} }),
  get: (id: string) => api.get<CbiReport>(`/cbi/${id}`),
  assignCompany: (id: string, companyId: string | null) =>
    api.patch<CbiReport>(`/cbi/${id}/company`, { company_id: companyId }),
  delete: (id: string) => api.delete(`/cbi/${id}`),
};

export const slikApi = {
  upload: (file: File, companyId?: string, onUploadProgress?: (event: AxiosProgressEvent) => void) => {
    const form = new FormData();
    form.append("file", file);
    if (companyId) form.append("company_id", companyId);
    return api.post<SlikReport>("/slik/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  list: (companyId?: string) =>
    api.get<SlikReport[]>("/slik/", { params: companyId ? { company_id: companyId } : {} }),
  get: (id: string) => api.get<SlikReport>(`/slik/${id}`),
  assignCompany: (id: string, companyId: string | null) =>
    api.patch<SlikReport>(`/slik/${id}/company`, { company_id: companyId }),
  delete: (id: string) => api.delete(`/slik/${id}`),
};
