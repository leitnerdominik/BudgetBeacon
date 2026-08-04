import { ApiError, apiClient } from "./httpClient";
import type {
  MonthlySummaryWithPeriod,
  PaginatedTransactions,
  StatisticsOverview,
  Transaction,
  TransactionTreatment,
} from "../types/api";

interface TransactionsApiResponse {
  data: TransactionApiResponse[];
  totalCount: number;
}

interface TransactionApiResponse {
    id: string;
    date: string;
    amount: number;
    category: string;
    treatment?: TransactionTreatment | null;
    notes?: string | null;
    metadata?: {
      rawDescription?: string;
      aiConfidenceScore?: number | null;
    };
}

const mapTransaction = (transaction: TransactionApiResponse): Transaction => ({
  id: transaction.id,
  date: transaction.date,
  amount: transaction.amount,
  category: transaction.category,
  treatment: transaction.treatment ?? "Expense",
  notes: transaction.notes?.trim() || null,
  aiConfidenceScore: transaction.metadata?.aiConfidenceScore ?? null,
  description:
    transaction.metadata?.rawDescription?.trim() || "No description",
});

export interface CategorizationCandidatesResponse {
  transactionIds: string[];
}

export interface CategorizeTransactionsBatchResponse {
  message: string;
  requestedCount: number;
  processedCount: number;
  changedCount: number;
  failedCount: number;
  skippedCount: number;
  remainingCount: number;
  categorizedCount: number;
}

export class CategorizationBatchApiError extends Error {
  readonly batchResult: CategorizeTransactionsBatchResponse;

  constructor(message: string, batchResult: CategorizeTransactionsBatchResponse) {
    super(message);
    this.name = "CategorizationBatchApiError";
    this.batchResult = batchResult;
  }
}

export interface TransactionWriteRequest {
  date: string;
  amount: number;
  description: string;
  category: string;
  treatment: TransactionTreatment;
  notes: string | null;
}

export type CreateTransactionRequest = TransactionWriteRequest;

export interface TransactionImportResponse {
  message: string;
  totalParsed: number;
  imported: number;
  duplicatesSkipped: number;
  redactedTransactions: number;
}

export type TransactionImportPreviewStatus = "willImport" | "skipped";
export type TransactionImportDuplicateReason =
  | "existingDuplicate"
  | "fileDuplicate";

export interface TransactionImportPreviewItem {
  date: string;
  amount: number;
  description: string;
  descriptionRedacted: boolean;
  status: TransactionImportPreviewStatus;
  duplicateReason: TransactionImportDuplicateReason | null;
}

export interface TransactionImportPreviewResponse {
  totalParsed: number;
  importable: number;
  duplicatesSkipped: number;
  existingDuplicates: number;
  fileDuplicates: number;
  redactedTransactions: number;
  transactions: TransactionImportPreviewItem[];
}

export interface TransactionImportMappingRequest {
  hasHeaderRow: boolean;
  dateColumnIndex: number;
  amountColumnIndex: number;
  descriptionColumnIndex?: number;
}

export type TransactionTypeFilter = "all" | "income" | "expense";
export type TransactionSortField = "date" | "amount" | "category" | "description";
export type TransactionSortDirection = "asc" | "desc";

export interface TransactionQueryRequest {
  searchTerm: string;
  category: string;
  transactionType: TransactionTypeFilter;
  startDate: string;
  endDate: string;
  sortBy: TransactionSortField;
  sortDirection: TransactionSortDirection;
}

export const defaultTransactionQuery: TransactionQueryRequest = {
  searchTerm: "",
  category: "",
  transactionType: "all",
  startDate: "",
  endDate: "",
  sortBy: "date",
  sortDirection: "desc",
};

export const getTransactions = async (
  page: number,
  pageSize: number,
  query: TransactionQueryRequest,
): Promise<PaginatedTransactions> => {
  const response = await apiClient.get<
    TransactionsApiResponse,
    TransactionsApiResponse
  >("/transactions", {
    params: {
      page,
      pageSize,
      searchTerm: query.searchTerm.trim() || undefined,
      category: query.category || undefined,
      transactionType: query.transactionType,
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    },
  });

  return {
    totalCount: response.totalCount,
    data: response.data.map(mapTransaction),
  };
};

export const createTransaction = async (
  request: CreateTransactionRequest,
): Promise<Transaction> => {
  const response = await apiClient.post<
    TransactionApiResponse,
    TransactionApiResponse
  >("/transactions", request);

  return mapTransaction(response);
};

