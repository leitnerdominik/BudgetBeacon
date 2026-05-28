import { apiClient } from "../../../lib/api-client";
import type { PaginatedTransactions } from "../types";

interface TransactionsApiResponse {
  data: TransactionApiResponse[];
  totalCount: number;
}

interface TransactionApiResponse {
    id: string;
    date: string;
    amount: number;
    category: string;
    metadata?: {
      rawDescription?: string;
      aiConfidenceScore?: number | null;
    };
}

const mapTransaction = (transaction: TransactionApiResponse) => ({
  id: transaction.id,
  date: transaction.date,
  amount: transaction.amount,
  category: transaction.category,
  aiConfidenceScore: transaction.metadata?.aiConfidenceScore ?? null,
  description:
    transaction.metadata?.rawDescription?.trim() || "No description",
});

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

export const updateTransactionCategory = async (
  transactionId: string,
  category: string,
) => {
  const response = await apiClient.patch<
    TransactionApiResponse,
    TransactionApiResponse
  >(`/transactions/${transactionId}/category`, { category });

  return mapTransaction(response);
};

export const deleteTransaction = async (transactionId: string) => {
  await apiClient.delete(`/transactions/${transactionId}`);
};
