import assert from "node:assert/strict";
import test from "node:test";

import {
  getLocalCalendarDate,
  subtractCalendarMonths,
} from "../src/utils/calendarDate.ts";

test("formats a date from local calendar components", () => {
  const localJuly24 = new Date(2026, 6, 24, 0, 30);

  assert.equal(getLocalCalendarDate(localJuly24), "2026-07-24");
});

test("subtracts calendar months and clamps non-leap-year month ends", () => {
  assert.equal(subtractCalendarMonths("2026-03-31", 1), "2026-02-28");
});

test("subtracts calendar months and clamps leap-year month ends", () => {
  assert.equal(subtractCalendarMonths("2024-03-31", 1), "2024-02-29");
});

test("subtracts calendar months across year boundaries", () => {
  assert.equal(subtractCalendarMonths("2026-01-31", 1), "2025-12-31");
});
