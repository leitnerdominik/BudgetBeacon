import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useOutletContext } from "react-router-dom";

import { formatCurrency } from "../../utils/formatDate";
import { StatisticsContent } from "./StatisticsContent";
import { StatisticsSecondaryInfo } from "./StatisticsSecondaryInfo";
import type { StatisticsMetric } from "./StatisticsMetricGrid";
import type { StatisticsContext } from "./statisticsContext";
import type { StatisticsView } from "./statisticsViews";

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatSavingsRate = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

export const MonthlyOverview = ({ view }: { view: StatisticsView }) => {
  const { data, timeframe, selectedMonth, periodLabel, isSmallScreen, onCategorySelect } =
    useOutletContext<StatisticsContext>();
  const summary = data?.summary;
  const isAllTime = timeframe === "all";
  const isMonthlyView = timeframe === "1";
  const metrics = useMemo<StatisticsMetric[]>(() => {
    const income = summary?.totalIncome ?? 0;
    const expenses = Math.abs(summary?.totalExpense ?? 0);
    const netBalance = summary?.netBalance ?? 0;
    const savingsRate = income > 0 ? (netBalance / income) * 100 : null;

    return [
      {
        label: "Income",
        value: formatCurrency(income),
        color: "text.primary",
        icon: <TrendingUpIcon />,
      },
      {
        label: "Expenses",
        value: formatCurrency(expenses),
        color: "text.primary",
        icon: <TrendingDownIcon />,
      },
      {
        label: "Net Balance",
        value: formatCurrency(netBalance),
        color: netBalance < 0 ? "error.main" : "text.primary",
        icon: <AccountBalanceWalletIcon />,
      },
      {
        label: "Savings Rate",
        value: formatSavingsRate(savingsRate),
        color: savingsRate !== null && savingsRate < 0 ? "error.main" : "text.primary",
        icon: <SavingsIcon />,
      },
    ];
  }, [summary]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 3 }, minWidth: 0, overflowWrap: "anywhere" }}>
      {view === "spending" && isMonthlyView ? (
        <Typography variant="body2" color="text.secondary">
          Choose 3 months or longer to see recurring expense candidates. Detection requires repeated expenses across at least two months.
        </Typography>
      ) : null}
      {view === "trends" && isMonthlyView ? (
        <Typography variant="body2" color="text.secondary">
          This selection shows one month. Choose a longer range to explore income and expense history.
        </Typography>
      ) : null}
      {view === "trends" && isAllTime ? (
        <Typography variant="body2" color="text.secondary">
          The chart shows yearly totals. Averages and medians below describe monthly totals for the selected period.
        </Typography>
      ) : null}
      <StatisticsContent
        view={view}
        data={data}
        metrics={metrics}
        selectedMonth={selectedMonth}
        periodLabel={periodLabel}
        isAllTime={isAllTime}
        isMonthlyView={isMonthlyView}
        timeframe={timeframe}
        isSmallScreen={isSmallScreen}
        onCategorySelect={onCategorySelect}
      />
      {view === "overview" ? (
        <StatisticsSecondaryInfo summary={summary} previous={isMonthlyView ? data?.previousMonthSummary : undefined} month={selectedMonth} />
      ) : null}
    </Box>
  );
};
