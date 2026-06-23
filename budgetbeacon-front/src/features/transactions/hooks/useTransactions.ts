import { useQuery } from "@tanstack/react-query";
import {
  getTransactions,
  type TransactionQueryRequest,
} from "../../../api/transactionsApi";

export const useTransactions = (
  page: number,
  pageSize: number,
  query: TransactionQueryRequest,
) => {
  return useQuery({
    // The query key uniquely identifies this data in the cache.
    // Including query state ensures separate caches for filtered/sorted pages.
    queryKey: ["transactions", "list", page, pageSize, query],
    queryFn: () => getTransactions(page, pageSize, query),
    // Optional: Keep previous data on screen while fetching the next page
    placeholderData: (previousData) => previousData,
  });
};
