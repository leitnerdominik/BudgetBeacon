import assert from "node:assert/strict";
import test from "node:test";

import {
  getStatisticsSlides,
  getStatisticsViewSlides,
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
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(next, "categories"),
    "categories",
  );
});

test("falls back to KPI Overview when month comparison is removed", () => {
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(next, "month-comparison"),
    "kpi-overview",
  );
});

test("falls back to KPI Overview when spending pace is removed", () => {
  const next = getStatisticsSlides({ timeframe: "3", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(next, "spending-pace"),
    "kpi-overview",
  );
});

test("falls back to KPI Overview when recurring expenses is removed", () => {
  const next = getStatisticsSlides({ timeframe: "1", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(next, "recurring-expenses"),
    "kpi-overview",
  );
});

test("uses the first visible slide for a null active ID", () => {
  const next = getStatisticsSlides({ timeframe: "3", hasMonthComparison: false });

  assert.equal(resolveActiveStatisticsSlideId(next, null), "kpi-overview");
});

test("uses the first visible slide for an unknown active ID", () => {
  const next = getStatisticsSlides({ timeframe: "3", hasMonthComparison: false });

  assert.equal(
    resolveActiveStatisticsSlideId(next, "unknown" as StatisticsSlideId),
    "kpi-overview",
  );
});

test("returns null when there are no next slides", () => {
  assert.equal(resolveActiveStatisticsSlideId([], null), null);
});

test("groups all existing sections into distinct destinations with Spending in the specified order", () => {
  const context = { timeframe: "1", hasMonthComparison: true } as const;
  assert.deepEqual(getStatisticsViewSlides("overview", context).map(({ id }) => id), ["kpi-overview", "month-comparison", "trend"]);
  assert.deepEqual(getStatisticsViewSlides("spending", context).map(({ id }) => id), ["categories", "largest-expenses", "spending-pace"]);
  assert.deepEqual(getStatisticsViewSlides("trends", context).map(({ id }) => id), ["trend", "period-overview"]);
  for (const timeframe of ["3", "6", "12", "all"] as const) {
    assert.deepEqual(getStatisticsViewSlides("spending", { timeframe, hasMonthComparison: true }).map(({ id }) => id), ["categories", "largest-expenses", "recurring-expenses"]);
    assert.deepEqual(getStatisticsViewSlides("overview", { timeframe, hasMonthComparison: true }).map(({ id }) => id), ["kpi-overview", "trend"]);
  }
});

test("keeps all range-supported sections reachable across views, including empty datasets", () => {
  for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
    for (const hasMonthComparison of [true, false]) {
      const context = { timeframe, hasMonthComparison };
      const reachable = new Set(["overview", "spending", "trends"].flatMap((view) => getStatisticsViewSlides(view as "overview" | "spending" | "trends", context).map(({ id }) => id)));
      assert.deepEqual([...reachable].sort(), getStatisticsSlides(context).map(({ id }) => id).sort());
    }
  }
});

test("view changes and range changes fall back to the first available destination slide", () => {
  const spending = getStatisticsViewSlides("spending", { timeframe: "1", hasMonthComparison: false });
  assert.equal(resolveActiveStatisticsSlideId(spending, "kpi-overview"), "categories");
  assert.equal(resolveActiveStatisticsSlideId(spending, "categories"), "categories");
  assert.equal(resolveActiveStatisticsSlideId(spending, "recurring-expenses"), "categories");
  const longer = getStatisticsViewSlides("spending", { timeframe: "3", hasMonthComparison: false });
  assert.equal(resolveActiveStatisticsSlideId(longer, "spending-pace"), "categories");
  assert.equal(resolveActiveStatisticsSlideId(getStatisticsViewSlides("trends", { timeframe: "1", hasMonthComparison: false }), "categories"), "trend");
  assert.equal(resolveActiveStatisticsSlideId(getStatisticsViewSlides("overview", { timeframe: "1", hasMonthComparison: false }), "month-comparison"), "kpi-overview");
});
