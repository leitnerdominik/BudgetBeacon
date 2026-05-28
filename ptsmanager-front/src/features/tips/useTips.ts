import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getRegionalTips } from "../../api/tipsApi";
import { useNotification } from "../../components/NotificationProvider";

type UseTipsOptions = {
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
};

export const useTips = (options?: UseTipsOptions) => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const hasShownSuccessRef = useRef(false);
  const lastErrorMessageRef = useRef<string | null>(null);
  const shouldShowSuccessNotification =
    options?.showSuccessNotification ?? location.pathname === "/tips";
  const shouldShowErrorNotification = options?.showErrorNotification ?? false;

  const query = useQuery({
    queryKey: ["tips"],
    queryFn: getRegionalTips,
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
