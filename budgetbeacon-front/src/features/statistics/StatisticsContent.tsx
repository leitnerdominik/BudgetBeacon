import { Box } from "@mui/material";
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
import type { MonthReference, StatisticsTimeframeValue } from "./statisticsPeriod";
import type { StatisticsView } from "./statisticsViews";

type StatisticsContentProps = {
  view: StatisticsView;
  data: StatisticsOverview | undefined;
  metrics: StatisticsMetric[];
  selectedMonth: MonthReference;
  periodLabel: string;
  isAllTime: boolean;
  isMonthlyView: boolean;
  timeframe: StatisticsTimeframeValue;
  isSmallScreen: boolean;
  onCategorySelect: (category: string) => void;
};

export const StatisticsContent = ({
  view,
  data,
  metrics,
  selectedMonth,
  periodLabel,
  isAllTime,
  isMonthlyView,
  timeframe,
  isSmallScreen,
  onCategorySelect,
}: StatisticsContentProps) => {
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

  if (view === "overview") return (
    <>
      <StatisticsMetricGrid metrics={metrics} isSmallScreen={isSmallScreen} />
      <Box
        aria-label="Overview chart and comparison"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 1fr)" },
          gap: { xs: 2, sm: 3 },
          alignItems: "start",
          minWidth: 0,
          "@media (min-width: 1200px)": {
            "@container (width < 50em)": { gridTemplateColumns: "minmax(0, 1fr)" },
          },
        }}
      >
        <MonthlyTrend
          points={data?.trend ?? []}
          granularity={data?.trendGranularity ?? (isAllTime ? "year" : "month")}
          periodLabel={periodLabel}
        />
        <MonthComparison month={selectedMonth} timeframe={timeframe} current={summary} previous={data?.previousMonthSummary} />
      </Box>
    </>
  );

  return (
    <>
      <MonthlyTrend
        showSummary
        points={data?.trend ?? []}
        granularity={data?.trendGranularity ?? (isAllTime ? "year" : "month")}
        periodLabel={periodLabel}
      />
      <PeriodOverview summary={summary} monthlyTotals={data?.monthlyTotals} periodLabel={periodLabel} />
    </>
  );
};
