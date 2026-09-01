import { useMemo } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  defaultTransactionQuery,
  type StatisticsRequest,
} from "../../api/transactionsApi";
import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import { buildTransactionListSearchParams } from "../transactions/transactionListUrlState";
import { DesktopStatisticsView } from "./DesktopStatisticsView";
import { StatisticsPeriodControls } from "./StatisticsPeriodControls";
import type { StatisticsMetric } from "./StatisticsMetricGrid";
import {
  buildStatisticsSearchParams,
  formatPeriodLabel,
  getCurrentMonthSelection,
  parseMonthInputValue,
  parseTimeframeValue,
  shiftMonth,
  type MonthReference,
  type StatisticsTimeframeValue,
} from "./statisticsPeriod";
import { useStatistics } from "./useStatistics";

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatSavingsRate = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

const toTransactionFilterDate = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

export const MonthlyOverview = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const timeframe = useMemo(
    () => parseTimeframeValue(searchParams.get("timeframe")),
    [searchParams],
  );
  const selectedMonth = useMemo(
    () =>
      parseMonthInputValue(searchParams.get("month") ?? "") ??
      getCurrentMonthSelection(),
    [searchParams],
  );
  const isAllTime = timeframe === "all";
  const isMonthlyView = timeframe === "1";
  const periodLabel = formatPeriodLabel(timeframe, selectedMonth);
  const request = useMemo<StatisticsRequest>(() => {
    if (timeframe === "all") {
      return { allTime: true };
    }

    return {
      allTime: false,
      endYear: selectedMonth.year,
      endMonth: selectedMonth.month,
      monthsBack: Number(timeframe) as 1 | 3 | 6 | 12,
    };
  }, [selectedMonth.month, selectedMonth.year, timeframe]);

  const {
    data,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useStatistics(request);
  const isSlow = useSlowLoading(isLoading);
  const summary = data?.summary;

  const metrics = useMemo<StatisticsMetric[]>(() => {
    const income = summary?.totalIncome ?? 0;
    const expenses = Math.abs(summary?.totalExpense ?? 0);
    const netBalance = summary?.netBalance ?? 0;
    const savedOrInvested = summary?.totalSavedOrInvested ?? 0;
    const savingsRate = income > 0 ? (netBalance / income) * 100 : null;

    return [
      {
        label: "Income",
        value: formatCurrency(income),
        color: "success.main",
        icon: <TrendingUpIcon />,
      },
      {
        label: "Expenses",
        value: formatCurrency(expenses),
        color: "error.main",
        icon: <TrendingDownIcon />,
      },
      {
        label: "Net Balance",
        value: formatCurrency(netBalance),
        color: netBalance < 0 ? "error.main" : "primary.main",
        icon: <AccountBalanceWalletIcon />,
      },
      {
        label: "Savings Rate",
        value: formatSavingsRate(savingsRate),
        color: savingsRate !== null && savingsRate < 0 ? "error.main" : "success.main",
        icon: <SavingsIcon />,
      },
      {
        label: "Saved / Invested",
        value: formatCurrency(savedOrInvested),
        color: "primary.main",
        icon: <SavingsIcon />,
      },
      {
        label: "Transactions",
        value: summary?.transactionCount ?? 0,
        color: "text.primary",
        icon: <ReceiptLongIcon />,
      },
    ];
  }, [summary]);

  const updatePeriodSearchParams = (
    nextTimeframe: StatisticsTimeframeValue,
    nextSelectedMonth: MonthReference,
  ) => {
    setSearchParams(
      buildStatisticsSearchParams(searchParams, nextTimeframe, nextSelectedMonth),
      { replace: true },
    );
  };

  const handleMonthChange = (value: string) => {
    const parsedMonth = parseMonthInputValue(value);

    if (parsedMonth) {
      updatePeriodSearchParams(timeframe, parsedMonth);
    }
  };

  const handleTimeframeChange = (value: StatisticsTimeframeValue) => {
    updatePeriodSearchParams(value, selectedMonth);
  };

  const handleMonthShift = (offset: number) => {
    updatePeriodSearchParams(timeframe, shiftMonth(selectedMonth, offset));
  };

  const handleCurrentMonthSelect = () => {
    updatePeriodSearchParams(timeframe, getCurrentMonthSelection());
  };

  const handleCategorySelect = (category: string) => {
    const transactionSearchParams = buildTransactionListSearchParams({
      page: 0,
      pageSize: 10,
      query: {
        ...defaultTransactionQuery,
        category,
        transactionType: "expense",
        startDate: toTransactionFilterDate(data?.startDate),
        endDate: toTransactionFilterDate(data?.endDate),
      },
    });

    navigate(`/transactions?${transactionSearchParams.toString()}`);
  };

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: "100%" }}>
      <StatisticsPeriodControls
        timeframe={timeframe}
        selectedMonth={selectedMonth}
        periodLabel={periodLabel}
        isSmallScreen={isSmallScreen}
        isAllTime={isAllTime}
        isMonthlyView={isMonthlyView}
        onTimeframeChange={handleTimeframeChange}
        onMonthChange={handleMonthChange}
        onMonthShift={handleMonthShift}
        onCurrentMonthSelect={handleCurrentMonthSelect}
      />

      {isLoading ? (
        <LoadingState
          label="Loading statistics..."
          isOffline={!isOnline}
          isSlow={isSlow}
          minHeight={340}
        />
      ) : isError ? (
        <StatusMessage
          title={isOnline ? "Statistics are unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load the statistics right now. Retry to refresh this view."
              : "Reconnect to the internet and retry to load your statistics."
          }
          actionLabel="Retry"
          onAction={() => {
            void refetch();
          }}
          minHeight={340}
        />
      ) : (
        <DesktopStatisticsView
          data={data}
          metrics={metrics}
          selectedMonth={selectedMonth}
          periodLabel={periodLabel}
          isAllTime={isAllTime}
          isMonthlyView={isMonthlyView}
          isFetching={isFetching}
          isSmallScreen={isSmallScreen}
          onCategorySelect={handleCategorySelect}
        />
      )}
    </Box>
  );
};
