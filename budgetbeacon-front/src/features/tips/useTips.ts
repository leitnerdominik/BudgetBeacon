import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getRegionalTips } from "../../api/tipsApi";
import { useNotification } from "../../components/NotificationProvider";
import { useAuth } from "../../hooks/useAuth";
import { tipsQueryKeys } from "./tipsCache";
import { DEFAULT_TIPS_TIMEFRAME, type TipsTimeframeValue } from "./tipsTimeframes";

type UseTipsOptions = {
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  timeframe?: TipsTimeframeValue;
};

const getMillisecondsUntilTomorrow = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);

  return tomorrow.getTime() - now.getTime();
};

export const useTips = (options?: UseTipsOptions) => {
  const location = useLocation();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const hasShownSuccessRef = useRef(false);
  const lastErrorMessageRef = useRef<string | null>(null);
  const userId = user?.id;
  const timeframe = options?.timeframe ?? DEFAULT_TIPS_TIMEFRAME;
  const shouldShowSuccessNotification =
    options?.showSuccessNotification ?? location.pathname === "/tips";
  const shouldShowErrorNotification = options?.showErrorNotification ?? false;

  const query = useQuery({
    queryKey: tipsQueryKeys.byUserAndTimeframe(userId, timeframe),
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      return getRegionalTips(timeframe);
    },
    enabled: !!userId,
    staleTime: getMillisecondsUntilTomorrow(),
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const refreshTips = () => query.refetch();

  useEffect(() => {
    if (
      shouldShowSuccessNotification &&
      query.isSuccess &&
      query.data.length > 0 &&
      !hasShownSuccessRef.current
    ) {
      hasShownSuccessRef.current = true;
      showNotification({
        severity: "success",
        message: `${query.data.length} AI tip(s) loaded successfully.`,
      });
    }
  }, [query.data, query.isSuccess, shouldShowSuccessNotification, showNotification]);

  useEffect(() => {
    if (!shouldShowErrorNotification) {
      return;
    }

    if (!query.isError) {
      lastErrorMessageRef.current = null;
      return;
    }

    const message =
      query.error instanceof Error
        ? query.error.message
        : "Could not load AI tips.";

    if (lastErrorMessageRef.current === message) {
      return;
    }

    lastErrorMessageRef.current = message;
    showNotification({
      severity: "error",
      message,
    });
  }, [query.error, query.isError, shouldShowErrorNotification, showNotification]);

  return {
    ...query,
    refreshTips,
  };
};
