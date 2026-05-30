import { apiClient } from "../../../lib/api-client";
import {
  DEFAULT_TIPS_TIMEFRAME,
  getTipsTimeframeParams,
  type TipsTimeframeValue,
} from "../tipsTimeframes";
import type { RegionalTip } from "../types";

interface TipsApiResponse {
  timeframe: string;
  tips: RegionalTip[];
}

export const getRegionalTips = async (
  timeframe: TipsTimeframeValue = DEFAULT_TIPS_TIMEFRAME,
): Promise<RegionalTip[]> => {
  const response = await apiClient.get<TipsApiResponse, TipsApiResponse>(
    "/transactions/ai/tips",
    {
      params: getTipsTimeframeParams(timeframe),
    },
  );

  return response.tips;
};
