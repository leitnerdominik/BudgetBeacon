import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categorizeTransactionBatch,
  getCategorizationCandidates,
} from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";
import { clearTipsQueryCache } from "../../tips/tipsCache";
import {
  emptyCategorizationProgress,
  runTransactionCategorization,
  type CategorizationProgress,
} from "../categorizationRunner";

export const useCategorizeUncategorizedTransactions = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<CategorizationProgress>(
    emptyCategorizationProgress,
  );

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setProgress(emptyCategorizationProgress);

      try {
        return await runTransactionCategorization(
          {
            getCandidates: getCategorizationCandidates,
            categorizeBatch: categorizeTransactionBatch,
            onProgress: setProgress,
          },
          abortController.signal,
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    onSuccess: (data) => {
      if (data.changedCount > 0) {
        clearTipsQueryCache(queryClient);
      }

      showNotification({
        severity:
          data.outcome === "failed"
            ? "error"
            : data.outcome === "partial"
            ? "warning"
            : data.changedCount > 0
              ? "success"
              : "info",
        message: data.message,
      });
    },
    onError: (error) => {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "CanceledError")
      ) {
        return;
      }

      console.error("Failed to categorize transactions:", error);
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to categorize transactions.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const reset = () => {
    mutation.reset();
    setProgress(emptyCategorizationProgress);
  };

  return {
    ...mutation,
    progress,
    reset,
  };
};
