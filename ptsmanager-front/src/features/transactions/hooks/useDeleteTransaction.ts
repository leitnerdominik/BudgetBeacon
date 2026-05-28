import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useNotification } from "../../../components/NotificationProvider";
import { deleteTransaction } from "../api/getTransactions";

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: "Transaction deleted.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Transaction could not be deleted.",
      });
    },
  });
};
