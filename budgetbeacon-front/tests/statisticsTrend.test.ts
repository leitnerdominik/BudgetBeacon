import assert from "node:assert/strict";
import test from "node:test";
import { formatTrendPointLabel, prepareStatisticsChart } from "../src/features/statistics/statisticsTrend.ts";
import type { StatisticsTrendPoint } from "../src/types/api.ts";
import { formatCurrency } from "../src/utils/formatDate.ts";

const point = (year: number, month: number | null = 1, income = 100, expense = -50): StatisticsTrendPoint => ({
  year, month, totalIncome: income, totalExpense: expense, netBalance: income + expense,
  totalSavedOrInvested: 0, internalTransferTotal: 0, adjustmentTotal: 0,
  transactionCount: 1, analyticsTransactionCount: 1,
});

test("empty and returned zero points have a finite zero scale without invented bars", () => {
  assert.deepEqual(prepareStatisticsChart([]), { zeroPercent: 100, ticks: [{ value: 0, topPercent: 100 }], points: [] });
  const chart = prepareStatisticsChart([point(2026, 1, 0, 0)]);
  assert.equal(chart.points.length, 1);
  assert.equal(chart.points[0].incomeBar.heightPercent, 0);
  assert.equal(chart.points[0].expenseBar.heightPercent, 0);
  assert.deepEqual(chart.ticks, [{ value: 0, topPercent: 100 }]);
});

test("preserves every point across all supported ranges, sorting December/January and long yearly history", () => {
  for (const count of [1, 3, 6, 12]) {
    const input = Array.from({ length: count }, (_, i) => point(i === 0 ? 2025 : 2026, i === 0 ? 12 : i)).reverse();
    const chart = prepareStatisticsChart(input);
    assert.equal(chart.points.length, count);
    assert.deepEqual(chart.points.map(({ point: p }) => [p.year, p.month]), [...input].reverse().map((p) => [p.year, p.month]));
  }
  const years = Array.from({ length: 150 }, (_, i) => point(1877 + i, null)).reverse();
  assert.deepEqual(prepareStatisticsChart(years).points.map(({ label }) => label), years.map((p) => String(p.year)).reverse());
});

test("monthly labels name the full year and calendar month without timezone shifts; yearly labels contain only years", () => {
  assert.equal(formatTrendPointLabel(point(2025, 12)), "Dez. 2025");
  assert.equal(formatTrendPointLabel(point(2026, 1)), "Jan. 2026");
  assert.equal(formatTrendPointLabel(point(2026, null)), "2026");
});

test("scales both series against the same maximum without a positive minimum height", () => {
  const chart = prepareStatisticsChart([point(2026, 1, 100, -50), point(2026, 2, 0.01, 0)]);
  assert.deepEqual(chart.points[0].incomeBar, { heightPercent: 100, topPercent: 0 });
  assert.deepEqual(chart.points[0].expenseBar, { heightPercent: 50, topPercent: 50 });
  assert.equal(chart.points[1].incomeBar.heightPercent, 0.01);
  assert.equal(chart.points[1].expenseBar.heightPercent, 0);
  assert.deepEqual(chart.ticks, [100, 75, 50, 25, 0].map((value) => ({ value, topPercent: 100 - value })));
});

test("sub-unit amounts use their actual maximum, and either series can be absent", () => {
  for (const [income, expense] of [[0.25, 0], [0, -0.25], [0, 0.25]]) {
    const chart = prepareStatisticsChart([point(2026, 1, income, expense)]);
    assert.equal(chart.points[0].incomeBar.heightPercent, income === 0 ? 0 : 100);
    assert.equal(chart.points[0].expenseBar.heightPercent, expense === 0 ? 0 : 100);
    assert.equal(chart.ticks[0].value, 0.25);
    assert.equal(chart.points[0].expenses, Math.abs(expense));
  }
});

test("cent-sized ranges have distinct readable currency ticks without changing proportions", () => {
  for (const max of [0.01, 0.02, 0.03, 0.04, 0.05]) {
    for (const [income, expense] of [[max, 0], [-max, 0], [0, -max], [0, max], [-max, -max]]) {
      const chart = prepareStatisticsChart([point(2026, 1, income, expense)]);
      const labels = chart.ticks.map(({ value }) => formatCurrency(value));
      assert.equal(new Set(labels).size, labels.length);
      const activeHeight = income < 0 && expense !== 0 ? 50 : 100;
      assert.equal(chart.points[0].incomeBar.heightPercent, income === 0 ? 0 : activeHeight);
      assert.equal(chart.points[0].expenseBar.heightPercent, expense === 0 ? 0 : activeHeight);
    }
  }
  assert.deepEqual(prepareStatisticsChart([point(2026, 1, 0.01, 0)]).ticks, [
    { value: 0.01, topPercent: 0 }, { value: 0, topPercent: 100 },
  ]);
});

test("large values preserve ratios and signed income uses a shared zero baseline without overflow", () => {
  const chart = prepareStatisticsChart([point(2026, 1, Number.MAX_VALUE, -Number.MAX_VALUE / 2), point(2026, 2, -Number.MAX_VALUE, 0)]);
  assert.equal(chart.zeroPercent, 50);
  assert.deepEqual(chart.points[0].incomeBar, { heightPercent: 50, topPercent: 0 });
  assert.deepEqual(chart.points[0].expenseBar, { heightPercent: 25, topPercent: 25 });
  assert.deepEqual(chart.points[1].incomeBar, { heightPercent: 50, topPercent: 50 });
  assert.equal(chart.points[1].income, -Number.MAX_VALUE);
  for (const tick of chart.ticks) {
    assert.ok(Number.isFinite(tick.value));
    assert.ok(Number.isFinite(tick.topPercent));
    assert.ok(tick.topPercent >= 0 && tick.topPercent <= 100);
  }
  const negativeOnly = prepareStatisticsChart([point(2026, 1, -100, 0)]);
  assert.equal(negativeOnly.zeroPercent, 0);
  assert.deepEqual(negativeOnly.points[0].incomeBar, { heightPercent: 100, topPercent: 0 });
});

test("does not mutate frozen server arrays or financial values while preparing chart data", () => {
  const input = Object.freeze([Object.freeze(point(2026, 2, 10.35, -8.12)), Object.freeze(point(2026, 1, 1, -0.01))]);
  const before = structuredClone(input);
  const chart = prepareStatisticsChart(input);
  assert.deepEqual(input, before);
  assert.notStrictEqual(chart.points, input);
  assert.equal(chart.points[1].point.netBalance, input[0].netBalance);
  assert.equal(chart.points[1].income, 10.35);
  assert.equal(chart.points[1].expenses, 8.12);
});
