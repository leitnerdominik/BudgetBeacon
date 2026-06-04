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

type MonthlyTrendProps = {
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
}: MonthlyTrendProps) => {
  const maxBarValue = Math.max(
    1,
    ...points.map((point) => Math.max(point.totalIncome, getExpenseValue(point))),
  );
  const totalIncome = points.reduce((sum, point) => sum + point.totalIncome, 0);
  const totalExpenses = points.reduce(
    (sum, point) => sum + getExpenseValue(point),
    0,
  );
  const netBalance = points.reduce((sum, point) => sum + point.netBalance, 0);
  const hasTrendData = points.some((point) => point.transactionCount > 0);
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
                {granularity === "year" ? "Yearly" : "Monthly"} trend for {periodLabel}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label="Income" size="small" color="success" />
            <Chip label="Expenses" size="small" color="error" />
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(72px, 1fr))`,
            gap: { xs: 1, sm: 1.5 },
            minHeight: 240,
            overflowX: "auto",
            pb: 1,
          }}
        >
          {points.map((point) => {
            const income = point.totalIncome;
            const expenses = getExpenseValue(point);
            const net = point.netBalance;
            const label = formatPointLabel(point);

            return (
              <Stack
                key={`${point.year}-${point.month ?? "year"}`}
                spacing={1}
                alignItems="center"
                justifyContent="flex-end"
                sx={{ minWidth: 72 }}
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
                    label={`${label} income: ${formatCurrency(income)}`}
                  />
                  <TooltipBar
                    color="error.main"
                    height={getBarHeight(expenses, maxBarValue)}
                    label={`${label} expenses: ${formatCurrency(expenses)}`}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {label}
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
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
