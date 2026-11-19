import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  updateTransaction,
  type TransactionWriteRequest,
} from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";
import { clearTipsQueryCache } from "../../tips/tipsCache";
import { spendingFlexibilityRulesQueryKey } from "../../spendingFlexibility/useSpendingFlexibilityRules";
import { transactionDetailQueryKey } from "./useTransaction";

type UpdateTransactionInput = {
  transactionId: string;
  request: TransactionWriteRequest;
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: ({ transactionId, request }: UpdateTransactionInput) =>
      updateTransaction(transactionId, request),
    onSuccess: (transaction, { request }) => {
      queryClient.setQueryData(
        transactionDetailQueryKey(transaction.id),
        transaction,
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      if (request.spendingFlexibilityRule) {
        queryClient.invalidateQueries({ queryKey: spendingFlexibilityRulesQueryKey });
      }
      clearTipsQueryCache(queryClient);
      showNotification({
        severity: "success",
        message: "Transaction updated.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Transaction could not be updated.",
      });
    },
  });
};
