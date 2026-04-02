import { apiClient } from "../../../lib/api-client";
import type { RegionalTip } from "../types";

interface TipsApiResponse {
  timeframe: string;
  tips: RegionalTip[];
}

export const getRegionalTips = async (): Promise<RegionalTip[]> => {
  const response = await apiClient.get<TipsApiResponse, TipsApiResponse>(
    "/transactions/ai/tips",
  );

  return response.tips;
};
