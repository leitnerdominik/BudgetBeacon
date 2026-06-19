import { useQuery } from "@tanstack/react-query";

import { getStatistics, type StatisticsRequest } from "../../api/transactionsApi";

export type MonthReference = {
  month: number;
  year: number;
};

export const statisticsQueryKey = (request: StatisticsRequest) =>
  ["transactions", "statistics", request] as const;

export const useStatistics = (request: StatisticsRequest) =>
  useQuery({
    queryKey: statisticsQueryKey(request),
    queryFn: () => getStatistics(request),
  });
