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
import { statisticsContentSx, statisticsSurfaceSx } from "./statisticsLayout";

type PeriodOverviewProps = {
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
}: PeriodOverviewProps) => {
  const hasTransactions = (summary?.transactionCount ?? 0) > 0;

  return (
    <Card
      elevation={0}
      component="section"
      aria-label="Period Overview"
      sx={statisticsSurfaceSx}
    >
      <CardContent sx={statisticsContentSx}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h6" fontWeight={700}>
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
            label={hasTransactions ? "Data available" : "No data"}
            color={hasTransactions ? "success" : "default"}
            variant={hasTransactions ? "filled" : "outlined"}
          />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          <Grid
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            size={{ xs: 12, sm: 6, md: 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Average Monthly Income
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.averageIncome)}
            </Typography>
          </Grid>
          <Grid
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            size={{ xs: 12, sm: 6, md: 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Median Monthly Income
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.medianIncome)}
            </Typography>
          </Grid>
          <Grid
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            size={{ xs: 12, sm: 6, md: 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Average Monthly Expenses
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.averageExpense)}
            </Typography>
          </Grid>
          <Grid
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            size={{ xs: 12, sm: 6, md: 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Median Monthly Expenses
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatOptionalCurrency(monthlyTotals?.medianExpense)}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          <Grid
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            size={{ xs: 12, sm: 6, md: 3 }}
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
