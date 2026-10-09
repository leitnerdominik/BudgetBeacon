import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { StatisticsTrendPoint } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import type { StatisticsCardLayoutProps } from "./statisticsLayout";
import { formatTrendPointLabel, prepareStatisticsChart } from "./statisticsTrend";

type MonthlyTrendProps = StatisticsCardLayoutProps & {
  granularity: "month" | "year";
  periodLabel: string;
  points: StatisticsTrendPoint[];
  showSummary?: boolean;
};

export const MonthlyTrend = ({
  granularity, periodLabel, points, layout = "page", showSummary = false,
}: MonthlyTrendProps) => {
  const chart = prepareStatisticsChart(points);
  const hasTrendData = points.some((point) => point.transactionCount > 0);
  const hasAmounts = chart.points.some(({ income, expenses }) => income !== 0 || expenses !== 0);
  // Preserve existing trend summaries; these belong only to the Trends destination.
  const bestPoint = chart.points.reduce<StatisticsTrendPoint | null>((best, { point }) =>
    point.transactionCount > 0 && (!best || point.netBalance > best.netBalance) ? point : best, null);
  const summaryMetrics = showSummary ? [
    { label: "Income", value: formatCurrency(points.reduce((sum, point) => sum + point.totalIncome, 0)) },
    { label: "Expenses", value: formatCurrency(points.reduce((sum, point) => sum + Math.abs(point.totalExpense), 0)) },
    { label: "Net Balance", value: formatCurrency(points.reduce((sum, point) => sum + point.netBalance, 0)) },
    { label: granularity === "year" ? "Best Year" : "Best Month", value: bestPoint ? formatTrendPointLabel(bestPoint) : "N/A" },
  ] : [];

  return (
    <Card
      component="section"
      aria-label="Income versus expenses"
      tabIndex={layout === "slide" ? 0 : undefined}
      sx={{
        mt: layout === "slide" ? 0 : 2,
        height: layout === "slide" ? "100%" : undefined,
        minHeight: 0, minWidth: 0, maxWidth: "100%",
        overflow: layout === "slide" ? "auto" : "hidden",
        border: "1px solid", borderColor: "divider", boxShadow: "none",
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, overflowWrap: "anywhere" }}>
        <Typography variant="h6" component="h2">Income versus expenses</Typography>
        <Typography variant="body2" color="text.secondary">
          {granularity === "year" ? "Yearly" : "Monthly"} totals for {periodLabel}
        </Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} sx={{ my: 2 }} aria-label="Chart legend">
          {[{ label: "Income (left)", color: "primary.main" }, { label: "Expenses (right)", color: "secondary.main" }].map(({ label, color }) => (
            <Stack key={label} direction="row" spacing={1} alignItems="center">
              <Box aria-hidden="true" sx={{ width: 12, height: 12, bgcolor: color }} />
              <Typography variant="body2">{label}</Typography>
            </Stack>
          ))}
        </Stack>
        {chart.points.length > 0 ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Exact amounts are below each pair of bars. Scroll within the chart to see every period.
            </Typography>
            <Box
              role="region" aria-label="Income and expense chart with exact values"
              tabIndex={0}
              sx={{
                width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "auto",
                overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch", p: 0.5,
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
              }}
            >
              <Box sx={{ display: "grid", gridTemplateColumns: `8em repeat(${chart.points.length}, minmax(8em, 1fr))`, gap: 1.5, pt: 2, pb: 1 }}>
                <Box aria-hidden="true" sx={{ position: "relative", height: "16rem" }}>
                  {chart.ticks.map(({ value, topPercent }) => (
                    <Typography key={value} variant="caption" sx={{ position: "absolute", top: `${topPercent}%`, right: 0, transform: "translateY(-50%)", textAlign: "right", maxWidth: "100%", overflowWrap: "anywhere" }}>
                      {formatCurrency(value)}
                    </Typography>
                  ))}
                </Box>
                {chart.points.map(({ point, label, income, expenses, incomeBar, expenseBar }) => (
                  <Box key={`${point.year}-${point.month ?? "year"}`} role="group" aria-label={label} sx={{ minWidth: 0 }}>
                    <Box aria-hidden="true" sx={{ position: "relative", height: "16rem" }}>
                      {chart.ticks.map(({ value, topPercent }) => (
                        <Box key={value} sx={{ position: "absolute", top: `${topPercent}%`, width: "100%", borderTop: "1px solid", borderColor: "divider" }} />
                      ))}
                      <Box sx={{ position: "absolute", top: `${chart.zeroPercent}%`, width: "100%", borderTop: "2px solid", borderColor: "text.secondary" }} />
                      {[{ series: "income", bar: incomeBar, color: "primary.main", left: "20%" }, { series: "expenses", bar: expenseBar, color: "secondary.main", left: "55%" }].map(({ series, bar, color, left }) => (
                        <Box key={series} data-series={series} data-height-percent={bar.heightPercent} sx={{ position: "absolute", top: `${bar.topPercent}%`, height: `${bar.heightPercent}%`, width: "25%", left, bgcolor: color }} />
                      ))}
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ mt: 2 }}>{label}</Typography>
                    <Box component="dl" sx={{ m: 0, mt: 1, "& dt": { color: "text.secondary" }, "& dd": { m: 0, mb: 1, overflowWrap: "anywhere" } }}>
                      <Typography component="dt" variant="caption">Income</Typography>
                      <Typography component="dd" variant="body2">{formatCurrency(income)}</Typography>
                      <Typography component="dt" variant="caption">Expenses</Typography>
                      <Typography component="dd" variant="body2">{formatCurrency(expenses)}</Typography>
                      {showSummary ? <>
                        <Typography component="dt" variant="caption">Net Balance</Typography>
                        <Typography component="dd" variant="body2" color={point.netBalance < 0 ? "error.main" : "text.primary"}>{formatCurrency(point.netBalance)}</Typography>
                      </> : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        ) : null}
        {!hasTrendData && !hasAmounts ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No transactions found in this trend range.
          </Typography>
        ) : !hasAmounts ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No income or expenses in this range.</Typography>
        ) : null}
        {showSummary ? (
          <Grid container spacing={2} aria-label="Trend summary" sx={{ mt: 2 }}>
            {summaryMetrics.map(({ label, value }) => (
              <Grid size={{ xs: 6, md: 3 }} key={label} sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
              </Grid>
            ))}
          </Grid>
        ) : null}
      </CardContent>
    </Card>
  );
};
