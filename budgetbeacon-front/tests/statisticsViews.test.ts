import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRouter } from "react-router-dom";

import {
  buildStatisticsSearchParams,
  resolveStatisticsPeriod,
  shiftMonth,
} from "../src/features/statistics/statisticsPeriod.ts";
import {
  buildStatisticsViewLocation,
  STATISTICS_VIEWS,
  STATISTICS_VIEW_PATHS,
} from "../src/features/statistics/statisticsViews.ts";

const referenceDate = new Date(2026, 0, 15);
const routes = [{
  path: STATISTICS_VIEW_PATHS.overview,
  id: "statistics-shell",
  children: [
    { index: true, id: "overview" },
    { path: STATISTICS_VIEW_PATHS.spending, id: "spending" },
    { path: STATISTICS_VIEW_PATHS.trends, id: "trends" },
  ],
}];

test("all destinations retain every supported period and unrelated repeated parameters", () => {
  for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
    const original = new URLSearchParams(`timeframe=${timeframe}&month=2025-12&source=dashboard&tag=a&tag=b`);
    const before = original.toString();
    const period = resolveStatisticsPeriod(original, referenceDate);
    for (const { id, path } of STATISTICS_VIEWS) {
      const location = buildStatisticsViewLocation(id, original, period.timeframe, period.selectedMonth);
      const params = new URLSearchParams(location.search);
      assert.equal(location.pathname, path);
      assert.equal(params.get("timeframe"), timeframe);
      assert.equal(params.get("month"), timeframe === "all" ? null : "2025-12");
      assert.equal(params.get("source"), "dashboard");
      assert.deepEqual(params.getAll("tag"), ["a", "b"]);
      assert.equal(original.toString(), before);
    }
  }
});

test("missing or invalid periods resolve to the existing defaults and become explicit on view navigation", () => {
  for (const search of ["", "source=dashboard", "timeframe=invalid&month=invalid", "timeframe=2&month=2026-13"]) {
    const params = new URLSearchParams(search);
    const period = resolveStatisticsPeriod(params, referenceDate);
    assert.deepEqual(period, { timeframe: "1", selectedMonth: { year: 2026, month: 1 } });
    const location = buildStatisticsViewLocation("trends", params, period.timeframe, period.selectedMonth);
    assert.equal(new URLSearchParams(location.search).get("month"), "2026-01");
    assert.equal(new URLSearchParams(location.search).get("timeframe"), "1");
    // Once explicit, reload/navigation in another calendar month keeps the selection.
    assert.deepEqual(resolveStatisticsPeriod(new URLSearchParams(location.search), new Date(2026, 1, 15)), period);
  }
});

test("valid months survive invalid timeframe fallback", () => {
  assert.deepEqual(resolveStatisticsPeriod(new URLSearchParams("timeframe=bad&month=2025-12"), referenceDate), {
    timeframe: "1", selectedMonth: { year: 2025, month: 12 },
  });
});

test("direct links and reload resolve each destination and its original period", () => {
  for (const { id, path } of STATISTICS_VIEWS) {
    const url = `${path}?timeframe=6&month=2026-01&source=dashboard`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const router = createMemoryRouter(routes, { initialEntries: [url] });
      try {
        assert.deepEqual(router.state.matches.map((match) => match.route.id), ["statistics-shell", id]);
        assert.deepEqual(resolveStatisticsPeriod(new URLSearchParams(router.state.location.search), referenceDate), {
          timeframe: "6", selectedMonth: { year: 2026, month: 1 },
        });
      } finally { router.dispose(); }
    }
  }
});

test("Back and Forward restore both view and period across calendar transitions", async () => {
  const initial = "/statistics?timeframe=1&month=2025-12&tag=a&tag=b";
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  const snapshot = () => ({ pathname: router.state.location.pathname, search: router.state.location.search });
  try {
    const initialLocation = snapshot();
    const params = new URLSearchParams(router.state.location.search);
    const december = resolveStatisticsPeriod(params, referenceDate);
    const january = shiftMonth(december.selectedMonth, 1);
    await router.navigate({ pathname: "/statistics", search: `?${buildStatisticsSearchParams(params, "1", january)}` });
    const januaryLocation = snapshot();
    await router.navigate(buildStatisticsViewLocation("spending", new URLSearchParams(januaryLocation.search), "1", january));
    const spendingLocation = snapshot();
    await router.navigate(buildStatisticsViewLocation("trends", new URLSearchParams(spendingLocation.search), "1", january));
    const trendsLocation = snapshot();
    assert.equal(router.state.matches[0].route.id, "statistics-shell");
    assert.equal(router.state.matches.at(-1)?.route.id, "trends");
    await router.navigate(-1);
    assert.deepEqual(snapshot(), spendingLocation);
    await router.navigate(-1);
    assert.deepEqual(snapshot(), januaryLocation);
    await router.navigate(-1);
    assert.deepEqual(snapshot(), initialLocation);
    assert.deepEqual(resolveStatisticsPeriod(new URLSearchParams(router.state.location.search), referenceDate).selectedMonth, { year: 2025, month: 12 });
    await router.navigate(1);
    assert.deepEqual(snapshot(), januaryLocation);
    await router.navigate(1);
    assert.deepEqual(snapshot(), spendingLocation);
    await router.navigate(1);
    assert.deepEqual(snapshot(), trendsLocation);
  } finally { router.dispose(); }
});

test("all-time navigation and history preserve unrelated parameters without a stale month", async () => {
  const router = createMemoryRouter(routes, { initialEntries: ["/statistics?timeframe=3&month=2026-01&source=dashboard"] });
  try {
    const params = new URLSearchParams(router.state.location.search);
    await router.navigate(buildStatisticsViewLocation("spending", params, "all", { year: 2026, month: 1 }));
    assert.equal(router.state.location.search, "?timeframe=all&source=dashboard");
    await router.navigate(buildStatisticsViewLocation("trends", new URLSearchParams(router.state.location.search), "all", { year: 2026, month: 2 }));
    assert.equal(router.state.location.search, "?timeframe=all&source=dashboard");
    await router.navigate(-1);
    await router.navigate(-1);
    assert.equal(router.state.location.search, "?timeframe=3&month=2026-01&source=dashboard");
  } finally { router.dispose(); }
});
