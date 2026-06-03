import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getMonthlyCategorySummary,
  getMonthlySummaries,
  getMonthlySummary,
  getMonthlyTopExpenses,
  getRecurringExpenseCandidates,
} from "../../api/transactionsApi";
import type { MonthlySummary, MonthlySummaryWithPeriod } from "../../types/api";

export type MonthReference = {
  month: number;
  year: number;
};

export type MonthlyTrendPoint = MonthReference & {
  summary: MonthlySummary | undefined;
};

export const monthlyStatisticsQueryKey = (year: number, month: number) =>
  ["transactions", "summary", year, month] as const;

export const monthlyTrendQueryKey = (
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
) =>
  [
    "transactions",
    "summary",
    "range",
    startYear,
    startMonth,
    endYear,
    endMonth,
  ] as const;

export const monthlyCategorySummaryQueryKey = (year: number, month: number) =>
  ["transactions", "category-summary", year, month] as const;

export const monthlyTopExpensesQueryKey = (
  year: number,
  month: number,
  limit: number,
) => ["transactions", "top-expenses", year, month, limit] as const;

export const recurringExpensesQueryKey = (
  year: number,
  month: number,
  monthsBack: number,
  limit: number,
) => ["transactions", "recurring-expenses", year, month, monthsBack, limit] as const;

export const useMonthlyStatistics = (year: number, month: number) => {
  return useQuery({
    queryKey: monthlyStatisticsQueryKey(year, month),
    queryFn: () => getMonthlySummary(year, month),
  });
};

export const useMonthlyCategorySummary = (year: number, month: number) => {
  return useQuery({
    queryKey: monthlyCategorySummaryQueryKey(year, month),
    queryFn: () => getMonthlyCategorySummary(year, month),
  });
};

export const useMonthlyTopExpenses = (
  year: number,
  month: number,
  limit = 5,
) => {
  return useQuery({
    queryKey: monthlyTopExpensesQueryKey(year, month, limit),
    queryFn: () => getMonthlyTopExpenses(year, month, limit),
  });
};

export const useRecurringExpenseCandidates = (
  year: number,
  month: number,
  monthsBack = 6,
  limit = 10,
) => {
  return useQuery({
    queryKey: recurringExpensesQueryKey(year, month, monthsBack, limit),
    queryFn: () =>
      getRecurringExpenseCandidates(year, month, monthsBack, limit),
  });
};

const shiftMonth = (
  { month, year }: MonthReference,
  offset: number,
): MonthReference => {
  const date = new Date(year, month - 1 + offset, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

const getMonthRangeEndingAt = (
  endMonth: MonthReference,
  monthCount: number,
) =>
  Array.from({ length: monthCount }, (_, index) =>
    shiftMonth(endMonth, index - monthCount + 1),
  );

export const useMonthlyTrend = (
  endMonth: MonthReference,
  monthCount = 6,
) => {
  const { month, year } = endMonth;
  const boundedMonthCount = Math.max(1, Math.min(monthCount, 24));
  const months = useMemo(
    () => getMonthRangeEndingAt({ month, year }, boundedMonthCount),
    [boundedMonthCount, month, year],
  );
  const startMonth = months[0];

  const query = useQuery({
    queryKey: monthlyTrendQueryKey(
      startMonth.year,
      startMonth.month,
      year,
      month,
    ),
    queryFn: () =>
      getMonthlySummaries(startMonth.year, startMonth.month, year, month),
  });
  const summariesByMonth = new Map(
    (query.data ?? []).map((summary) => [
      `${summary.year}-${summary.month}`,
      summary,
    ]),
  );
  const getSummaryForMonth = ({
    month,
    year,
  }: MonthReference): MonthlySummaryWithPeriod | undefined =>
    summariesByMonth.get(`${year}-${month}`);

  return {
    data: months.map<MonthlyTrendPoint>((month) => ({
      ...month,
      summary: getSummaryForMonth(month),
    })),
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    refetch: () => query.refetch().then(() => undefined),
  };
};
