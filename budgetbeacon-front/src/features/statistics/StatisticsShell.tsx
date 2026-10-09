import { useMemo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";

import { defaultTransactionQuery, type StatisticsRequest } from "../../api/transactionsApi";
import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { buildTransactionListSearchParams } from "../transactions/transactionListUrlState";
import { StatisticsExclusionNotice } from "./StatisticsExclusionNotice";
import { StatisticsPeriodControls } from "./StatisticsPeriodControls";
import { StatisticsViewNavigation } from "./StatisticsViewNavigation";
import type { StatisticsContext } from "./statisticsContext";
import {
  buildStatisticsSearchParams,
  formatPeriodLabel,
  getCurrentMonthSelection,
  parseMonthInputValue,
  resolveStatisticsPeriod,
  shiftMonth,
  type MonthReference,
  type StatisticsTimeframeValue,
} from "./statisticsPeriod";
import { useStatistics } from "./useStatistics";

export const StatisticsShell = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobileView = useMediaQuery(theme.breakpoints.down("md"));
  const isOnline = useNetworkStatus();
  const { timeframe, selectedMonth } = useMemo(() => resolveStatisticsPeriod(searchParams), [searchParams]);
  const isAllTime = timeframe === "all";
  const isMonthlyView = timeframe === "1";
  const periodLabel = formatPeriodLabel(timeframe, selectedMonth);
  const request = useMemo<StatisticsRequest>(() => isAllTime ? { allTime: true } : {
    allTime: false,
    endYear: selectedMonth.year,
    endMonth: selectedMonth.month,
    monthsBack: Number(timeframe) as 1 | 3 | 6 | 12,
  }, [isAllTime, selectedMonth.month, selectedMonth.year, timeframe]);
  const { data, isError, isFetching, isPending, refetch } = useStatistics(request);
  const isSlow = useSlowLoading(isPending);

  const updatePeriod = (nextTimeframe: StatisticsTimeframeValue, nextMonth: MonthReference) => {
    const next = buildStatisticsSearchParams(searchParams, nextTimeframe, nextMonth);
    if (next.toString() !== searchParams.toString()) setSearchParams(next);
  };
  const onCategorySelect = (category: string) => {
    const params = buildTransactionListSearchParams({
      page: 0,
      pageSize: 10,
      query: {
        ...defaultTransactionQuery,
        category,
        transactionType: "expense",
        startDate: data?.startDate?.slice(0, 10) ?? "",
        endDate: data?.endDate?.slice(0, 10) ?? "",
      },
    });
    navigate(`/transactions?${params}`);
  };
  const context: StatisticsContext = { data, timeframe, selectedMonth, periodLabel, isSmallScreen, isMobileView, onCategorySelect };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, maxWidth: "100%", containerType: "inline-size", overflowWrap: "anywhere", "& .MuiButton-root": { minHeight: 44 }, "& .MuiButtonBase-root:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}>
      <Box sx={{ flexShrink: 0, minWidth: 0 }}>
        <StatisticsPeriodControls
          timeframe={timeframe}
          selectedMonth={selectedMonth}
          periodLabel={periodLabel}
          isSmallScreen={isSmallScreen}
          isMobileView={isMobileView}
          isAllTime={isAllTime}
          isMonthlyView={isMonthlyView}
          onTimeframeChange={(value) => updatePeriod(value, selectedMonth)}
          onMonthChange={(value) => {
            const parsed = parseMonthInputValue(value);
            if (parsed) updatePeriod(timeframe, parsed);
          }}
          onMonthShift={(offset) => updatePeriod(timeframe, shiftMonth(selectedMonth, offset))}
          onCurrentMonthSelect={() => updatePeriod(timeframe, getCurrentMonthSelection())}
        />
        <StatisticsViewNavigation searchParams={searchParams} timeframe={timeframe} selectedMonth={selectedMonth} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {isPending ? (
          <Box role="status">
            <LoadingState label="Loading statistics..." isOffline={!isOnline} isSlow={isSlow} minHeight={240} />
          </Box>
        ) : isError ? (
          <Box role="alert">
            <StatusMessage
              title={isOnline ? "Statistics are unavailable" : "You're offline"}
              description={isOnline ? "We couldn't load the statistics right now. Retry to refresh this view." : "Reconnect to the internet and retry to load your statistics."}
              actionLabel="Retry"
              onAction={() => { void refetch(); }}
              minHeight={240}
            />
          </Box>
        ) : (
          <>
            {!isOnline && data ? <Typography role="status" variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>You're offline. Showing the last available statistics for this period.</Typography> : null}
            {isFetching ? <Typography role="status" variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>Refreshing statistics...</Typography> : null}
            <StatisticsExclusionNotice summary={data?.summary} />
            <Outlet context={context} />
          </>
        )}
      </Box>
    </Box>
  );
};
