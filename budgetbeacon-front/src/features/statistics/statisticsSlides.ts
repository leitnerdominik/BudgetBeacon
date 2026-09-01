import type { StatisticsTimeframeValue } from "./statisticsPeriod.ts";

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

export const resolveActiveStatisticsSlideId = (
  previousSlides: readonly StatisticsSlideDefinition[],
  nextSlides: readonly StatisticsSlideDefinition[],
  activeSlideId: StatisticsSlideId | null,
): StatisticsSlideId | null => {
  if (nextSlides.length === 0) {
    return null;
  }

  if (activeSlideId && nextSlides.some(({ id }) => id === activeSlideId)) {
    return activeSlideId;
  }

  const previousIndex = activeSlideId
    ? previousSlides.findIndex(({ id }) => id === activeSlideId)
    : -1;
  const nextIndex = previousIndex < 0
    ? 0
    : Math.min(previousIndex, nextSlides.length - 1);

  return nextSlides[nextIndex]?.id ?? null;
};
