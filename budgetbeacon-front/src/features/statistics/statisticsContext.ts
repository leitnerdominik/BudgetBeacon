import type { StatisticsOverview } from "../../types/api";
import type { MonthReference, StatisticsTimeframeValue } from "./statisticsPeriod";

export type CategorySpendingMetric = "median" | "total";

export type StatisticsContext = {
  data: StatisticsOverview | undefined;
  timeframe: StatisticsTimeframeValue;
  selectedMonth: MonthReference;
  periodLabel: string;
  isSmallScreen: boolean;
  isMobileView: boolean;
  categorySpendingMetric: CategorySpendingMetric;
  onCategorySpendingMetricChange: (metric: CategorySpendingMetric) => void;
  onCategorySelect: (category: string) => void;
  unclassifiedTransactionsPath: string;
};