export const getTransaction = async (
  transactionId: string,
): Promise<Transaction> => {
  const response = await apiClient.get<
    TransactionApiResponse,
    TransactionApiResponse
  >(`/transactions/${transactionId}`);

  return mapTransaction(response);
};

export const updateTransaction = async (
  transactionId: string,
  request: TransactionWriteRequest,
): Promise<Transaction> => {
  const response = await apiClient.put<
    TransactionApiResponse,
    TransactionApiResponse
  >(`/transactions/${transactionId}`, request);

  return mapTransaction(response);
};

export const regenerateTransactionCategory = async (
  transactionId: string,
): Promise<Transaction> => {
  const response = await apiClient.post<
    TransactionApiResponse,
    TransactionApiResponse
  >(`/transactions/${transactionId}/ai/categorize`, {});

  return mapTransaction(response);
};

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  await apiClient.delete(`/transactions/${transactionId}`);
};

export const getMonthlySummary = async (
  year: number,
  month: number,
): Promise<MonthlySummaryWithPeriod> => {
  return apiClient.get<MonthlySummaryWithPeriod, MonthlySummaryWithPeriod>(
    "/transactions/summary",
    {
      params: {
        year,
        month,
      },
    },
  );
};

export type StatisticsRequest =
  | { allTime: true }
  | {
      allTime: false;
      endYear: number;
      endMonth: number;
      monthsBack: 1 | 3 | 6 | 12;
    };

export const getStatistics = async (
  request: StatisticsRequest,
): Promise<StatisticsOverview> => {
  return apiClient.get<StatisticsOverview, StatisticsOverview>(
    "/transactions/statistics",
    {
      params: request,
    },
  );
};

export const getCategorizationCandidates = async (
  signal?: AbortSignal,
): Promise<CategorizationCandidatesResponse> => {
  return apiClient.get<
    CategorizationCandidatesResponse,
    CategorizationCandidatesResponse
  >("/transactions/ai/categorization-candidates", { signal });
};

const parseCategorizationBatchFailure = (
  data: unknown,
): CategorizeTransactionsBatchResponse | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;
  const countKeys = [
    "requestedCount",
    "processedCount",
    "changedCount",
    "failedCount",
    "skippedCount",
    "remainingCount",
    "categorizedCount",
  ] as const;

  if (countKeys.some((key) => typeof value[key] !== "number")) {
    return null;
  }

  return {
    message:
      typeof value.message === "string"
        ? value.message
        : "The AI provider could not categorize this batch.",
    requestedCount: value.requestedCount as number,
    processedCount: value.processedCount as number,
    changedCount: value.changedCount as number,
    failedCount: value.failedCount as number,
    skippedCount: value.skippedCount as number,
    remainingCount: value.remainingCount as number,
    categorizedCount: value.categorizedCount as number,
  };
};

export const categorizeTransactionBatch = async (
  transactionIds: string[],
  signal?: AbortSignal,
): Promise<CategorizeTransactionsBatchResponse> => {
  try {
    return await apiClient.post<
      CategorizeTransactionsBatchResponse,
      CategorizeTransactionsBatchResponse
    >("/transactions/ai/categorize", { transactionIds }, { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 502) {
      const batchResult = parseCategorizationBatchFailure(error.data);
      if (batchResult) {
        throw new CategorizationBatchApiError(error.message, batchResult);
      }
    }

    throw error;
  }
};

export const uploadTransactions = async (
  file: File,
  delimiter = "auto",
  mapping?: TransactionImportMappingRequest,
): Promise<TransactionImportResponse> => {
  const formData = createTransactionImportFormData(file, delimiter, mapping);

  return apiClient.post<TransactionImportResponse, TransactionImportResponse>(
    "/transactions/import",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};

export const previewTransactionImport = async (
  file: File,
  delimiter = "auto",
  mapping?: TransactionImportMappingRequest,
): Promise<TransactionImportPreviewResponse> => {
  const formData = createTransactionImportFormData(file, delimiter, mapping);

  return apiClient.post<
    TransactionImportPreviewResponse,
    TransactionImportPreviewResponse
  >("/transactions/import/preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

const createTransactionImportFormData = (
  file: File,
  delimiter: string,
  mapping?: TransactionImportMappingRequest,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("delimiter", delimiter);

  if (mapping) {
    formData.append("hasHeaderRow", String(mapping.hasHeaderRow));
    formData.append("dateColumnIndex", String(mapping.dateColumnIndex));
    formData.append("amountColumnIndex", String(mapping.amountColumnIndex));

    if (mapping.descriptionColumnIndex !== undefined) {
      formData.append(
        "descriptionColumnIndex",
        String(mapping.descriptionColumnIndex),
      );
    }
  }

  return formData;
};
