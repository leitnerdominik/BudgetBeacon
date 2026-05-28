import { apiClient } from "./httpClient";
import type {
  MonthlySummary,
  PaginatedTransactions,
} from "../types/api";

interface TransactionsApiResponse {
  data: Array<{
    id: string;
    date: string;
    amount: number;
    category: string;
    metadata?: {
      rawDescription?: string;
    };
  }>;
  totalCount: number;
}

export interface CategorizeUncategorizedTransactionsResponse {
  message: string;
  processedCount: number;
  categorizedCount: number;
}

export interface CsvUploadResponse {
  message: string;
  totalParsed: number;
  imported: number;
  duplicatesSkipped: number;
}

export const getTransactions = async (
  page: number,
  pageSize: number,
): Promise<PaginatedTransactions> => {
  const response = await apiClient.get<
    TransactionsApiResponse,
    TransactionsApiResponse
  >("/transactions", {
    params: {
      page,
      pageSize,
    },
  });

  return {
    totalCount: response.totalCount,
    data: response.data.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      amount: transaction.amount,
      category: transaction.category,
      description:
        transaction.metadata?.rawDescription?.trim() || "No description",
    })),
  };
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

export const categorizeUncategorizedTransactions =
  async (): Promise<CategorizeUncategorizedTransactionsResponse> => {
    return apiClient.post<
      CategorizeUncategorizedTransactionsResponse,
      CategorizeUncategorizedTransactionsResponse
    >("/transactions/ai/categorize", {});
  };

export const uploadCsv = async (file: File): Promise<CsvUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient.post<CsvUploadResponse, CsvUploadResponse>(
    "/transactions/import",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};
