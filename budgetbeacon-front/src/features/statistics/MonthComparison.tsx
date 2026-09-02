import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

import type { MonthlySummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { shiftMonth, type MonthReference } from "./statisticsPeriod";
import type { StatisticsCardLayoutProps } from "./statisticsLayout";

type MonthComparisonProps = StatisticsCardLayoutProps & {
  current: MonthlySummary;
  month: MonthReference;
  previous: MonthlySummary;
};

type ComparisonMetric = {
  changeColor: string;
  changeLabel: string;
  currentValue: string;
  label: string;
  previousValue: string;
};

const shortMonthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatShortMonthLabel = ({ month, year }: MonthReference) =>
  shortMonthFormatter.format(new Date(year, month - 1, 1));

const formatChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? "0 %" : "New";
  }

  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  const prefix = percentage > 0 ? "+" : "";

  return `${prefix}${percentFormatter.format(percentage)} %`;
};

const getChangeColor = (
  current: number,
  previous: number,
  positiveIsGood: boolean,
) => {
  const delta = current - previous;

  if (delta === 0) {
    return "text.secondary";
  }

  return (delta > 0) === positiveIsGood ? "success.main" : "error.main";
};

export const MonthComparison = ({
  current,
  month,
  previous,
  layout = "page",
}: MonthComparisonProps) => {
  const previousMonth = shiftMonth(month, -1);
  const currentIncome = current.totalIncome;
  const previousIncome = previous.totalIncome;
  const currentExpenses = Math.abs(current.totalExpense);
  const previousExpenses = Math.abs(previous.totalExpense);
  const currentNet = current.netBalance;
  const previousNet = previous.netBalance;
  const currentTransactions = current.transactionCount;
  const previousTransactions = previous.transactionCount;

  const metrics: ComparisonMetric[] = [
    {
      label: "Income",
      currentValue: formatCurrency(currentIncome),
      previousValue: formatCurrency(previousIncome),
      changeLabel: formatChange(currentIncome, previousIncome),
      changeColor: getChangeColor(currentIncome, previousIncome, true),
    },
    {
      label: "Expenses",
      currentValue: formatCurrency(currentExpenses),
      previousValue: formatCurrency(previousExpenses),
      changeLabel: formatChange(currentExpenses, previousExpenses),
      changeColor: getChangeColor(currentExpenses, previousExpenses, false),
    },
    {
      label: "Net Balance",
      currentValue: formatCurrency(currentNet),
      previousValue: formatCurrency(previousNet),
      changeLabel: formatChange(currentNet, previousNet),
      changeColor: getChangeColor(currentNet, previousNet, true),
    },
    {
      label: "Transactions",
      currentValue: String(currentTransactions),
      previousValue: String(previousTransactions),
      changeLabel: formatChange(currentTransactions, previousTransactions),
      changeColor:
        currentTransactions === previousTransactions
          ? "text.secondary"
          : "primary.main",
    },
  ];

  return (
    <Card
      elevation={1}
      tabIndex={layout === "slide" ? 0 : undefined}
      role={layout === "slide" ? "region" : undefined}
      aria-label={layout === "slide" ? "Month Comparison" : undefined}
      sx={{
        mt: layout === "slide" ? 0 : 2,
        height: layout === "slide" ? "100%" : undefined,
        minHeight: layout === "slide" ? 0 : undefined,
        overflowY: layout === "slide" ? "auto" : undefined,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        ...(layout === "slide" && {
          "&:focus-visible": {
            outline: "none",
            boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
          },
        }),
      }}
    >
      <CardContent sx={{ p: layout === "slide" ? 1.5 : { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CompareArrowsIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Month Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatShortMonthLabel(month)} vs {formatShortMonthLabel(previousMonth)}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: layout === "slide" ? 1.5 : 2 }} />

        <Grid container spacing={layout === "slide" ? 1 : 1.5}>
          {metrics.map((metric) => (
            <Grid size={{ xs: 6, sm: 6, lg: layout === "slide" ? 6 : 3 }} key={metric.label}>
              <Box
                sx={{
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: layout === "slide" ? 1.25 : 2,
                }}
              >
                <Typography variant="overline" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{
                    fontSize: { xs: "1rem", sm: "1.25rem" },
                    overflowWrap: "anywhere",
                  }}
                >
                  {metric.currentValue}
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 0.25, sm: 1 }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent={{ sm: "space-between" }}
                  sx={{ mt: 1 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Previous {metric.previousValue}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color={metric.changeColor}
                  >
                    {metric.changeLabel}
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};
