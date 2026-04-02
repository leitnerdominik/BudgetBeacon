import { apiClient } from "../../../lib/api-client";
import type { PaginatedTransactions } from "../types";

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
