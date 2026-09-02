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

import type { MonthlySummary, MonthlyTotalsStatistics } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import type { StatisticsCardLayoutProps } from "./statisticsLayout";

type PeriodOverviewProps = StatisticsCardLayoutProps & {
  summary: MonthlySummary | undefined;
  monthlyTotals: MonthlyTotalsStatistics | undefined;
  periodLabel: string;
};

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatPercentage = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

const formatOptionalCurrency = (value: number | undefined) =>
  value === undefined ? "N/A" : formatCurrency(value);

export const PeriodOverview = ({
  summary,
  monthlyTotals,
  periodLabel,
  layout = "page",
}: PeriodOverviewProps) => {
  const hasTransactions = (summary?.transactionCount ?? 0) > 0;
  const excludedTotal =
    (summary?.internalTransferTotal ?? 0) + (summary?.adjustmentTotal ?? 0);

  return (
    <Card
      elevation={1}
      tabIndex={layout === "slide" ? 0 : undefined}
      role={layout === "slide" ? "region" : undefined}
      aria-label={layout === "slide" ? "Period Overview" : undefined}
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={layout === "slide" ? 1 : 1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              Period Overview
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              {hasTransactions
                ? `Income, expenses and balance for ${periodLabel}.`
                : `No transactions found for ${periodLabel}.`}
            </Typography>
          </Box>
          <Chip
            label={
              excludedTotal > 0
                ? `Excluded ${formatCurrency(excludedTotal)}`
                : hasTransactions
                  ? "Data available"
                  : "No data"
            }
            color={excludedTotal > 0 ? "default" : hasTransactions ? "success" : "default"}
            variant={hasTransactions && excludedTotal === 0 ? "filled" : "outlined"}
          />
        </Stack>
        {excludedTotal > 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Internal transfers and adjustments are excluded from income,
            expenses, net balance, savings rate, and spending charts.
          </Typography>
        ) : null}

        <Divider sx={{ my: layout === "slide" ? 1.5 : 2 }} />

        <Grid container spacing={layout === "slide" ? 1 : { xs: 1.5, sm: 2 }}>
          <Grid
            size={{ xs: layout === "slide" ? 6 : 12, sm: 6, md: layout === "slide" ? 6 : 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Average Monthly Income
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.averageIncome)}
            </Typography>
          </Grid>
          <Grid
            size={{ xs: layout === "slide" ? 6 : 12, sm: 6, md: layout === "slide" ? 6 : 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Median Monthly Income
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.medianIncome)}
            </Typography>
          </Grid>
          <Grid
            size={{ xs: layout === "slide" ? 6 : 12, sm: 6, md: layout === "slide" ? 6 : 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Average Monthly Expenses
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.averageExpense)}
            </Typography>
          </Grid>
          <Grid
            size={{ xs: layout === "slide" ? 6 : 12, sm: 6, md: layout === "slide" ? 6 : 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Median Monthly Expenses
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.medianExpense)}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: layout === "slide" ? 1.5 : 2 }} />

        <Grid container spacing={layout === "slide" ? 1 : { xs: 1.5, sm: 2 }}>
          <Grid
            size={{ xs: layout === "slide" ? 6 : 12, sm: 6, md: layout === "slide" ? 6 : 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Expense Ratio
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {summary && summary.totalIncome > 0
                ? formatPercentage(
                    (Math.abs(summary.totalExpense) / summary.totalIncome) * 100,
                  )
                : "N/A"}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
