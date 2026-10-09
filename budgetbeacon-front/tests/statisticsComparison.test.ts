import assert from "node:assert/strict";
import test from "node:test";

import { describeStatisticsChange } from "../src/features/statistics/statisticsComparison.ts";

test("describes zero baselines without division by zero, including negative new balances", () => {
  assert.deepEqual(describeStatisticsChange(0, 0, "increase"), { label: "Unchanged (0 %)", color: "text.secondary" });
  assert.deepEqual(describeStatisticsChange(10, 0, "increase"), { label: "New (increased from zero)", color: "success.main" });
  assert.deepEqual(describeStatisticsChange(-10, 0, "increase"), { label: "New (decreased from zero)", color: "error.main" });
  assert.deepEqual(describeStatisticsChange(10, 0, "decrease"), { label: "New (increased from zero)", color: "error.main" });
});

test("preserves percentages and favorable direction for income and expense magnitudes", () => {
  assert.deepEqual(describeStatisticsChange(120, 100, "increase"), { label: "Increased (+20 %)", color: "success.main" });
  assert.deepEqual(describeStatisticsChange(75, 100, "increase"), { label: "Decreased (-25 %)", color: "error.main" });
  assert.deepEqual(describeStatisticsChange(75, 100, "decrease"), { label: "Decreased (-25 %)", color: "success.main" });
  assert.deepEqual(describeStatisticsChange(120, 100, "decrease"), { label: "Increased (+20 %)", color: "error.main" });
  assert.deepEqual(describeStatisticsChange(0, 100, "decrease"), { label: "Decreased (-100 %)", color: "success.main" });
  assert.equal(describeStatisticsChange(2, 3, "increase").label, "Decreased (-33,3 %)");
});

test("uses an absolute baseline for negative balances and crossings through zero", () => {
  assert.deepEqual(describeStatisticsChange(-50, -100, "increase"), { label: "Increased (+50 %)", color: "success.main" });
  assert.deepEqual(describeStatisticsChange(-150, -100, "increase"), { label: "Decreased (-50 %)", color: "error.main" });
  assert.deepEqual(describeStatisticsChange(100, -100, "increase"), { label: "Increased (+200 %)", color: "success.main" });
  assert.deepEqual(describeStatisticsChange(-100, 100, "increase"), { label: "Decreased (-200 %)", color: "error.main" });
  assert.equal(describeStatisticsChange(0, -100, "increase").label, "Increased (+100 %)");
});

test("makes unchanged amounts neutral and retains transaction comparisons without judging activity", () => {
  for (const value of [100, -100, 0.25]) {
    assert.deepEqual(describeStatisticsChange(value, value, "increase"), { label: "Unchanged (0 %)", color: "text.secondary" });
    assert.deepEqual(describeStatisticsChange(value, value, "decrease"), { label: "Unchanged (0 %)", color: "text.secondary" });
  }
  assert.deepEqual(describeStatisticsChange(6, 4), { label: "Increased (+50 %)", color: "primary.main" });
  assert.deepEqual(describeStatisticsChange(2, 4), { label: "Decreased (-50 %)", color: "primary.main" });
});
