import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createTransaction,
  type CreateTransactionRequest,
} from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (request: CreateTransactionRequest) => createTransaction(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: "Transaction created.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Transaction could not be created.",
      });
    },
  });
};
