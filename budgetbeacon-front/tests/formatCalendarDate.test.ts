import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { formatCalendarDate } from "../src/utils/formatDate.ts";

const cases: [string, string][] = [
  ["2026-04-03", "03. Apr. 2026"],
  ["2026-04-03T00:00:00Z", "03. Apr. 2026"],
  ["2026-04-03T23:30:00Z", "03. Apr. 2026"],
  ["2026-04-03T00:00:00.1234567Z", "03. Apr. 2026"],
  ["2026-04-03T00:30:00+14:00", "03. Apr. 2026"],
  ["2026-04-03T23:30:00-04:00", "03. Apr. 2026"],
  ["2026-04-03T00:00:00", "03. Apr. 2026"],
  ["2026-04-03T00:30", "03. Apr. 2026"],
  ["2026-04-01T00:00:00Z", "01. Apr. 2026"],
  ["2026-12-31T23:30:00Z", "31. Dez. 2026"],
  ["2027-01-01T00:00:00Z", "01. Jan. 2027"],
  ["2024-02-29T00:00:00Z", "29. Feb. 2024"],
  ["0099-04-03", "03. Apr. 99"],
];

const invalidValues = [
  "", "not-a-date", "03.04.2026", "2026-4-3", "2026-02-29",
  "2026-02-30T00:00:00Z", "2026-04-31", "2026-00-03", "2026-13-03",
  "2026-04-00", "0000-04-03", "2026-04-03Tgarbage",
  "2026-04-03T25:00:00Z", "2026-04-03T00:60:00Z",
  "2026-04-03T00:00:00+25:00", "2026-04-03T00:00:00Z trailing",
];

test("formats calendar dates and ISO booking dates without converting their day", () => {
  for (const [value, expected] of cases) {
    assert.equal(formatCalendarDate(value), expected, value);
  }
});

test("returns invalid booking dates unchanged instead of normalizing them", () => {
  for (const value of invalidValues) {
    assert.equal(formatCalendarDate(value), value, value);
  }
});

const formatterUrl = new URL("../src/utils/formatDate.ts", import.meta.url).href;
const inputValues = [...cases.map(([value]) => value), ...invalidValues];
const expectedValues = [...cases.map(([, expected]) => expected), ...invalidValues];

for (const [timeZone, localMidnight, localLate] of [
  ["America/New_York", "02. Apr. 2026", "03. Apr. 2026"],
  ["Europe/Rome", "03. Apr. 2026", "04. Apr. 2026"],
  ["Pacific/Kiritimati", "03. Apr. 2026", "04. Apr. 2026"],
]) {
  test(`preserves booking days in a separate ${timeZone} process`, () => {
    const script = `
      import { formatCalendarDate, formatDate, formatCurrency } from ${JSON.stringify(formatterUrl)};
      console.log(JSON.stringify({
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendarDates: ${JSON.stringify(inputValues)}.map(formatCalendarDate),
        localMidnight: formatDate("2026-04-03T00:00:00Z"),
        localLate: formatDate(new Date("2026-04-03T23:30:00Z")),
        dateOnly: formatDate("2026-04-03"),
        invalid: formatDate("not-a-date"),
        currency: formatCurrency(1234.5),
      }));
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
      env: { ...process.env, TZ: timeZone },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.deepEqual(JSON.parse(output), {
      timeZone,
      calendarDates: expectedValues,
      localMidnight,
      localLate,
      dateOnly: "03. Apr. 2026",
      invalid: "not-a-date",
      currency: "1.234,50\u00a0€",
    });
  });
}
