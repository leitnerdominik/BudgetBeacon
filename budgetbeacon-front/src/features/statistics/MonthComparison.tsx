import { Box, Card, CardContent, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import type { MonthlySummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { describeStatisticsChange } from "./statisticsComparison";
import { formatMonthLabel, shiftMonth, type MonthReference, type StatisticsTimeframeValue } from "./statisticsPeriod";
import type { StatisticsCardLayoutProps } from "./statisticsLayout";
import { buildStatisticsViewLocation } from "./statisticsViews";

type MonthComparisonProps = StatisticsCardLayoutProps & {
  current: MonthlySummary | undefined;
  month: MonthReference;
  previous: MonthlySummary | null | undefined;
  timeframe: StatisticsTimeframeValue;
};

export const MonthComparison = ({
  current,
  month,
  previous,
  timeframe,
  layout = "page",
}: MonthComparisonProps) => {
  const [searchParams] = useSearchParams();
  const isMonthly = timeframe === "1";
  const metrics = isMonthly && current && previous ? [
    { label: "Income", current: current.totalIncome, previous: previous.totalIncome, favorableDirection: "increase" as const },
    { label: "Expenses", current: Math.abs(current.totalExpense), previous: Math.abs(previous.totalExpense), favorableDirection: "decrease" as const },
    { label: "Net Balance", current: current.netBalance, previous: previous.netBalance, favorableDirection: "increase" as const },
  ] : [];

  return (
    <Card
      component="section"
      aria-label={isMonthly ? "Month comparison" : "Explore this period"}
      elevation={0}
      tabIndex={layout === "slide" ? 0 : undefined}
      sx={{
        mt: layout === "slide" ? 0 : 2,
        minWidth: 0,
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
      <CardContent sx={{ p: layout === "slide" ? 1.5 : 2, overflowWrap: "anywhere" }}>
        <Typography component="h2" variant="subtitle1" fontWeight={700}>
          {isMonthly ? "Month Comparison" : "Explore this period"}
        </Typography>
        {isMonthly ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {formatMonthLabel(month)} vs {formatMonthLabel(shiftMonth(month, -1))}
            </Typography>
            {metrics.length > 0 ? (
              <Box component="dl" sx={{ m: 0 }}>
                {metrics.map((metric) => {
                  const change = describeStatisticsChange(metric.current, metric.previous, metric.favorableDirection);
                  return (
                    <Box key={metric.label} sx={{ py: 1, "& + &": { borderTop: "1px solid", borderColor: "divider" } }}>
                      <Typography component="dt" variant="body2" fontWeight={700}>
                        {metric.label}
                      </Typography>
                      <Box component="dd" sx={{ m: 0 }}>
                        <Typography variant="body2">Current {formatCurrency(metric.current)}</Typography>
                        <Typography variant="body2" color="text.secondary">Previous {formatCurrency(metric.previous)}</Typography>
                        <Typography variant="body2" color={change.color}>{change.label}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Previous-month comparison is unavailable for this selection.
              </Typography>
            )}
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Month comparison is available for a one-month selection. Explore the selected period:
            </Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} sx={{ mt: 1 }}>
              {(["spending", "trends"] as const).map((view) => (
                <Link
                  key={view}
                  component={RouterLink}
                  to={buildStatisticsViewLocation(view, searchParams, timeframe, month)}
                  sx={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}
                >
                  {view === "spending" ? "Spending" : "Trends"}
                </Link>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
};
