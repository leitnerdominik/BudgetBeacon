import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getRegionalTips } from "../../api/tipsApi";
import { useNotification } from "../../components/NotificationProvider";
import { useAuth } from "../../hooks/useAuth";
import { useLocalCalendarDate } from "../../hooks/useLocalCalendarDate";
import { tipsQueryKeys } from "./tipsCache";
import { DEFAULT_TIPS_TIMEFRAME, type TipsTimeframeValue } from "./tipsTimeframes";

type UseTipsOptions = {
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  timeframe?: TipsTimeframeValue;
};

export const useTips = (options?: UseTipsOptions) => {
  const location = useLocation();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const userId = user?.id;
  const timeframe = options?.timeframe ?? DEFAULT_TIPS_TIMEFRAME;
  const asOfDate = useLocalCalendarDate();
  const shouldShowSuccessNotification =
    options?.showSuccessNotification ?? location.pathname === "/tips";
  const shouldShowErrorNotification = options?.showErrorNotification ?? false;

  const query = useQuery({
    queryKey: tipsQueryKeys.byUserTimeframeAndDate(
      userId,
      timeframe,
      asOfDate,
    ),
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      return getRegionalTips(timeframe, asOfDate);
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const generateTips = async () => {
    const result = await query.refetch();

    if (
      shouldShowSuccessNotification &&
      result.isSuccess &&
      result.data.length > 0
    ) {
      showNotification({
        severity: "success",
        message: `${result.data.length} AI tip(s) generated successfully.`,
      });
    }

    if (shouldShowErrorNotification && result.isError) {
      const message =
        result.error instanceof Error
          ? result.error.message
          : "Could not generate AI tips.";

      showNotification({
        severity: "error",
        message,
      });
    }

    return result;
  };

  return {
    ...query,
    generateTips,
    asOfDate,
  };
};
