import { Typography } from "@mui/material";

import type { MonthlySummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";

export const StatisticsExclusionNotice = ({ summary }: { summary: MonthlySummary | undefined }) => {
  const excludedTotal = (summary?.internalTransferTotal ?? 0) + (summary?.adjustmentTotal ?? 0);
  if (excludedTotal <= 0) return null;

  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, overflowWrap: "anywhere" }}>
      Excluded {formatCurrency(excludedTotal)}. Internal transfers and adjustments are excluded from income,
      expenses, net balance, savings rate, and spending charts.
    </Typography>
  );
};
