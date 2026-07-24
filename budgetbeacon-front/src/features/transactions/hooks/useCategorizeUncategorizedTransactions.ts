import { useMutation, useQueryClient } from "@tanstack/react-query";
import { categorizeUncategorizedTransactions } from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";
import { clearTipsQueryCache } from "../../tips/tipsCache";

export const useCategorizeUncategorizedTransactions = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: categorizeUncategorizedTransactions,
    onSuccess: (data) => {
      if (data.changedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        clearTipsQueryCache(queryClient);
      }

      showNotification({
        severity:
          data.failedCount > 0
            ? "warning"
            : data.changedCount > 0
              ? "success"
              : "info",
        message:
          data.failedCount > 0
            ? `${data.changedCount} transaction(s) categorized; ${data.failedCount} could not be categorized.`
            : data.changedCount > 0
              ? `${data.changedCount} uncategorized transaction(s) categorized.`
            : "All transactions are already categorized.",
      });
    },
    onError: (error) => {
      console.error("Failed to categorize transactions:", error);
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to categorize transactions.",
      });
    },
  });
};
