import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { createTheme, ThemeProvider, type Theme } from "@mui/material/styles";

import type { StatisticsOverview } from "../src/types/api.ts";
import { STATISTICS_VIEWS, type StatisticsView } from "../src/features/statistics/statisticsViews.ts";
import { formatCurrency } from "../src/utils/formatDate.ts";
import type { StatisticsTimeframeValue } from "../src/features/statistics/statisticsPeriod.ts";

const section = (html: string, label: string) => {
  const match = html.match(new RegExp(`<section\\b[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(match, `Missing ${label} section`);
  return match[1];
};

const definitionText = (html: string, tag: "dt" | "dd") =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => match[1]
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]*>/g, ""));

const summary = {
  totalIncome: 1000, totalExpense: -100, netBalance: 900,
  totalSavedOrInvested: 50, internalTransferTotal: 10, adjustmentTotal: 5,
  averageExpense: 100, medianExpense: 100, transactionCount: 1, analyticsTransactionCount: 1,
};
const zeroSummary = {
  totalIncome: 0, totalExpense: 0, netBalance: 0,
  totalSavedOrInvested: 0, internalTransferTotal: 0, adjustmentTotal: 0,
  averageExpense: 0, medianExpense: 0, transactionCount: 0, analyticsTransactionCount: 0,
};
const data: StatisticsOverview = {
  allTime: false, monthsBack: 1,
  startDate: "2026-01-01T00:00:00", endDate: "2026-01-31T23:59:59",
  trendGranularity: "month", summary, previousMonthSummary: zeroSummary,
  monthlyTotals: { monthCount: 1, averageIncome: 1000, medianIncome: 1000, averageExpense: 100, medianExpense: 100 },
  trend: [{ year: 2026, month: 1, ...summary }],
  categories: [], topExpenses: [], recurringExpenses: [],
};

test("server-renders production Statistics shell, navigation, content and request states", async () => {
  // Use the installed Vite transpiler for TSX without adding a DOM/test dependency.
  // No HTTP/WebSocket listener, file watcher or dependency scan is started.
  const serverOptions = {
    configFile: false as const,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true as const, ws: false as const, hmr: false as const, watch: null },
    appType: "custom" as const,
    logLevel: "error" as const,
  };
  const server = await createServer(serverOptions);
  try {
    const { StatisticsShell } = await server.ssrLoadModule("/src/features/statistics/StatisticsShell.tsx") as { StatisticsShell: ComponentType };
    const { MonthlyOverview } = await server.ssrLoadModule("/src/features/statistics/MonthlyOverview.tsx") as { MonthlyOverview: ComponentType<{ view: StatisticsView }> };
    const { appTheme } = await server.ssrLoadModule("/src/theme/index.ts") as { appTheme: Theme };
    const { MonthlyTrend } = await server.ssrLoadModule("/src/features/statistics/MonthlyTrend.tsx") as { MonthlyTrend: ComponentType<{
      points: StatisticsOverview["trend"]; granularity: "month" | "year"; periodLabel: string;
      layout: "page" | "slide"; showSummary: boolean;
    }> };
    const chartCases = [
      { name: "empty", points: [], granularity: "month" as const },
      { name: "zero", points: [{ ...zeroSummary, year: 2026, month: 1 }], granularity: "month" as const },
      { name: "one cent", points: [{ ...zeroSummary, year: 2026, month: 1, totalIncome: 0.01, netBalance: 0.01, transactionCount: 1 }], granularity: "month" as const },
      { name: "one cent expenses", points: [{ ...zeroSummary, year: 2026, month: 1, totalExpense: -0.01, netBalance: -0.01, transactionCount: 1 }], granularity: "month" as const },
      { name: "income only", points: [{ ...zeroSummary, year: 2026, month: 1, totalIncome: 0.25, netBalance: 0.25, transactionCount: 1 }], granularity: "month" as const },
      { name: "expenses only", points: [{ ...zeroSummary, year: 2026, month: 1, totalExpense: -0.25, netBalance: -0.25, transactionCount: 1 }], granularity: "month" as const },
      ...[3, 6, 12].map((count) => ({ name: `${count} months`, granularity: "month" as const,
        points: Array.from({ length: count }, (_, i) => ({ ...summary, year: i === 0 ? 2025 : 2026, month: i === 0 ? 12 : i, totalIncome: i === 1 ? 0.01 : 1000 })).reverse() })),
      { name: "long yearly history", granularity: "year" as const,
        points: Array.from({ length: 50 }, (_, i) => ({ ...summary, year: 1977 + i, month: null, totalIncome: 9876543210.12, totalExpense: -12345678901.23 })).reverse() },
    ];
    for (const layout of ["page", "slide"] as const) {
      for (const showSummary of [false, true]) {
        for (const fixture of chartCases) {
          const before = structuredClone(fixture.points);
          const html = renderToString(createElement(ThemeProvider, { theme: appTheme }, createElement(MonthlyTrend, {
            ...fixture, layout, showSummary, periodLabel: "Synthetic period",
          }))).replace(/<!--.*?-->/g, "");
          const chart = section(html, "Income versus expenses");
          const ordered = [...fixture.points].sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0));
          assert.equal((chart.match(/role="group"/g) ?? []).length, ordered.length, fixture.name);
          const details = [...chart.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map((match) => match[1]);
          assert.equal(details.length, ordered.length, fixture.name);
          for (const [index, point] of ordered.entries()) {
            assert.deepEqual(definitionText(details[index], "dt"), showSummary ? ["Income", "Expenses", "Net Balance"] : ["Income", "Expenses"]);
            assert.deepEqual(definitionText(details[index], "dd"), [formatCurrency(point.totalIncome), formatCurrency(Math.abs(point.totalExpense)), ...(showSummary ? [formatCurrency(point.netBalance)] : [])]);
          }
          assert.equal(chart.includes('aria-label="Trend summary"'), showSummary);
          assert.equal(chart.includes('role="region" aria-label="Income and expense chart with exact values" tabindex="0"'), ordered.length > 0);
          assert.match(chart, /Income \(left\)/);
          assert.match(chart, /Expenses \(right\)/);
          assert.equal(chart.includes("Yearly totals"), fixture.granularity === "year");
          assert.doesNotMatch(chart, /Showing the latest|Infinity|NaN/);
          if (fixture.name === "zero") {
            assert.equal((chart.match(/data-height-percent="0"/g) ?? []).length, 2);
            assert.match(chart, /No transactions found/);
          }
          if (fixture.name === "3 months") assert.match(chart, /data-height-percent="0.001"/);
          if (fixture.name.startsWith("one cent")) {
            const axis = chart.slice(chart.indexOf('aria-label="Income and expense chart with exact values"'), chart.indexOf('role="group"'));
            assert.equal((axis.match(/0,01/g) ?? []).length, 1);
            assert.equal((axis.match(/0,00/g) ?? []).length, 1);
          }
          assert.deepEqual(fixture.points, before, "Chart rendering must not mutate server data");
        }
      }
    }
    const render = (view: StatisticsView, options: {
      response?: StatisticsOverview;
      error?: boolean;
      loading?: boolean;
      refreshing?: boolean;
      online?: boolean;
      mobile?: boolean;
      timeframe?: StatisticsTimeframeValue;
    } = {}) => {
      const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
      const timeframe = options.timeframe ?? "1";
      const queryKey = ["transactions", "statistics", timeframe === "all" ? { allTime: true } : {
        allTime: false, endYear: 2026, endMonth: 1, monthsBack: Number(timeframe),
      }];
      client.setQueryData(queryKey, options.response ?? data);
      const query = client.getQueryCache().find({ queryKey });
      assert.ok(query);
      if (options.error) query.setState({ status: "error", error: new Error("Synthetic unavailable state"), fetchStatus: "idle" });
      if (options.loading) query.setState({ status: "pending", data: undefined, fetchStatus: "fetching" });
      if (options.refreshing) query.setState({ fetchStatus: "fetching" });
      const path = view === "overview" ? "/statistics" : `/statistics/${view}`;
      const router = createMemoryRouter([{
        path: "/statistics", element: createElement(StatisticsShell),
        children: [
          { index: true, element: createElement(MonthlyOverview, { view: "overview" }) },
          { path: "spending", element: createElement(MonthlyOverview, { view: "spending" }) },
          { path: "trends", element: createElement(MonthlyOverview, { view: "trends" }) },
        ],
      }], { initialEntries: [`${path}?timeframe=${timeframe}&month=2026-01&tag=a&tag=b`] });
      const theme = options.mobile ? createTheme(appTheme, {
        components: { MuiUseMediaQuery: { defaultProps: {
          ssrMatchMedia: (query: string) => ({ matches: query.includes("max-width") }),
        } } },
      }) : appTheme;
      const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
      Object.defineProperty(globalThis, "navigator", { value: { onLine: options.online ?? true }, configurable: true });
      try {
        return renderToString(createElement(QueryClientProvider, { client },
          createElement(ThemeProvider, { theme }, createElement(RouterProvider, { router })),
        )).replace(/<!--.*?-->/g, "");
      } finally {
        if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
        else Reflect.deleteProperty(globalThis, "navigator");
        router.dispose();
        client.clear();
      }
    };

    for (const { id, path } of STATISTICS_VIEWS) {
      const html = render(id);
      assert.equal((html.match(/Internal transfers and adjustments are excluded/g) ?? []).length, 1);
      assert.match(html, /Excluded 15,00/);
      assert.match(html, /aria-label="Statistics views"/);
      const links = html.match(/<a\b[^>]*>/g) ?? [];
      const activeLinks = links.filter((link) => link.includes('aria-current="page"'));
      assert.equal(activeLinks.length, 1);
      assert.ok(activeLinks[0].includes(`href="${path}?timeframe=1&amp;month=2026-01&amp;tag=a&amp;tag=b"`));
      assert.equal(links.length, 3);
      assert.ok(links.every((link) => link.includes("tag=a&amp;tag=b")));
      assert.doesNotMatch(html, /Infinity|NaN/);
      if (id === "overview") {
        assert.match(html, /Month Comparison/);
        assert.match(html, /Saved \/ Invested/);
        assert.match(html, /Transactions/);
        assert.doesNotMatch(html, /Previous-month comparison is unavailable|Expenses by Category|Average Monthly Income/);
      }
      if (id === "spending") {
        assert.match(html, /Expenses by Category/);
        assert.match(html, /No expenses for this period/);
        assert.match(html, /No expense transactions/);
        assert.match(html, /Choose 3 months or longer/);
        assert.match(html, /Spending Pace/);
        assert.doesNotMatch(html, /Month Comparison|Average Monthly Income/);
      }
      if (id === "trends") {
        assert.match(html, /Average Monthly Income/);
        assert.match(html, /Expense Ratio/);
        assert.match(html, /Choose a longer range/);
        assert.doesNotMatch(html, /Month Comparison|Expenses by Category/);
      }
      const noExclusions = render(id, { response: { ...data, summary: { ...summary, internalTransferTotal: 0, adjustmentTotal: 0 } } });
      assert.doesNotMatch(noExclusions, /Internal transfers and adjustments are excluded/);
      const loading = render(id, { loading: true });
      assert.match(loading, /Loading statistics/);
      assert.match(loading, /aria-label="Statistics views"/);
      const offlineLoading = render(id, { loading: true, online: false });
      assert.match(offlineLoading, /You appear to be offline/);
      const failure = render(id, { error: true });
      assert.match(failure, /Statistics are unavailable/);
      assert.match(failure, /Retry/);
      assert.match(render(id, { error: true, online: false }), /You're offline|You&#x27;re offline/);
      const refreshing = render(id, { refreshing: true });
      assert.match(refreshing, /Refreshing statistics/);
      assert.match(refreshing, /Internal transfers and adjustments are excluded/);
    }
    const unavailable = render("overview", { response: { ...data, previousMonthSummary: null } });
    assert.match(unavailable, /Previous-month comparison is unavailable/);
    assert.doesNotMatch(unavailable, /Month Comparison/);
    const empty = render("overview", { response: { ...data, summary: zeroSummary, trend: [], previousMonthSummary: zeroSummary } });
    assert.match(empty, /Month Comparison/);
    assert.match(empty, /No transactions found in this trend range/);
    assert.match(empty, /N\/A/);

    const metricCases = [
      { name: "normal", summary, rate: "90 %" },
      { name: "income only", summary: { ...zeroSummary, totalIncome: 100, netBalance: 100, transactionCount: 1 }, rate: "100 %" },
      { name: "negative balance", summary: { ...summary, totalIncome: 100, totalExpense: -125, netBalance: -25 }, rate: "-25 %" },
      { name: "no income", summary: { ...zeroSummary, totalExpense: -10, netBalance: -10 }, rate: "N/A" },
      { name: "no income with positive balance", summary: { ...zeroSummary, netBalance: 10 }, rate: "N/A" },
      { name: "negative income", summary: { ...zeroSummary, totalIncome: -10, totalExpense: -20, netBalance: -30 }, rate: "N/A" },
      { name: "empty", summary: zeroSummary, rate: "N/A" },
      { name: "fractional", summary: { ...summary, totalIncome: 3, totalExpense: -2, netBalance: 1, totalSavedOrInvested: 0.35, transactionCount: 4 }, rate: "33,3 %" },
      { name: "large", summary: { ...summary, totalIncome: 9876543210.12, totalExpense: -12345678901.23, netBalance: -2469135691.11, totalSavedOrInvested: 1234567890.12 }, rate: "-25 %" },
      { name: "positive expense total", summary: { ...summary, totalIncome: 100, totalExpense: 25, netBalance: 75 }, rate: "75 %" },
    ];
    for (const mobile of [false, true]) {
      for (const { name, summary: current, rate } of metricCases) {
        const response = { ...data, summary: current };
        const before = structuredClone(response);
        const html = render("overview", { response, mobile });
        assert.equal(html.includes('aria-roledescription="carousel"'), mobile, name);
        const headline = section(html, "Headline metrics");
        assert.deepEqual(definitionText(headline, "dt"), ["Income", "Expenses", "Net Balance", "Savings Rate"], name);
        assert.deepEqual(definitionText(headline, "dd"), [
          formatCurrency(current.totalIncome), formatCurrency(Math.abs(current.totalExpense)), formatCurrency(current.netBalance), rate,
        ], name);
        assert.match(headline, /Savings Rate is net balance as a share of income\. It is distinct from Saved \/ Invested\./);
        const secondary = section(html, "Additional period information");
        assert.deepEqual(definitionText(secondary, "dt"), ["Saved / Invested", "Transactions"], name);
        assert.deepEqual(definitionText(secondary, "dd"), [formatCurrency(current.totalSavedOrInvested), String(current.transactionCount)], name);
        // The secondary information follows the entire desktop/mobile view, not a headline card or slide.
        assert.ok(html.indexOf('aria-label="Additional period information"') > html.lastIndexOf('aria-label="Headline metrics"'));
        assert.match(html, /Income versus expenses/);
        assert.ok(html.indexOf('aria-label="Additional period information"') > html.indexOf("Income versus expenses"));
        if (mobile) {
          assert.match(html, /aria-label="Next slide"/);
          assert.ok(html.indexOf('aria-label="Additional period information"') > html.indexOf('aria-label="Next slide"'));
        }
        assert.equal(html.includes("Internal transfers and adjustments are excluded"), current.internalTransferTotal + current.adjustmentTotal > 0);
        assert.doesNotMatch(html, /Infinity|NaN/);
        assert.deepEqual(response, before, "Rendering must not mutate server data");
      }
      for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
        const html = render("overview", { timeframe, mobile });
        assert.equal(definitionText(section(html, "Headline metrics"), "dt").length, 4);
        assert.match(section(html, "Additional period information"), /Saved \/ Invested/);
        assert.doesNotMatch(section(html, "Income versus expenses"), /aria-label="Trend summary"|Best Month|Best Year/);
        assert.match(section(render("trends", { timeframe, mobile }), "Income versus expenses"), /aria-label="Trend summary"/);
      }
      for (const view of ["spending", "trends"] as const) {
        const html = render(view, { mobile });
        assert.doesNotMatch(html, /aria-label="Headline metrics"|aria-label="Additional period information"|Savings Rate is net balance/);
      }
    }
  } finally {
    await server.close();
  }
});
