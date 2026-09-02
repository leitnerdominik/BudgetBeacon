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

import type { StatisticsTrendPoint } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import type { StatisticsCardLayoutProps } from "./statisticsLayout";
import {
  getCondensedTrendPoints,
  MOBILE_TREND_POINT_LIMIT,
} from "./statisticsTrend";

type MonthlyTrendProps = StatisticsCardLayoutProps & {
  granularity: "month" | "year";
  periodLabel: string;
  points: StatisticsTrendPoint[];
};

type TrendSummaryMetric = {
  color: string;
  label: string;
  value: ReactNode;
};

const MIN_VISIBLE_BAR_PERCENT = 4;

const shortMonthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const formatPointLabel = (point: StatisticsTrendPoint) =>
  point.month === null
    ? String(point.year)
    : shortMonthFormatter.format(new Date(point.year, point.month - 1, 1));

const getExpenseValue = (point: StatisticsTrendPoint) =>
  Math.abs(point.totalExpense);

const getBarHeight = (value: number, maxValue: number) => {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  return `${Math.max((value / maxValue) * 100, MIN_VISIBLE_BAR_PERCENT)}%`;
};

const getBestBalanceLabel = (points: StatisticsTrendPoint[]) => {
  const bestPoint = points.reduce<StatisticsTrendPoint | null>((best, point) => {
    if (point.transactionCount === 0) {
      return best;
    }

    if (!best || point.netBalance > best.netBalance) {
      return point;
    }

    return best;
  }, null);

  return bestPoint ? formatPointLabel(bestPoint) : "N/A";
};

export const MonthlyTrend = ({
  granularity,
  periodLabel,
  points,
  layout = "page",
}: MonthlyTrendProps) => {
  const chartPoints =
    layout === "slide" ? getCondensedTrendPoints(points) : points;
  const maxBarValue = Math.max(
    1,
    ...chartPoints.map((point) =>
      Math.max(point.totalIncome, getExpenseValue(point)),
    ),
  );
  const totalIncome = points.reduce((sum, point) => sum + point.totalIncome, 0);
  const totalExpenses = points.reduce(
    (sum, point) => sum + getExpenseValue(point),
    0,
  );
  const netBalance = points.reduce((sum, point) => sum + point.netBalance, 0);
  const hasTrendData = points.some((point) => point.transactionCount > 0);
  const trendPointCount = Math.max(chartPoints.length, 1);
  const mobileChartMinWidth = trendPointCount * 72 + (trendPointCount - 1) * 8;
  const isTruncated = layout === "slide" && chartPoints.length < points.length;
  const trendUnit = granularity === "year" ? "years" : "months";
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
      label: granularity === "year" ? "Best Year" : "Best Month",
      value: getBestBalanceLabel(points),
      color: "text.primary",
    },
  ];

  return (
    <Card
      elevation={1}
      tabIndex={layout === "slide" ? 0 : undefined}
      role={layout === "slide" ? "region" : undefined}
      aria-label={layout === "slide" ? "Trend Over Time" : undefined}
      sx={{
        mt: layout === "slide" ? 0 : 2,
        height: layout === "slide" ? "100%" : undefined,
        minHeight: layout === "slide" ? 0 : undefined,
        overflowY: layout === "slide" ? "auto" : undefined,
        minWidth: 0,
        maxWidth: "100%",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        ...(layout === "page" && { overflow: "hidden" }),
        ...(layout === "slide" && {
          "&:focus-visible": {
            outline: "none",
            boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
          },
        }),
      }}
    >
      <CardContent
        sx={{ p: layout === "slide" ? 1.5 : { xs: 2, sm: 2.5 }, minWidth: 0 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={layout === "slide" ? 1 : 1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ minWidth: 0 }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0, maxWidth: "100%" }}
          >
            <TimelineIcon color="primary" sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>
                Trend Over Time
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere" }}
              >
                {granularity === "year" ? "Yearly" : "Monthly"} trend for {periodLabel}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label="Income" size="small" color="success" />
            <Chip label="Expenses" size="small" color="error" />
          </Stack>
        </Stack>

        <Divider sx={{ my: layout === "slide" ? 1.5 : 2 }} />

        <Box
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            ...(layout === "page" && {
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
            }),
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                layout === "slide"
                  ? `repeat(${trendPointCount}, minmax(0, 1fr))`
                  : `repeat(${trendPointCount}, minmax(72px, 1fr))`,
              gap: layout === "slide" ? 0.5 : { xs: 1, sm: 1.5 },
              minWidth:
                layout === "slide"
                  ? 0
                  : {
                      xs: `${mobileChartMinWidth}px`,
                      sm: 0,
                    },
              minHeight: layout === "slide" ? 176 : 240,
              pb: layout === "slide" ? 0.5 : 1,
            }}
          >
            {chartPoints.map((point) => {
              const income = point.totalIncome;
              const expenses = getExpenseValue(point);
              const net = point.netBalance;
              const label = formatPointLabel(point);
              const pointDescription = `${label}: income ${formatCurrency(income)}, expenses ${formatCurrency(expenses)}, net balance ${formatCurrency(net)}`;

              return (
                <Stack
                  key={`${point.year}-${point.month ?? "year"}`}
                  role={layout === "slide" ? "group" : undefined}
                  aria-label={layout === "slide" ? pointDescription : undefined}
                  spacing={layout === "slide" ? 0.5 : 1}
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ minWidth: layout === "slide" ? 0 : 72 }}
                >
                  <Box
                    sx={{
                      height: layout === "slide" ? 112 : 150,
                      width: "100%",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: layout === "slide" ? 0.5 : 0.75,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <TooltipBar
                      color="success.main"
                      height={getBarHeight(income, maxBarValue)}
                      label={`${label} income: ${formatCurrency(income)}`}
                      decorative={layout === "slide"}
                    />
                    <TooltipBar
                      color="error.main"
                      height={getBarHeight(expenses, maxBarValue)}
                      label={`${label} expenses: ${formatCurrency(expenses)}`}
                      decorative={layout === "slide"}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  {layout === "page" ? (
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color={net < 0 ? "error.main" : "primary.main"}
                    >
                      {formatCurrency(net)}
                    </Typography>
                  ) : null}
                </Stack>
              );
            })}
          </Box>
        </Box>

        {isTruncated ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Showing the latest {MOBILE_TREND_POINT_LIMIT} of {points.length} {trendUnit}.
          </Typography>
        ) : null}

        {!hasTrendData ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No transactions found in this trend range.
          </Typography>
        ) : null}

        <Grid container spacing={layout === "slide" ? 1 : 2} sx={{ mt: 1 }}>
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
      </CardContent>
    </Card>
  );
};

type TooltipBarProps = {
  color: string;
  decorative?: boolean;
  height: string;
  label: string;
};

const TooltipBar = ({ color, decorative = false, height, label }: TooltipBarProps) => (
  <Box
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : label}
    role={decorative ? undefined : "img"}
    title={decorative ? undefined : label}
    sx={{
      width: { xs: 14, sm: 18 },
      height,
      bgcolor: color,
      borderRadius: "4px 4px 0 0",
      transition: "height 0.2s ease",
    }}
  />
);
