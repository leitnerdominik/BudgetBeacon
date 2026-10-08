import {
  buildStatisticsSearchParams,
  type MonthReference,
  type StatisticsTimeframeValue,
} from "./statisticsPeriod.ts";

export type StatisticsView = "overview" | "spending" | "trends";

export const STATISTICS_VIEW_PATHS = {
  overview: "/statistics",
  spending: "/statistics/spending",
  trends: "/statistics/trends",
} as const;

export const STATISTICS_VIEWS = [
  { id: "overview", label: "Overview", path: STATISTICS_VIEW_PATHS.overview },
  { id: "spending", label: "Spending", path: STATISTICS_VIEW_PATHS.spending },
  { id: "trends", label: "Trends", path: STATISTICS_VIEW_PATHS.trends },
] as const;

export const buildStatisticsViewLocation = (
  view: StatisticsView,
  searchParams: URLSearchParams,
  timeframe: StatisticsTimeframeValue,
  selectedMonth: MonthReference,
) => ({
  pathname: STATISTICS_VIEW_PATHS[view],
  search: `?${buildStatisticsSearchParams(searchParams, timeframe, selectedMonth)}`,
});
