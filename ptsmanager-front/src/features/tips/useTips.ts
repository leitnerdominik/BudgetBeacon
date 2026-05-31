import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getRegionalTips } from "../../api/tipsApi";
import { useNotification } from "../../components/NotificationProvider";
import type { RegionalTip } from "../../types/api";
import {
  DEFAULT_TIPS_TIMEFRAME,
  type TipsTimeframeValue,
} from "./tipsTimeframes";

type UseTipsOptions = {
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  timeframe?: TipsTimeframeValue;
};

type DailyTipsCache = {
  dateKey: string;
  storedAt: number;
  tips: RegionalTip[];
};

const getLocalDateKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

const getMillisecondsUntilTomorrow = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);

  return tomorrow.getTime() - now.getTime();
};

const getTipsCacheKey = (timeframe: TipsTimeframeValue) =>
  `tips.daily.${timeframe}.v1`;

const readDailyTipsCache = (timeframe: TipsTimeframeValue) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getTipsCacheKey(timeframe));
    if (!rawValue) {
      return null;
    }

    const cache = JSON.parse(rawValue) as Partial<DailyTipsCache>;
    if (
      cache.dateKey !== getLocalDateKey() ||
      !Array.isArray(cache.tips) ||
      typeof cache.storedAt !== "number"
    ) {
      return null;
    }

    return cache as DailyTipsCache;
  } catch {
    return null;
  }
};

const writeDailyTipsCache = (
  timeframe: TipsTimeframeValue,
  tips: RegionalTip[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const cache: DailyTipsCache = {
    dateKey: getLocalDateKey(),
    storedAt: Date.now(),
    tips,
  };

  try {
    window.localStorage.setItem(getTipsCacheKey(timeframe), JSON.stringify(cache));
  } catch {
    // Cache persistence is best-effort; tips should still render if storage fails.
  }
};

export const useTips = (options?: UseTipsOptions) => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const hasShownSuccessRef = useRef(false);
  const lastErrorMessageRef = useRef<string | null>(null);
  const forceRefreshRef = useRef(false);
  const timeframe = options?.timeframe ?? DEFAULT_TIPS_TIMEFRAME;
  const shouldShowSuccessNotification =
    options?.showSuccessNotification ?? location.pathname === "/tips";
  const shouldShowErrorNotification = options?.showErrorNotification ?? false;

  const query = useQuery({
    queryKey: ["tips", timeframe],
    queryFn: async () => {
      const cachedTips = readDailyTipsCache(timeframe);
      if (cachedTips && !forceRefreshRef.current) {
        return cachedTips.tips;
      }

      const tips = await getRegionalTips(timeframe);
      writeDailyTipsCache(timeframe, tips);

      return tips;
    },
    initialData: () => readDailyTipsCache(timeframe)?.tips,
    initialDataUpdatedAt: () => readDailyTipsCache(timeframe)?.storedAt,
    staleTime: getMillisecondsUntilTomorrow(),
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const refreshTips = async () => {
    forceRefreshRef.current = true;

    try {
      return await query.refetch();
    } finally {
      forceRefreshRef.current = false;
    }
  };

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
