import assert from "node:assert/strict";
import test from "node:test";

import {
  getStatisticsSlides,
  resolveActiveStatisticsSlideId,
  STATISTICS_SLIDE_DEFINITIONS,
  type StatisticsSlideId,
} from "../src/features/statistics/statisticsSlides.ts";

const monthlyIds: StatisticsSlideId[] = [
  "kpi-overview",
  "period-overview",
  "spending-pace",
  "month-comparison",
  "categories",
  "largest-expenses",
  "trend",
];

const longerPeriodIds: StatisticsSlideId[] = [
  "kpi-overview",
  "period-overview",
  "categories",
  "largest-expenses",
  "recurring-expenses",
  "trend",
];

test("defines the statistics slides with exact IDs, labels, and order", () => {
  assert.deepEqual(
    STATISTICS_SLIDE_DEFINITIONS.map(({ id, label }) => ({ id, label })),
    [
      { id: "kpi-overview", label: "KPI Overview" },
      { id: "period-overview", label: "Period Overview" },
      { id: "spending-pace", label: "Spending Pace" },
      { id: "month-comparison", label: "Month Comparison" },
      { id: "categories", label: "Categories" },
      { id: "largest-expenses", label: "Largest Expenses" },
      { id: "recurring-expenses", label: "Recurring Expenses" },
      { id: "trend", label: "Trend" },
    ],
  );
  assert.equal(
    new Set(STATISTICS_SLIDE_DEFINITIONS.map(({ id }) => id)).size,
    STATISTICS_SLIDE_DEFINITIONS.length,
  );
});

test("shows the monthly slides and optional comparison only for one month", () => {
  assert.deepEqual(
    getStatisticsSlides({ timeframe: "1", hasMonthComparison: true }).map(
      ({ id }) => id,
    ),
    monthlyIds,
  );
  assert.deepEqual(
    getStatisticsSlides({ timeframe: "1", hasMonthComparison: false }).map(
      ({ id }) => id,
    ),
    monthlyIds.filter((id) => id !== "month-comparison"),
  );
});

test("shows the longer-period slides for every non-monthly timeframe", () => {
  for (const timeframe of ["3", "6", "12", "all"] as const) {
    assert.deepEqual(
      getStatisticsSlides({ timeframe, hasMonthComparison: true }).map(
        ({ id }) => id,
      ),
      longerPeriodIds,
    );
    assert.deepEqual(
      getStatisticsSlides({ timeframe, hasMonthComparison: false }).map(
        ({ id }) => id,
      ),
      longerPeriodIds,
    );
  }
});

test("keeps slides visible regardless of whether their datasets are empty", () => {
  assert.deepEqual(
    getStatisticsSlides({ timeframe: "3", hasMonthComparison: false }).map(
      ({ id }) => id,
    ),
    longerPeriodIds,
  );
});

test("preserves an active slide that remains visible", () => {
  const previous = getStatisticsSlides({ timeframe: "1", hasMonthComparison: true });
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(previous, next, "categories"),
    "categories",
  );
});

test("falls back to the previous index when month comparison is removed", () => {
  const previous = getStatisticsSlides({ timeframe: "1", hasMonthComparison: true });
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(previous, next, "month-comparison"),
    "categories",
  );
});

test("falls back to the previous index when recurring expenses is removed", () => {
  const previous = getStatisticsSlides({ timeframe: "3", hasMonthComparison: false });
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(previous, next, "recurring-expenses"),
    "largest-expenses",
  );
});

test("clamps removal fallback to the last new slide", () => {
  const previous = [
    ...getStatisticsSlides({ timeframe: "1", hasMonthComparison: true }),
    { ...getStatisticsSlides({ timeframe: "1", hasMonthComparison: true })[0], id: "old" as StatisticsSlideId },
  ];
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(resolveActiveStatisticsSlideId(previous, next, "old"), "trend");
});

test("uses the first new slide for an unknown active ID", () => {
  const previous = getStatisticsSlides({ timeframe: "1", hasMonthComparison: true });
  const next = getStatisticsSlides({ timeframe: "3", hasMonthComparison: false });

  assert.equal(resolveActiveStatisticsSlideId(previous, next, "unknown" as StatisticsSlideId), "kpi-overview");
});

test("returns null when there are no next slides", () => {
  assert.equal(resolveActiveStatisticsSlideId([], [], null), null);
});
