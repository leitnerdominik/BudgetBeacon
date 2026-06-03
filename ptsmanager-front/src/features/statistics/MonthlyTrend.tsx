import type { ReactNode } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import TimelineIcon from "@mui/icons-material/Timeline";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import {
  useMonthlyTrend,
  type MonthReference,
  type MonthlyTrendPoint,
} from "./useMonthlyStatistics";

type MonthlyTrendProps = {
  endMonth: MonthReference;
};

type TrendSummaryMetric = {
  color: string;
  label: string;
  value: ReactNode;
};

const TREND_MONTH_COUNT = 6;
const MIN_VISIBLE_BAR_PERCENT = 4;

const shortMonthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const formatShortMonthLabel = ({ month, year }: MonthReference) =>
  shortMonthFormatter.format(new Date(year, month - 1, 1));

const getExpenseValue = (point: MonthlyTrendPoint) =>
  Math.abs(point.summary?.totalExpense ?? 0);

const getIncomeValue = (point: MonthlyTrendPoint) =>
  point.summary?.totalIncome ?? 0;

const getNetBalanceValue = (point: MonthlyTrendPoint) =>
  point.summary?.netBalance ?? 0;

const getBarHeight = (value: number, maxValue: number) => {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  return `${Math.max((value / maxValue) * 100, MIN_VISIBLE_BAR_PERCENT)}%`;
};

const getBestBalanceMonthLabel = (points: MonthlyTrendPoint[]) => {
  const bestPoint = points.reduce<MonthlyTrendPoint | null>((best, point) => {
    if (!point.summary) {
      return best;
    }

    if (!best || getNetBalanceValue(point) > getNetBalanceValue(best)) {
      return point;
    }

    return best;
  }, null);

  return bestPoint ? formatShortMonthLabel(bestPoint) : "N/A";
};

export const MonthlyTrend = ({ endMonth }: MonthlyTrendProps) => {
  const isOnline = useNetworkStatus();
  const {
    data: trendPoints,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useMonthlyTrend(endMonth, TREND_MONTH_COUNT);
  const isSlow = useSlowLoading(isLoading);

  const maxBarValue = Math.max(
    1,
    ...trendPoints.map((point) =>
      Math.max(getIncomeValue(point), getExpenseValue(point)),
    ),
  );
  const totalIncome = trendPoints.reduce(
    (sum, point) => sum + getIncomeValue(point),
    0,
  );
  const totalExpenses = trendPoints.reduce(
    (sum, point) => sum + getExpenseValue(point),
    0,
  );
  const netBalance = trendPoints.reduce(
    (sum, point) => sum + getNetBalanceValue(point),
    0,
  );
  const hasTrendData = trendPoints.some(
    (point) => (point.summary?.transactionCount ?? 0) > 0,
  );
  const trendSummaryMetrics: TrendSummaryMetric[] = [
    {
      label: "Income",
      value: formatCurrency(totalIncome),
      color: "success.main",
    },
    {
      label: "Expenses",
      value: formatCurrency(totalExpenses),
      color: "error.main",
    },
    {
      label: "Net Balance",
      value: formatCurrency(netBalance),
      color: netBalance < 0 ? "error.main" : "primary.main",
    },
    {
      label: "Best Month",
      value: getBestBalanceMonthLabel(trendPoints),
      color: "text.primary",
    },
  ];

  return (
    <Card
      elevation={1}
      sx={{
        mt: 2,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TimelineIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Trend Over Time
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last {TREND_MONTH_COUNT} months through{" "}
                {formatShortMonthLabel(endMonth)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label="Income" size="small" color="success" />
            <Chip label="Expenses" size="small" color="error" />
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {isLoading ? (
          <LoadingState
            label="Loading monthly trend..."
            isOffline={!isOnline}
            isSlow={isSlow}
            minHeight={280}
          />
        ) : isError ? (
          <StatusMessage
            title={isOnline ? "Trend is unavailable" : "You're offline"}
            description={
              isOnline
                ? "We couldn't load the monthly trend right now. Retry to refresh this view."
                : "Reconnect to the internet and retry to load your monthly trend."
            }
            actionLabel="Retry trend"
            onAction={() => {
              void refetch();
            }}
            minHeight={280}
          />
        ) : (
          <>
            {isFetching ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
              >
                Refreshing monthly trend...
              </Typography>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: `repeat(${TREND_MONTH_COUNT}, minmax(56px, 1fr))`,
                  sm: `repeat(${TREND_MONTH_COUNT}, minmax(72px, 1fr))`,
                },
                gap: { xs: 1, sm: 1.5 },
                minHeight: 240,
                overflowX: "auto",
                pb: 1,
              }}
            >
              {trendPoints.map((point) => {
                const income = getIncomeValue(point);
                const expenses = getExpenseValue(point);
                const net = getNetBalanceValue(point);

                return (
                  <Stack
                    key={`${point.year}-${point.month}`}
                    spacing={1}
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{ minWidth: { xs: 56, sm: 72 } }}
                  >
                    <Box
                      sx={{
                        height: 150,
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        gap: 0.75,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <TooltipBar
                        color="success.main"
                        height={getBarHeight(income, maxBarValue)}
                        label={`${formatShortMonthLabel(point)} income: ${formatCurrency(income)}`}
                      />
                      <TooltipBar
                        color="error.main"
                        height={getBarHeight(expenses, maxBarValue)}
                        label={`${formatShortMonthLabel(point)} expenses: ${formatCurrency(expenses)}`}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatShortMonthLabel(point)}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color={net < 0 ? "error.main" : "primary.main"}
                    >
                      {formatCurrency(net)}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>

            {!hasTrendData ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5 }}
              >
                No transactions found in this trend range.
              </Typography>
            ) : null}

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {trendSummaryMetrics.map((metric) => (
                <Grid size={{ xs: 6, md: 3 }} key={metric.label}>
                  <Typography variant="body2" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700} color={metric.color}>
                    {metric.value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
};

type TooltipBarProps = {
  color: string;
  height: string;
  label: string;
};

const TooltipBar = ({ color, height, label }: TooltipBarProps) => (
  <Box
    aria-label={label}
    role="img"
    title={label}
    sx={{
      width: { xs: 14, sm: 18 },
      height,
      bgcolor: color,
      borderRadius: "4px 4px 0 0",
      transition: "height 0.2s ease",
    }}
  />
);
