import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStatisticsSearchParams,
  formatPeriodLabel,
  getCurrentMonthSelection,
  parseMonthInputValue,
  parseTimeframeValue,
  shiftMonth,
  toMonthInputValue,
  type StatisticsTimeframeValue,
} from "../src/features/statistics/statisticsPeriod.ts";

test("accepts every supported statistics timeframe", () => {
  const supportedValues: StatisticsTimeframeValue[] = ["all", "12", "6", "3", "1"];

  for (const value of supportedValues) {
    assert.equal(parseTimeframeValue(value), value);
  }
});

test("defaults missing, empty, and unsupported timeframes to one month", () => {
  assert.equal(parseTimeframeValue(null), "1");
  assert.equal(parseTimeframeValue(""), "1");
  assert.equal(parseTimeframeValue("2"), "1");
});

test("parses valid months at the supported boundaries", () => {
  assert.deepEqual(parseMonthInputValue("2000-01"), { year: 2000, month: 1 });
  assert.deepEqual(parseMonthInputValue("2100-12"), { year: 2100, month: 12 });
  assert.deepEqual(parseMonthInputValue("2026-1"), { year: 2026, month: 1 });
});

test("rejects nonnumeric, noninteger, and out-of-range months", () => {
  const invalidValues = [
    "not-a-month",
    "2026-month",
    "2026-1.5",
    "2026-00",
    "2026-13",
    "1999-12",
    "2101-01",
  ];

  for (const value of invalidValues) {
    assert.equal(parseMonthInputValue(value), null);
  }
});

test("formats month input values with a two-digit month", () => {
  assert.equal(toMonthInputValue({ year: 2026, month: 2 }), "2026-02");
});

test("derives the current month from an injected date", () => {
  assert.deepEqual(getCurrentMonthSelection(new Date(2026, 0, 15, 23, 59)), {
    year: 2026,
    month: 1,
  });
});

test("shifts months across year boundaries without clamping", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), {
    year: 2025,
    month: 12,
  });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), {
    year: 2027,
    month: 1,
  });
  assert.deepEqual(shiftMonth({ year: 2000, month: 1 }, -1), {
    year: 1999,
    month: 12,
  });
});

test("formats all-time, monthly, and cross-year period labels", () => {
  assert.equal(formatPeriodLabel("all", { year: 2026, month: 1 }), "All time");
  assert.equal(formatPeriodLabel("1", { year: 2026, month: 1 }), "Januar 2026");
  assert.equal(
    formatPeriodLabel("3", { year: 2026, month: 1 }),
    "November 2025 - Januar 2026",
  );
});

test("builds bounded statistics parameters without mutating unrelated state", () => {
  const current = new URLSearchParams(
    "category=Food&timeframe=1&month=2026-02&page=2",
  );
  const original = current.toString();

  const next = buildStatisticsSearchParams(current, "3", {
    year: 2026,
    month: 4,
  });

  assert.equal(next.get("timeframe"), "3");
  assert.equal(next.get("month"), "2026-04");
  assert.equal(next.get("category"), "Food");
  assert.equal(next.get("page"), "2");
  assert.equal(current.toString(), original);
});

test("removes the month while preserving unrelated parameters for all time", () => {
  const current = new URLSearchParams("timeframe=1&month=2026-02&source=dashboard");

  const next = buildStatisticsSearchParams(current, "all", {
    year: 2026,
    month: 2,
  });

  assert.equal(next.get("timeframe"), "all");
  assert.equal(next.has("month"), false);
  assert.equal(next.get("source"), "dashboard");
});
