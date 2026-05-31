import { useMutation, useQueryClient } from "@tanstack/react-query";

import { regenerateTransactionCategory } from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";

export const useRegenerateTransactionCategory = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (transactionId: string) =>
      regenerateTransactionCategory(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: "Transaction category regenerated.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Transaction category could not be regenerated.",
      });
    },
  });
};
