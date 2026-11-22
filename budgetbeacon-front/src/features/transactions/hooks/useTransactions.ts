import { useQuery } from "@tanstack/react-query";
import {
  getTransactions,
  type TransactionQueryRequest,
} from "../../../api/transactionsApi";

export const transactionsListQueryKey = (
  page: number, pageSize: number, query: TransactionQueryRequest,
) => ["transactions", "list", query, page, pageSize] as const;

export const useTransactions = (
  page: number,
  pageSize: number,
  query: TransactionQueryRequest,
  enabled = true,
) => {
  return useQuery({
    // The query key uniquely identifies this data in the cache.
    // Including query state ensures separate caches for filtered/sorted pages.
    queryKey: transactionsListQueryKey(page, pageSize, query),
    queryFn: () => getTransactions(page, pageSize, query),
    enabled,
    // Optional: Keep previous data on screen while fetching the next page
    placeholderData: (previousData) => previousData,
  });
};
