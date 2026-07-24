import type { QueryClient } from "@tanstack/react-query";

import type { TipsTimeframeValue } from "./tipsTimeframes";

const legacyTipsStoragePrefix = "tips.daily.";

export const tipsQueryKeys = {
  all: ["tips"] as const,
  byUserAndTimeframe: (
    userId: string | undefined,
    timeframe: TipsTimeframeValue,
  ) => [...tipsQueryKeys.all, userId, timeframe] as const,
};

export const clearTipsQueryCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: tipsQueryKeys.all });
};

export const clearLegacyPersistentTipsCache = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);

      if (key?.startsWith(legacyTipsStoragePrefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Legacy cleanup is best-effort; unavailable storage must not block auth flows.
  }
};
