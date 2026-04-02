import { apiClient } from "../../../lib/api-client";
import type { MonthlySummary } from "../types";

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
