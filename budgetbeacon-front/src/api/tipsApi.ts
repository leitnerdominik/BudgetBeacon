import { apiClient } from "./httpClient";
import {
  getTipsTimeframeParams,
  type TipsTimeframeValue,
} from "../features/tips/tipsTimeframes";
import type { RegionalTip } from "../types/api";

interface TipsApiResponse {
  timeframe: string;
  tips: RegionalTip[];
}

export const getRegionalTips = async (
  timeframe: TipsTimeframeValue,
  asOfDate: string,
): Promise<RegionalTip[]> => {
  const response = await apiClient.get<TipsApiResponse, TipsApiResponse>(
    "/transactions/ai/tips",
    {
      params: getTipsTimeframeParams(timeframe, asOfDate),
    },
  );

  return response.tips;
};
