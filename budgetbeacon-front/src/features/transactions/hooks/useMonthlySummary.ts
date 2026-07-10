import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "../../../api/transactionsApi";

export const useMonthlySummary = (
  year: number,
  month: number,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["transactions", "summary", year, month],
    queryFn: () => getMonthlySummary(year, month),
    enabled,
  });
};
