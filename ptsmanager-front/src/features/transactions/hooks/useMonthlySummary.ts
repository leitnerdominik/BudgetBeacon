import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "../api/getMonthlySummary";

export const useMonthlySummary = (year: number, month: number) => {
  return useQuery({
    queryKey: ["transactions", "summary", year, month],
    queryFn: () => getMonthlySummary(year, month),
  });
};
