import { Box, ButtonBase } from "@mui/material";
import { NavLink } from "react-router-dom";

import type { MonthReference, StatisticsTimeframeValue } from "./statisticsPeriod";
import { buildStatisticsViewLocation, STATISTICS_VIEWS } from "./statisticsViews";

type StatisticsViewNavigationProps = {
  searchParams: URLSearchParams;
  timeframe: StatisticsTimeframeValue;
  selectedMonth: MonthReference;
};

export const StatisticsViewNavigation = ({
  searchParams,
  timeframe,
  selectedMonth,
}: StatisticsViewNavigationProps) => (
  <Box
    component="nav"
    aria-label="Statistics views"
    sx={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid", borderColor: "divider", mb: 2 }}
  >
    {STATISTICS_VIEWS.map(({ id, label }) => (
      <ButtonBase
        key={id}
        component={NavLink}
        end
        to={buildStatisticsViewLocation(id, searchParams, timeframe, selectedMonth)}
        sx={{
          px: 2,
          py: 1.25,
          minHeight: 44,
          color: "text.secondary",
          borderBottom: "2px solid transparent",
          "&[aria-current='page']": { color: "primary.main", borderBottomColor: "primary.main", fontWeight: 700 },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
        }}
      >
        {label}
      </ButtonBase>
    ))}
  </Box>
);
