import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useNotification } from "../../../components/NotificationProvider";
import { updateTransactionCategory } from "../api/getTransactions";

type UpdateTransactionCategoryInput = {
  transactionId: string;
  category: string;
};

export const useUpdateTransactionCategory = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: ({ transactionId, category }: UpdateTransactionCategoryInput) =>
      updateTransactionCategory(transactionId, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: "Transaction category updated.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Transaction category could not be updated.",
      });
    },
  });
};
