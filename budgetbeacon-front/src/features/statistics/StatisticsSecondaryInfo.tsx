import { Box, Typography } from "@mui/material";

import type { MonthlySummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { describeStatisticsChange } from "./statisticsComparison";
import { formatMonthLabel, shiftMonth, type MonthReference } from "./statisticsPeriod";

type StatisticsSecondaryInfoProps = {
  summary: MonthlySummary | undefined;
  previous: MonthlySummary | null | undefined;
  month: MonthReference;
};

export const StatisticsSecondaryInfo = ({ summary, previous, month }: StatisticsSecondaryInfoProps) => (
  <Box component="section" aria-label="Additional period information" sx={{ mt: 2, minWidth: 0 }}>
    <Box component="dl" sx={{ display: "flex", flexWrap: "wrap", columnGap: 3, rowGap: 1, m: 0 }}>
      {[
        { label: "Saved / Invested", value: formatCurrency(summary?.totalSavedOrInvested ?? 0) },
        { label: "Transactions", value: summary?.transactionCount ?? 0 },
      ].map(({ label, value }) => (
        <Box key={label} sx={{ display: "flex", flexWrap: "wrap", gap: 1, minWidth: 0, maxWidth: "100%" }}>
          <Typography component="dt" variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {value}
            {label === "Transactions" && summary && previous ? (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
                {formatMonthLabel(month)} vs {formatMonthLabel(shiftMonth(month, -1))}: Previous {previous.transactionCount}; {describeStatisticsChange(summary.transactionCount, previous.transactionCount).label}
              </Typography>
            ) : null}
          </Typography>
        </Box>
      ))}
    </Box>
  </Box>
);
