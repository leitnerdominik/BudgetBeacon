import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../../api/transactionsApi";

export const useTransactions = (page: number, pageSize: number) => {
  return useQuery({
    // The query key uniquely identifies this data in the cache.
    // Including page and pageSize ensures separate caches for different pages.
    queryKey: ["transactions", page, pageSize],
    queryFn: () => getTransactions(page, pageSize),
    // Optional: Keep previous data on screen while fetching the next page
    placeholderData: (previousData) => previousData,
  });
};
