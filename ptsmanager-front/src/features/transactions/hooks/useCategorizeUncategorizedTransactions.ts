import { useMutation, useQueryClient } from "@tanstack/react-query";
import { categorizeUncategorizedTransactions } from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";

export const useCategorizeUncategorizedTransactions = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: categorizeUncategorizedTransactions,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });

      showNotification({
        severity: data.categorizedCount > 0 ? "success" : "info",
        message:
          data.categorizedCount > 0
            ? `${data.categorizedCount} uncategorized transaction(s) categorized.`
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
