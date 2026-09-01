import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export type StatisticsMetric = {
  color: string;
  icon: ReactNode;
  label: string;
  value: string | number;
};

type StatisticsMetricGridProps = {
  metrics: StatisticsMetric[];
  isSmallScreen: boolean;
};

export const StatisticsMetricGrid = ({
  metrics,
  isSmallScreen,
}: StatisticsMetricGridProps) => (
  <Grid container spacing={{ xs: 1.25, sm: 2 }}>
    {metrics.map((metric) => (
      <Grid size={{ xs: 6, sm: 6, lg: 2 }} key={metric.label}>
        <Card
          elevation={1}
          sx={{
            height: "100%",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2.25 } }}>
            <Stack spacing={{ xs: 1, sm: 1.5 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="overline" color="text.secondary">
                  {metric.label}
                </Typography>
                <Box sx={{ color: metric.color, display: "flex" }}>
                  {metric.icon}
                </Box>
              </Stack>
              <Typography
                variant={isSmallScreen ? "h6" : "h5"}
                fontWeight={700}
                color={metric.color}
                sx={{
                  fontSize: { xs: "1rem", sm: "1.5rem" },
                  lineHeight: 1.2,
                  overflowWrap: "anywhere",
                }}
              >
                {metric.value}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);
