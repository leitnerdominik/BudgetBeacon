import { apiClient } from "./httpClient";
import type {
  CategoryExpenseSummary,
  MonthlySummary,
  MonthlySummaryWithPeriod,
  PaginatedTransactions,
  RecurringExpenseCandidate,
  TopExpense,
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

export interface CreateTransactionRequest {
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string | null;
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

export const updateTransactionCategory = async (
  transactionId: string,
  category: string,
): Promise<Transaction> => {
  const response = await apiClient.patch<
    TransactionApiResponse,
    TransactionApiResponse
  >(`/transactions/${transactionId}/category`, { category });

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

export const getMonthlySummaries = async (
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): Promise<MonthlySummaryWithPeriod[]> => {
  return apiClient.get<MonthlySummaryWithPeriod[], MonthlySummaryWithPeriod[]>(
    "/transactions/summaries",
    {
      params: {
        startYear,
        startMonth,
        endYear,
        endMonth,
      },
    },
  );
};

export const getMonthlyCategorySummary = async (
  year: number,
  month: number,
): Promise<CategoryExpenseSummary[]> => {
  return apiClient.get<CategoryExpenseSummary[], CategoryExpenseSummary[]>(
    "/transactions/category-summary",
    {
      params: {
        year,
        month,
      },
    },
  );
};

export const getMonthlyTopExpenses = async (
  year: number,
  month: number,
  limit = 5,
): Promise<TopExpense[]> => {
  return apiClient.get<TopExpense[], TopExpense[]>("/transactions/top-expenses", {
    params: {
      year,
      month,
      limit,
    },
  });
};

export const getRecurringExpenseCandidates = async (
  endYear: number,
  endMonth: number,
  monthsBack = 6,
  limit = 10,
): Promise<RecurringExpenseCandidate[]> => {
  return apiClient.get<
    RecurringExpenseCandidate[],
    RecurringExpenseCandidate[]
  >("/transactions/recurring-expenses", {
    params: {
      endYear,
      endMonth,
      monthsBack,
      limit,
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

export const uploadCsv = async (
  file: File,
  delimiter = "auto",
): Promise<CsvUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("delimiter", delimiter);

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
