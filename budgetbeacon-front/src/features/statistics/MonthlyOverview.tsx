import { useLayoutEffect, useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useOutletContext } from "react-router-dom";

import { formatCurrency } from "../../utils/formatDate";
import { DesktopStatisticsView } from "./DesktopStatisticsView";
import { MobileStatisticsView } from "./MobileStatisticsView";
import type { StatisticsMetric } from "./StatisticsMetricGrid";
import type { StatisticsContext } from "./statisticsContext";
import type { StatisticsView } from "./statisticsViews";
import {
  getStatisticsViewSlides,
  resolveActiveStatisticsSlideId,
  type StatisticsSlideId,
} from "./statisticsSlides";

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatSavingsRate = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

export const MonthlyOverview = ({ view }: { view: StatisticsView }) => {
  const { data, timeframe, selectedMonth, periodLabel, isSmallScreen, isMobileView, onCategorySelect } =
    useOutletContext<StatisticsContext>();
  const summary = data?.summary;
  const isAllTime = timeframe === "all";
  const isMonthlyView = timeframe === "1";
  const hasMonthComparison = Boolean(
    summary && data?.previousMonthSummary,
  );
  const slideDefinitions = useMemo(
    () => getStatisticsViewSlides(view, { timeframe, hasMonthComparison }),
    [hasMonthComparison, timeframe, view],
  );
  const [activeSlideId, setActiveSlideId] = useState<StatisticsSlideId | null>(null);
  const presentedActiveSlideId = resolveActiveStatisticsSlideId(
    slideDefinitions,
    activeSlideId,
  );

  useLayoutEffect(() => {
    // Commit the resolved slide before paint after a successful registry change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSlideId((currentActiveSlideId) =>
      currentActiveSlideId === presentedActiveSlideId
        ? currentActiveSlideId
        : presentedActiveSlideId,
    );
  }, [presentedActiveSlideId]);

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0, minWidth: 0 }}>
      {view === "spending" && isMonthlyView ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Choose 3 months or longer to see recurring expense candidates.
        </Typography>
      ) : null}
      {view === "trends" && isMonthlyView ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          This selection shows one month. Choose a longer range to explore income and expense history.
        </Typography>
      ) : null}
      {view === "overview" && isMonthlyView && !hasMonthComparison ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Previous-month comparison is unavailable for this selection.
        </Typography>
      ) : null}
      {isMobileView ? (
        <MobileStatisticsView
          data={data}
          metrics={metrics}
          selectedMonth={selectedMonth}
          periodLabel={periodLabel}
          timeframe={timeframe}
          slideDefinitions={slideDefinitions}
          activeSlideId={presentedActiveSlideId}
          onActiveSlideChange={setActiveSlideId}
          onCategorySelect={onCategorySelect}
        />
      ) : (
        <DesktopStatisticsView
          view={view}
          data={data}
          metrics={metrics}
          selectedMonth={selectedMonth}
          periodLabel={periodLabel}
          isAllTime={isAllTime}
          isMonthlyView={isMonthlyView}
          isSmallScreen={isSmallScreen}
          onCategorySelect={onCategorySelect}
        />
      )}
    </Box>
  );
};
