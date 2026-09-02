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

type DesktopStatisticsViewProps = {
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

  return (
    <>
      <StatisticsMetricGrid metrics={metrics} isSmallScreen={isSmallScreen} />

      <PeriodOverview
        summary={summary}
        monthlyTotals={data?.monthlyTotals}
        periodLabel={periodLabel}
      />

      {isMonthlyView ? (
        <>
          <SpendingPace month={selectedMonth} summary={summary} />
          {summary && data?.previousMonthSummary ? (
            <MonthComparison
              month={selectedMonth}
              current={summary}
              previous={data.previousMonthSummary}
            />
          ) : null}
        </>
      ) : null}

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

      <MonthlyTrend
        points={data?.trend ?? []}
        granularity={data?.trendGranularity ?? (isAllTime ? "year" : "month")}
        periodLabel={periodLabel}
      />
    </>
  );
};
