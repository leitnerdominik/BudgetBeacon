import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useNotification } from "../../../components/notifications/NotificationProvider";
import { getRegionalTips } from "../api/getTips";
import {
  DEFAULT_TIPS_TIMEFRAME,
  type TipsTimeframeValue,
} from "../tipsTimeframes";

type UseTipsOptions = {
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  timeframe?: TipsTimeframeValue;
};

export const useTips = (options?: UseTipsOptions) => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const hasShownSuccessRef = useRef(false);
  const lastErrorMessageRef = useRef<string | null>(null);
  const timeframe = options?.timeframe ?? DEFAULT_TIPS_TIMEFRAME;
  const shouldShowSuccessNotification =
    options?.showSuccessNotification ?? location.pathname === "/tips";
  const shouldShowErrorNotification = options?.showErrorNotification ?? false;

  const query = useQuery({
    queryKey: ["tips", timeframe],
    queryFn: () => getRegionalTips(timeframe),
    staleTime: 1000 * 60 * 30,
  });

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

  return query;
};
