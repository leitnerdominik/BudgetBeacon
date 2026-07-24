import assert from "node:assert/strict";
import test from "node:test";

import { tipsQueryKeys } from "../src/features/tips/tipsCache.ts";
import {
  getTipsTimeframeParams,
  getTipsTransactionDateRange,
  type TipsTimeframeValue,
} from "../src/features/tips/tipsTimeframes.ts";

const asOfDate = "2026-03-31";

test("creates inclusive transaction ranges for every tips timeframe", () => {
  const expectedRanges: Record<
    TipsTimeframeValue,
    { startDate: string; endDate: string }
  > = {
    "all-time": { startDate: "", endDate: asOfDate },
    "12-months": { startDate: "2025-03-31", endDate: asOfDate },
    "6-months": { startDate: "2025-09-30", endDate: asOfDate },
    "3-months": { startDate: "2025-12-31", endDate: asOfDate },
    "1-month": { startDate: "2026-02-28", endDate: asOfDate },
  };

  for (const [timeframe, expected] of Object.entries(expectedRanges)) {
    assert.deepEqual(
      getTipsTransactionDateRange(timeframe as TipsTimeframeValue, asOfDate),
      expected,
    );
  }
});

test("includes the authoritative date in relative and all-time API params", () => {
  assert.deepEqual(getTipsTimeframeParams("1-month", asOfDate), {
    monthsBack: 1,
    asOfDate,
  });
  assert.deepEqual(getTipsTimeframeParams("all-time", asOfDate), {
    allTime: true,
    asOfDate,
  });
});

test("changes the tips query key when the local calendar date changes", () => {
  const firstDay = tipsQueryKeys.byUserTimeframeAndDate(
    "user-1",
    "3-months",
    "2026-03-31",
  );
  const nextDay = tipsQueryKeys.byUserTimeframeAndDate(
    "user-1",
    "3-months",
    "2026-04-01",
  );

  assert.notDeepEqual(firstDay, nextDay);
});
