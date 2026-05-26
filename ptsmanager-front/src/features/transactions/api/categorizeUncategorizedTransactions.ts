import { apiClient } from "../../../lib/api-client";

export interface CategorizeUncategorizedTransactionsResponse {
  message: string;
  processedCount: number;
  categorizedCount: number;
}

export const categorizeUncategorizedTransactions =
  async (): Promise<CategorizeUncategorizedTransactionsResponse> => {
    return apiClient.post<
      CategorizeUncategorizedTransactionsResponse,
      CategorizeUncategorizedTransactionsResponse
    >("/transactions/ai/categorize", {});
  };
