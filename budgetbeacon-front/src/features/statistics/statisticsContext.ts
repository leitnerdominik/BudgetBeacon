import type { StatisticsOverview } from "../../types/api";
import type { MonthReference, StatisticsTimeframeValue } from "./statisticsPeriod";

export type StatisticsContext = {
  data: StatisticsOverview | undefined;
  timeframe: StatisticsTimeframeValue;
  selectedMonth: MonthReference;
  periodLabel: string;
  isSmallScreen: boolean;
  isMobileView: boolean;
  onCategorySelect: (category: string) => void;
};
