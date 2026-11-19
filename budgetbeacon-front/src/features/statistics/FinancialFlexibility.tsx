import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";

import type { FinancialFlexibilityStatistics, SpendingFlexibilityOverride } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { statisticsContentSx, statisticsSurfaceSx } from "./statisticsLayout";

const groupColors: Record<SpendingFlexibilityOverride, string> = {
  Essential: "primary.main",
  Optimizable: "info.main",
  Optional: "warning.main",
  Unclassified: "secondary.main",
};

const percentFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

const detailsGrid = {
  display: "grid",
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
  gap: 1.5,
  m: 0,
};

export const FinancialFlexibility = ({ report }: { report: FinancialFlexibilityStatistics }) => {
  const metrics = [
    ["Essential Expenses", report.essentialExpenses],
    ["Adjustable Expenses", report.adjustableExpenses],
  ] as const;
  const totals = [
    ["Expenses before refunds", report.grossExpenses],
    ["Refund adjustment", report.refundAdjustment],
    ["Net expenses", report.netExpenses],
  ] as const;

  return (
    <Card component="section" aria-label="Financial Flexibility" elevation={0} sx={statisticsSurfaceSx}>
      <CardContent sx={statisticsContentSx}>
        <Stack spacing={2}>
          <Box>
            <Typography component="h2" variant="h6">Financial Flexibility</Typography>
            <Typography variant="body2" color="text.secondary">
              The breakdown and both metrics use expenses before refunds. Some adjustable expenses are still necessary.
            </Typography>
          </Box>

          <Box component="dl" aria-label="Flexibility metrics" sx={detailsGrid}>
            {metrics.map(([label, amount]) => (
              <Box key={label} sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd" variant="subtitle1" sx={{ m: 0 }}>{formatCurrency(amount)}</Typography>
              </Box>
            ))}
          </Box>

          {report.grossExpenses > 0 ? (
            <Box aria-hidden="true" sx={{ display: "flex", overflow: "hidden", height: 10, borderRadius: 1 }}>
              {report.groups.map(({ classification, percentage }) => (
                <Box key={classification} sx={{ width: `${percentage}%`, flexShrink: 0, bgcolor: groupColors[classification] }} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No expenses before refunds for this period.</Typography>
          )}

          <Box component="dl" aria-label="Expense groups" sx={detailsGrid}>
            {report.groups.map(({ classification, amount, percentage }) => (
              <Box key={classification} sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "space-between" }}>
                <Stack component="dt" direction="row" spacing={0.75} alignItems="center">
                  <Box aria-hidden="true" sx={{ width: 10, height: 10, flexShrink: 0, borderRadius: "50%", bgcolor: groupColors[classification] }} />
                  <Typography component="span" variant="body2">{classification}</Typography>
                </Stack>
                <Typography component="dd" variant="body2" sx={{ m: 0, textAlign: "right" }}>
                  {formatCurrency(amount)}{" · "}{percentFormatter.format(percentage)} %
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider />

          <Stack component="dl" aria-label="Expense totals" spacing={0.75} sx={{ m: 0 }}>
            {totals.map(([label, amount]) => (
              <Box key={label} sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 0.75 }}>
                <Typography component="dt" variant="body2">{label}</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 700 }}>{formatCurrency(amount)}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
