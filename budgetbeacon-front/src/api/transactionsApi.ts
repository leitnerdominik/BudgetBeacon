import { apiClient } from "./httpClient";
import type {
  MonthlySummary,
  PaginatedTransactions,
  StatisticsOverview,
  Transaction,
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
  notes: transaction.notes?.trim() || null,
  aiConfidenceScore: transaction.metadata?.aiConfidenceScore ?? null,
  description:
    transaction.metadata?.rawDescription?.trim() || "No description",
});

export interface CategorizeUncategorizedTransactionsResponse {
  message: string;
  processedCount: number;
  categorizedCount: number;
}

export interface TransactionWriteRequest {
  date: string;
  amount: number;
  description: string;
  category: string;
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
): Promise<MonthlySummary> => {
  return apiClient.get<MonthlySummary, MonthlySummary>("/transactions/summary", {
    params: {
      year,
      month,
    },
  });
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

export const categorizeUncategorizedTransactions =
  async (): Promise<CategorizeUncategorizedTransactionsResponse> => {
    return apiClient.post<
      CategorizeUncategorizedTransactionsResponse,
      CategorizeUncategorizedTransactionsResponse
    >("/transactions/ai/categorize", {});
  };

export const uploadTransactions = async (
  file: File,
  delimiter = "auto",
  mapping?: TransactionImportMappingRequest,
): Promise<TransactionImportResponse> => {
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
