import {
  Box,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import SpeedIcon from "@mui/icons-material/Speed";

import { StatusMessage } from "../../components/AsyncState";
import type { MonthlySummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import type { MonthReference } from "./useMonthlyStatistics";

type SpendingPaceProps = {
  month: MonthReference;
  summary: MonthlySummary | undefined;
};

type PaceMetric = {
  color: string;
  label: string;
  value: string | number;
};

const getDaysInMonth = ({ month, year }: MonthReference) =>
  new Date(year, month, 0).getDate();

const isSameMonth = (month: MonthReference, date: Date) =>
  month.year === date.getFullYear() && month.month === date.getMonth() + 1;

const isPastMonth = (month: MonthReference, date: Date) =>
  month.year < date.getFullYear() ||
  (month.year === date.getFullYear() && month.month < date.getMonth() + 1);

const getElapsedDays = (month: MonthReference, today: Date) => {
  if (isPastMonth(month, today)) {
    return getDaysInMonth(month);
  }

  if (isSameMonth(month, today)) {
    return today.getDate();
  }

  return 0;
};

export const SpendingPace = ({ month, summary }: SpendingPaceProps) => {
  const today = new Date();
  const daysInMonth = getDaysInMonth(month);
  const elapsedDays = getElapsedDays(month, today);
  const isFutureMonth = elapsedDays === 0;
  const expenseTotal = Math.abs(summary?.totalExpense ?? 0);
  const incomeTotal = summary?.totalIncome ?? 0;
  const dailyAverage = elapsedDays > 0 ? expenseTotal / elapsedDays : 0;
  const projectedExpenses = isSameMonth(month, today)
    ? dailyAverage * daysInMonth
    : expenseTotal;
  const projectedNetBalance = incomeTotal - projectedExpenses;
  const monthProgress = Math.min((elapsedDays / daysInMonth) * 100, 100);
  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);

  const metrics: PaceMetric[] = [
    {
      label: "Daily Average",
      value: formatCurrency(dailyAverage),
      color: "text.primary",
    },
    {
      label: "Projected Expenses",
      value: formatCurrency(projectedExpenses),
      color: "error.main",
    },
    {
      label: "Projected Balance",
      value: formatCurrency(projectedNetBalance),
      color: projectedNetBalance < 0 ? "error.main" : "success.main",
    },
    {
      label: "Days Remaining",
      value: remainingDays,
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
        <Stack direction="row" spacing={1} alignItems="center">
          <SpeedIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Spending Pace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {elapsedDays} of {daysInMonth} days accounted for
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {isFutureMonth ? (
          <StatusMessage
            title="No spending pace yet"
            description="Spending pace is available once the selected month has started."
            minHeight={220}
          />
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 0.75 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Month Progress
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {Math.round(monthProgress)} %
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={monthProgress}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>

            <Grid container spacing={1.5}>
              {metrics.map((metric) => (
                <Grid size={{ xs: 6, sm: 6, lg: 3 }} key={metric.label}>
                  <Box
                    sx={{
                      height: "100%",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Typography variant="overline" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color={metric.color}
                      sx={{
                        fontSize: { xs: "1rem", sm: "1.25rem" },
                        overflowWrap: "anywhere",
                      }}
                    >
                      {metric.value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
};
