import type { StatisticsTimeframeValue } from "./statisticsPeriod.ts";
import type { StatisticsView } from "./statisticsViews.ts";

export type StatisticsSlideId =
  | "kpi-overview"
  | "period-overview"
  | "spending-pace"
  | "month-comparison"
  | "categories"
  | "largest-expenses"
  | "recurring-expenses"
  | "trend";

export type StatisticsSlideContext = {
  timeframe: StatisticsTimeframeValue;
  hasMonthComparison: boolean;
};

export type StatisticsSlideVisibility = {
  timeframes: readonly StatisticsTimeframeValue[];
  requiresMonthComparison?: boolean;
};

export type StatisticsSlideDefinition = {
  id: StatisticsSlideId;
  label: string;
  visibility: StatisticsSlideVisibility;
};

export const STATISTICS_SLIDE_DEFINITIONS: readonly StatisticsSlideDefinition[] = [
  {
    id: "kpi-overview",
    label: "KPI Overview",
    visibility: { timeframes: ["1", "3", "6", "12", "all"] },
  },
  {
    id: "period-overview",
    label: "Period Overview",
    visibility: { timeframes: ["1", "3", "6", "12", "all"] },
  },
  {
    id: "spending-pace",
    label: "Spending Pace",
    visibility: { timeframes: ["1"] },
  },
  {
    id: "month-comparison",
    label: "Month Comparison",
    visibility: {
      timeframes: ["1"],
      requiresMonthComparison: true,
    },
  },
  {
    id: "categories",
    label: "Categories",
    visibility: { timeframes: ["1", "3", "6", "12", "all"] },
  },
  {
    id: "largest-expenses",
    label: "Largest Expenses",
    visibility: { timeframes: ["1", "3", "6", "12", "all"] },
  },
  {
    id: "recurring-expenses",
    label: "Recurring Expenses",
    visibility: { timeframes: ["3", "6", "12", "all"] },
  },
  {
    id: "trend",
    label: "Trend",
    visibility: { timeframes: ["1", "3", "6", "12", "all"] },
  },
];

export const getStatisticsSlides = (
  context: StatisticsSlideContext,
): readonly StatisticsSlideDefinition[] =>
  STATISTICS_SLIDE_DEFINITIONS.filter(({ visibility }) => {
    if (!visibility.timeframes.includes(context.timeframe)) {
      return false;
    }

    return !visibility.requiresMonthComparison || context.hasMonthComparison;
  });

const viewSlideIds: Record<StatisticsView, readonly StatisticsSlideId[]> = {
  overview: ["kpi-overview", "month-comparison", "trend"],
  spending: ["categories", "largest-expenses", "recurring-expenses", "spending-pace"],
  trends: ["trend", "period-overview"],
};

export const getStatisticsViewSlides = (
  view: StatisticsView,
  context: StatisticsSlideContext,
): readonly StatisticsSlideDefinition[] => {
  const available = getStatisticsSlides(context);
  return viewSlideIds[view].flatMap((id) =>
    available.filter((definition) => definition.id === id),
  );
};

export const resolveActiveStatisticsSlideId = (
  nextSlides: readonly StatisticsSlideDefinition[],
  activeSlideId: StatisticsSlideId | null,
): StatisticsSlideId | null => {
  if (nextSlides.length === 0) {
    return null;
  }

  if (activeSlideId && nextSlides.some(({ id }) => id === activeSlideId)) {
    return activeSlideId;
  }

  return nextSlides[0].id;
};
