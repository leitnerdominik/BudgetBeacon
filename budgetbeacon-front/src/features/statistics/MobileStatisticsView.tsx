import { Box } from "@mui/material";
import { type ReactNode } from "react";

import { MobileStatisticsCarousel } from "../../components/MobileStatisticsCarousel";
import type { StatisticsOverview } from "../../types/api";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { MobileKeyMetricsSlide } from "./MobileKeyMetricsSlide";
import { MonthComparison } from "./MonthComparison";
import { MonthlyTrend } from "./MonthlyTrend";
import { PeriodOverview } from "./PeriodOverview";
import { RecurringExpenses } from "./RecurringExpenses";
import { SpendingPace } from "./SpendingPace";
import {
  type StatisticsSlideDefinition,
  type StatisticsSlideId,
} from "./statisticsSlides";
import type { StatisticsMetric } from "./StatisticsMetricGrid";
import type { MonthReference, StatisticsTimeframeValue } from "./statisticsPeriod";
import { TopExpenses } from "./TopExpenses";

export type MobileStatisticsViewProps = {
  data: StatisticsOverview | undefined;
  metrics: readonly StatisticsMetric[];
  selectedMonth: MonthReference;
  periodLabel: string;
  timeframe: StatisticsTimeframeValue;
  slideDefinitions: readonly StatisticsSlideDefinition[];
  activeSlideId: StatisticsSlideId | null;
  onActiveSlideChange: (slideId: StatisticsSlideId) => void;
  onCategorySelect: (category: string) => void;
};

const isVisibleStatisticsSlideId = (
  slideId: string,
  definitions: readonly StatisticsSlideDefinition[],
): slideId is StatisticsSlideId =>
  definitions.some((definition) => definition.id === slideId);

export const MobileStatisticsView = ({
  data,
  metrics,
  selectedMonth,
  periodLabel,
  timeframe,
  slideDefinitions,
  activeSlideId,
  onActiveSlideChange,
  onCategorySelect,
}: MobileStatisticsViewProps) => {
  const summary = data?.summary;
  const trendGranularity =
    data?.trendGranularity ?? (timeframe === "all" ? "year" : "month");

  const slideContent: Record<StatisticsSlideId, ReactNode> = {
    "kpi-overview": (
      <MobileKeyMetricsSlide metrics={metrics} periodLabel={periodLabel} />
    ),
    "period-overview": (
      <PeriodOverview
        layout="slide"
        monthlyTotals={data?.monthlyTotals}
        periodLabel={periodLabel}
        summary={summary}
      />
    ),
    "spending-pace": (
      <SpendingPace layout="slide" month={selectedMonth} summary={summary} />
    ),
    "month-comparison": summary && data?.previousMonthSummary ? (
      <MonthComparison
        layout="slide"
        current={summary}
        month={selectedMonth}
        previous={data.previousMonthSummary}
      />
    ) : null,
    categories: (
      <CategoryBreakdown
        categories={data?.categories ?? []}
        layout="slide"
        onCategorySelect={onCategorySelect}
        periodLabel={periodLabel}
      />
    ),
    "largest-expenses": (
      <TopExpenses
        expenses={data?.topExpenses ?? []}
        layout="slide"
        periodLabel={periodLabel}
      />
    ),
    "recurring-expenses": (
      <RecurringExpenses
        candidates={data?.recurringExpenses ?? []}
        layout="slide"
        periodLabel={periodLabel}
      />
    ),
    trend: (
      <MonthlyTrend
        granularity={trendGranularity}
        layout="slide"
        periodLabel={periodLabel}
        points={data?.trend ?? []}
      />
    ),
  };
  const slides = slideDefinitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    content: slideContent[definition.id],
  }));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <MobileStatisticsCarousel
        activeSlideId={activeSlideId}
        ariaLabel={`Statistics for ${periodLabel}`}
        onActiveSlideChange={(slideId) => {
          if (isVisibleStatisticsSlideId(slideId, slideDefinitions)) {
            onActiveSlideChange(slideId);
          }
        }}
        slides={slides}
        sx={{ flex: "1 1 auto", minHeight: 0, minWidth: 0 }}
      />
    </Box>
  );
};
