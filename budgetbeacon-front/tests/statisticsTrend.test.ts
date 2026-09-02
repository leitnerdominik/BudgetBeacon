import assert from "node:assert/strict";
import test from "node:test";

import {
  getCondensedTrendPoints,
  MOBILE_TREND_POINT_LIMIT,
} from "../src/features/statistics/statisticsTrend.ts";
import type { StatisticsTrendPoint } from "../src/types/api.ts";

const trendPoint = (year: number, month: number | null = 1): StatisticsTrendPoint => ({
  year,
  month,
  totalIncome: year,
  totalExpense: -year,
  netBalance: 0,
  totalSavedOrInvested: 0,
  internalTransferTotal: 0,
  adjustmentTotal: 0,
  transactionCount: 1,
  analyticsTransactionCount: 1,
});

test("returns an empty new array when the trend has no points", () => {
  const points: StatisticsTrendPoint[] = [];
  const condensed = getCondensedTrendPoints(points);

  assert.deepEqual(condensed, []);
  assert.notStrictEqual(condensed, points);
});

test("keeps every point when fewer than six are available", () => {
  const points = [trendPoint(2022), trendPoint(2023), trendPoint(2024)];

  assert.deepEqual(getCondensedTrendPoints(points), points);
});

test("keeps every point when exactly six are available", () => {
  const points = [2020, 2021, 2022, 2023, 2024, 2025].map((year) => trendPoint(year));

  assert.deepEqual(getCondensedTrendPoints(points), points);
});

test("returns the newest six points in their original chronological order", () => {
  const points = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => trendPoint(year));

  assert.equal(MOBILE_TREND_POINT_LIMIT, 6);
  assert.deepEqual(
    getCondensedTrendPoints(points).map((point) => point.year),
    [2020, 2021, 2022, 2023, 2024, 2025],
  );
});

test("does not mutate the input while selecting the newest six points", () => {
  const points = [2018, 2019, 2020, 2021, 2022, 2023, 2024].map((year) => trendPoint(year));
  const originalOrder = points.map((point) => point.year);

  getCondensedTrendPoints(points);

  assert.deepEqual(points.map((point) => point.year), originalOrder);
});
