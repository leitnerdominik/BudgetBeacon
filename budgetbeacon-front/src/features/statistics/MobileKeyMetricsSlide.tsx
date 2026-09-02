import { Box, Card, CardContent, Typography } from "@mui/material";

import type { StatisticsMetric } from "./StatisticsMetricGrid";

export type MobileKeyMetricsSlideProps = {
  metrics: readonly StatisticsMetric[];
  periodLabel: string;
};

export const MobileKeyMetricsSlide = ({
  metrics,
  periodLabel,
}: MobileKeyMetricsSlideProps) => (
  <Box
    component="section"
    aria-label={`Key metrics for ${periodLabel}`}
    sx={{
      containerType: "inline-size",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      minWidth: 0,
    }}
  >
    <Box
      aria-label={`Key metrics for ${periodLabel}`}
      role="region"
      tabIndex={0}
      sx={{
        display: "grid",
        flex: "1 1 auto",
        gap: 0.75,
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(3, minmax(min-content, 1fr))",
        minHeight: 0,
        minWidth: 0,
        overflowY: "auto",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
        "@container (width < 288px)": {
          gap: 0.5,
          gridTemplateColumns: "minmax(0, 1fr)",
          gridTemplateRows: "repeat(6, minmax(min-content, 1fr))",
        },
      }}
    >
      {metrics.map((metric) => (
        <Card
          elevation={1}
          key={metric.label}
          sx={{
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            height: "100%",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <CardContent
            sx={{
              "&:last-child": { pb: 1 },
              alignItems: "stretch",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              height: "100%",
              justifyContent: "space-between",
              maxWidth: "100%",
              minWidth: 0,
              p: 1,
              "@container (width < 288px)": {
                alignItems: "center",
                flexDirection: "row",
                gap: 0.75,
                p: 0.75,
                "&:last-child": { pb: 0.75 },
              },
            }}
          >
            <Box
              sx={{
                alignItems: "center",
                display: "flex",
                flex: "1 1 auto",
                gap: 0.75,
                justifyContent: "space-between",
                maxWidth: "100%",
                minWidth: 0,
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{
                  lineHeight: 1.35,
                  maxWidth: "100%",
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {metric.label}
              </Typography>
              <Box
                sx={{
                  color: metric.color,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                {metric.icon}
              </Box>
            </Box>
            <Typography
              variant="h6"
              fontWeight={700}
              color={metric.color}
              sx={{
                fontSize: "1rem",
                lineHeight: 1.2,
                maxWidth: "100%",
                minWidth: 0,
                overflowWrap: "anywhere",
                "@container (width < 288px)": {
                  flex: "0 1 55%",
                  fontSize: "0.875rem",
                  textAlign: "right",
                },
              }}
            >
              {metric.value}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  </Box>
);
