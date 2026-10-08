import type { ReactNode } from "react";
import { Box, Card, Typography } from "@mui/material";

export type StatisticsMetric = {
  color: string;
  icon: ReactNode;
  label: string;
  value: string | number;
};

type StatisticsMetricGridProps = {
  metrics: readonly StatisticsMetric[];
  isSmallScreen: boolean;
};

export const StatisticsMetricGrid = ({
  metrics,
  isSmallScreen,
}: StatisticsMetricGridProps) => (
  <Box
    component="section"
    aria-label="Headline metrics"
    sx={{ containerType: "inline-size", minWidth: 0 }}
  >
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
        gap: { xs: 1.25, sm: 2 },
        m: 0,
        "@container (width < 20em)": { gridTemplateColumns: "minmax(0, 1fr)" },
      }}
    >
      {metrics.map((metric) => (
        <Card
          elevation={0}
          key={metric.label}
          sx={{
            minWidth: 0,
            p: isSmallScreen ? 1.5 : 2.25,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
            boxShadow: "none",
          }}
        >
          <Typography
            component="dt"
            variant="overline"
            color="text.secondary"
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, lineHeight: 1.4 }}
          >
            <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{metric.label}</Box>
            <Box component="span" aria-hidden="true" sx={{ display: "flex", flexShrink: 0 }}>
              {metric.icon}
            </Box>
          </Typography>
          <Typography
            component="dd"
            variant={isSmallScreen ? "h6" : "h5"}
            fontWeight={700}
            color={metric.color}
            sx={{ m: 0, mt: 1, minWidth: 0, lineHeight: 1.2, overflowWrap: "anywhere" }}
          >
            {metric.value}
          </Typography>
        </Card>
      ))}
    </Box>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, overflowWrap: "anywhere" }}>
      Savings Rate is net balance as a share of income. It is distinct from Saved / Invested.
    </Typography>
  </Box>
);
