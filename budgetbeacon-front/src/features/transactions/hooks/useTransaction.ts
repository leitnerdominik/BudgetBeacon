import { useQuery } from "@tanstack/react-query";

import { getTransaction } from "../../../api/transactionsApi";

export const transactionDetailQueryKey = (transactionId: string) =>
  ["transactions", "detail", transactionId] as const;

export const useTransaction = (transactionId: string) => {
  return useQuery({
    queryKey: transactionDetailQueryKey(transactionId),
    queryFn: () => getTransaction(transactionId),
    enabled: transactionId.length > 0,
  });
};
