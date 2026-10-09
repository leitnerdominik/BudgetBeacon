import type { StatisticsOverview } from "../../types/api";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { MonthComparison } from "./MonthComparison";
import { MonthlyTrend } from "./MonthlyTrend";
import { PeriodOverview } from "./PeriodOverview";
import { RecurringExpenses } from "./RecurringExpenses";
import { SpendingPace } from "./SpendingPace";
import {
  StatisticsMetricGrid,
  type StatisticsMetric,
} from "./StatisticsMetricGrid";
import { TopExpenses } from "./TopExpenses";
import type { MonthReference } from "./statisticsPeriod";
import type { StatisticsView } from "./statisticsViews";

type DesktopStatisticsViewProps = {
  view: StatisticsView;
  data: StatisticsOverview | undefined;
  metrics: StatisticsMetric[];
  selectedMonth: MonthReference;
  periodLabel: string;
  isAllTime: boolean;
  isMonthlyView: boolean;
  isSmallScreen: boolean;
  onCategorySelect: (category: string) => void;
};

export const DesktopStatisticsView = ({
  view,
  data,
  metrics,
  selectedMonth,
  periodLabel,
  isAllTime,
  isMonthlyView,
  isSmallScreen,
  onCategorySelect,
}: DesktopStatisticsViewProps) => {
  const summary = data?.summary;

  if (view === "spending") return (
    <>
      <CategoryBreakdown
        categories={data?.categories ?? []}
        onCategorySelect={onCategorySelect}
        periodLabel={periodLabel}
      />

      <TopExpenses expenses={data?.topExpenses ?? []} periodLabel={periodLabel} />

      {!isMonthlyView ? (
        <RecurringExpenses
          candidates={data?.recurringExpenses ?? []}
          periodLabel={periodLabel}
        />
      ) : null}
      {isMonthlyView ? <SpendingPace month={selectedMonth} summary={summary} /> : null}
    </>
  );

  return (
    <>
      {view === "overview" ? (
        <>
          <StatisticsMetricGrid metrics={metrics} isSmallScreen={isSmallScreen} />
          {isMonthlyView && summary && data?.previousMonthSummary ? (
            <MonthComparison month={selectedMonth} current={summary} previous={data.previousMonthSummary} />
          ) : null}
        </>
      ) : null}
      <MonthlyTrend
        showSummary={view === "trends"}
        points={data?.trend ?? []}
        granularity={data?.trendGranularity ?? (isAllTime ? "year" : "month")}
        periodLabel={periodLabel}
      />
      {view === "trends" ? (
        <PeriodOverview summary={summary} monthlyTotals={data?.monthlyTotals} periodLabel={periodLabel} />
      ) : null}
    </>
  );
};
