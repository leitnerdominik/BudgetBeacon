import { defaultTransactionQuery } from "../../api/transactionsApi";
import type { MonthlySummaryWithPeriod } from "../../types/api";
import { useMonthlySummary } from "../transactions/hooks/useMonthlySummary";
import { useTransactions } from "../transactions/hooks/useTransactions";

type MonthReference = {
  year: number;
  month: number;
};

type DashboardMonthlyOverview = {
  data: MonthlySummaryWithPeriod | undefined;
  period: MonthReference;
  isFallback: boolean;
  isError: boolean;
  isLoading: boolean;
  retry: () => void;
};

const padDatePart = (value: number) => String(value).padStart(2, "0");

const getMonthEndDate = ({ year, month }: MonthReference) => {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${padDatePart(month)}-${padDatePart(lastDay)}`;
};

const getMonthReference = (date: string): MonthReference | null => {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

const isEarlierMonth = (
  candidate: MonthReference,
  reference: MonthReference,
) =>
  candidate.year < reference.year ||
  (candidate.year === reference.year && candidate.month < reference.month);

export const useDashboardMonthlyOverview = (
  referenceDate = new Date(),
): DashboardMonthlyOverview => {
  const currentPeriod = {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth() + 1,
  };
  const currentSummary = useMonthlySummary(
    currentPeriod.year,
    currentPeriod.month,
  );
  const shouldFindFallback =
    currentSummary.isSuccess && currentSummary.data.transactionCount === 0;
  const latestHistoricalTransaction = useTransactions(
    1,
    1,
    {
      ...defaultTransactionQuery,
      endDate: getMonthEndDate(currentPeriod),
    },
    shouldFindFallback,
  );
  const latestTransaction = latestHistoricalTransaction.data?.data[0];
  const fallbackCandidate = latestTransaction
    ? getMonthReference(latestTransaction.date)
    : null;
  const fallbackPeriod =
    shouldFindFallback &&
    fallbackCandidate &&
    isEarlierMonth(fallbackCandidate, currentPeriod)
      ? fallbackCandidate
      : null;
  const fallbackSummary = useMonthlySummary(
    fallbackPeriod?.year ?? currentPeriod.year,
    fallbackPeriod?.month ?? currentPeriod.month,
    fallbackPeriod !== null,
  );
  const isFallback = fallbackPeriod !== null;
  const data = isFallback ? fallbackSummary.data : currentSummary.data;
  const period = data
    ? { year: data.year, month: data.month }
    : (fallbackPeriod ?? currentPeriod);
  const isLoading =
    currentSummary.isLoading ||
    (shouldFindFallback && latestHistoricalTransaction.isLoading) ||
    (isFallback && fallbackSummary.isLoading);
  const isError =
    currentSummary.isError ||
    (shouldFindFallback && latestHistoricalTransaction.isError) ||
    (isFallback && fallbackSummary.isError);

  const retry = () => {
    void currentSummary.refetch();

    if (shouldFindFallback) {
      void latestHistoricalTransaction.refetch();
    }

    if (isFallback) {
      void fallbackSummary.refetch();
    }
  };

  return {
    data,
    period,
    isFallback,
    isError,
    isLoading,
    retry,
  };
};
