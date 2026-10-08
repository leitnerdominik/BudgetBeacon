import { Box } from "@mui/material";

import { StatisticsMetricGrid, type StatisticsMetric } from "./StatisticsMetricGrid";

export type MobileKeyMetricsSlideProps = {
  metrics: readonly StatisticsMetric[];
  periodLabel: string;
};

export const MobileKeyMetricsSlide = ({
  metrics,
  periodLabel,
}: MobileKeyMetricsSlideProps) => (
  <Box
    aria-label={`Key metrics for ${periodLabel}`}
    role="region"
    tabIndex={0}
    sx={{
      height: "100%",
      boxSizing: "border-box",
      minHeight: 0,
      minWidth: 0,
      overflowY: "auto",
      p: 0.5,
      "&:focus-visible": {
        outline: "none",
        boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
      },
    }}
  >
    <StatisticsMetricGrid metrics={metrics} isSmallScreen />
  </Box>
);
