import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider, useOutletContext } from "react-router-dom";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { createTheme, ThemeProvider, type Theme } from "@mui/material/styles";

import type { StatisticsOverview } from "../src/types/api.ts";
import { STATISTICS_VIEWS, type StatisticsView } from "../src/features/statistics/statisticsViews.ts";
import { formatCurrency, formatDate } from "../src/utils/formatDate.ts";
import type { StatisticsContext } from "../src/features/statistics/statisticsContext.ts";
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

const visibleText = (html: string) => html
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "")
  .replace(/<svg\b[\s\S]*?<\/svg>/g, "")
  .replace(/<[^>]*>/g, "");

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

test("server-renders production Statistics shell, navigation, content and request states", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 1, 15, 12) });
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
      showSummary: boolean;
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
    for (const showSummary of [false, true]) {
      for (const fixture of chartCases) {
        const before = structuredClone(fixture.points);
        const html = renderToString(createElement(ThemeProvider, { theme: appTheme }, createElement(MonthlyTrend, {
          ...fixture, showSummary, periodLabel: "Synthetic period",
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
    const render = (view: StatisticsView, options: {
      response?: StatisticsOverview;
      error?: boolean;
      loading?: boolean;
      uncached?: boolean;
      refreshing?: boolean;
      online?: boolean;
      mobile?: boolean;
      timeframe?: StatisticsTimeframeValue;
      month?: string;
    } = {}) => {
      const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
      const timeframe = options.timeframe ?? "1";
      const month = options.month ?? "2026-01";
      const [endYear, endMonth] = month.split("-").map(Number);
      const queryKey = ["transactions", "statistics", timeframe === "all" ? { allTime: true } : {
        allTime: false, endYear, endMonth, monthsBack: Number(timeframe),
      }];
      if (!options.uncached) client.setQueryData(queryKey, options.response ?? data);
      const query = client.getQueryCache().find({ queryKey }) ?? client.getQueryCache().build(client, { queryKey });
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
      }], { initialEntries: [`${path}?timeframe=${timeframe}&month=${month}&tag=a&tag=b`] });
      const theme = options.mobile ? createTheme(appTheme, {
        components: { MuiUseMediaQuery: { defaultProps: {
          ssrMatchMedia: (query: string) => ({ matches: query.includes("max-width") }),
        } } },
      }) : appTheme;
      const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
      const originalOnline = onlineManager.isOnline();
      Object.defineProperty(globalThis, "navigator", { value: { onLine: options.online ?? true }, configurable: true });
      onlineManager.setOnline(options.online ?? true);
      try {
        return renderToString(createElement(QueryClientProvider, { client },
          createElement(ThemeProvider, { theme }, createElement(RouterProvider, { router })),
        )).replace(/<!--.*?-->/g, "");
      } finally {
        onlineManager.setOnline(originalOnline);
        if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
        else Reflect.deleteProperty(globalThis, "navigator");
        router.dispose();
        client.clear();
      }
    };

    await t.test("API-shaped financial edge cases retain supplied values across all three views", () => {
      const cases = [
        { name: "empty", current: zeroSummary, rate: "N/A", ratio: "N/A", categoryExpense: 0, originalExpense: 0 },
        { name: "income only", current: { ...zeroSummary, totalIncome: 100, netBalance: 100, transactionCount: 1, analyticsTransactionCount: 1 },
          rate: "100 %", ratio: "0 %", categoryExpense: 0, originalExpense: 0 },
        { name: "expense only", current: { ...zeroSummary, totalExpense: -125, netBalance: -125, averageExpense: 125, medianExpense: 125, transactionCount: 1, analyticsTransactionCount: 1 },
          rate: "N/A", ratio: "N/A", categoryExpense: 125, originalExpense: 125 },
        { name: "negative balance", current: { ...zeroSummary, totalIncome: 100, totalExpense: -125, netBalance: -25, averageExpense: 125, medianExpense: 125, transactionCount: 2, analyticsTransactionCount: 2 },
          rate: "-25 %", ratio: "125 %", categoryExpense: 125, originalExpense: 125 },
        // Mirrors BuildFixedPeriod_UsesTreatmentForAnalyticsTotals in the backend tests:
        // salary 2500, expense -100, refund 20, investment -500, transfer -700, adjustment -15.
        // These are supplied response values, not a frontend reimplementation of aggregation.
        { name: "refund with savings and exclusions", current: { ...zeroSummary, totalIncome: 2500, totalExpense: -80, netBalance: 2420,
          totalSavedOrInvested: 500, internalTransferTotal: 700, adjustmentTotal: 15,
          averageExpense: 100, medianExpense: 100, transactionCount: 6, analyticsTransactionCount: 3 },
          rate: "96,8 %", ratio: "3,2 %", categoryExpense: 80, originalExpense: 100 },
        { name: "excluded activity only", current: { ...zeroSummary, internalTransferTotal: 700, adjustmentTotal: 15, transactionCount: 2 },
          rate: "N/A", ratio: "N/A", categoryExpense: 0, originalExpense: 0 },
      ];
      for (const mobile of [false, true]) {
        for (const { name, current, rate, ratio, categoryExpense, originalExpense } of cases) {
          const response: StatisticsOverview = {
            ...data, summary: current, previousMonthSummary: zeroSummary,
            trend: [{ year: 2026, month: 1, ...current }],
            monthlyTotals: { monthCount: 1, averageIncome: current.totalIncome, medianIncome: current.totalIncome,
              averageExpense: Math.abs(current.totalExpense), medianExpense: Math.abs(current.totalExpense) },
            categories: categoryExpense ? [{ category: "Food & Groceries", totalExpense: categoryExpense, percentage: 100, transactionCount: 1 }] : [],
            topExpenses: originalExpense ? [{ id: "synthetic-expense", description: "Synthetic original expense", category: "Food & Groceries", amount: originalExpense, date: "2026-01-02" }] : [],
          };
          const before = structuredClone(response);
          for (const { id } of STATISTICS_VIEWS) {
            const html = render(id, { response, mobile });
            const text = visibleText(html);
            const excluded = current.internalTransferTotal + current.adjustmentTotal;
            assert.equal(text.includes("Internal transfers and adjustments are excluded"), excluded > 0, name);
            if (excluded > 0) assert.ok(text.includes(`Excluded ${formatCurrency(excluded)}`), name);
            assert.doesNotMatch(html, /Infinity|NaN/, name);
            if (id === "overview") {
              assert.deepEqual(definitionText(section(html, "Headline metrics"), "dd"), [
                formatCurrency(current.totalIncome), formatCurrency(Math.abs(current.totalExpense)), formatCurrency(current.netBalance), rate,
              ], name);
              const secondary = definitionText(section(html, "Additional period information"), "dd");
              assert.equal(secondary[0], formatCurrency(current.totalSavedOrInvested), name);
              assert.ok(secondary[1].startsWith(`${current.transactionCount}Januar 2026 vs Dezember 2025:`), name);
              assert.ok(visibleText(section(html, "Month comparison")).includes("Januar 2026 vs Dezember 2025"), name);
            }
            if (id === "spending") {
              const categories = visibleText(section(html, "Expenses by Category"));
              assert.ok(categories.includes(`${formatCurrency(categoryExpense)} across ${categoryExpense ? 1 : 0} categories`), name);
              if (originalExpense) assert.ok(text.includes(`Synthetic original expenseFood &amp; Groceries - ${formatDate("2026-01-02")}${formatCurrency(originalExpense)}`), name);
              else assert.match(html, /No expense transactions/, name);
            } else {
              const chart = section(html, "Income versus expenses");
              const details = chart.match(/<dl\b[^>]*>([\s\S]*?)<\/dl>/);
              assert.ok(details, name);
              assert.deepEqual(definitionText(details[1], "dd"), [formatCurrency(current.totalIncome), formatCurrency(Math.abs(current.totalExpense)),
                ...(id === "trends" ? [formatCurrency(current.netBalance)] : [])], name);
            }
            if (id === "trends") {
              const period = visibleText(section(html, "Period Overview"));
              assert.ok(period.includes(`Average Monthly Income${formatCurrency(current.totalIncome)}`), name);
              assert.ok(period.includes(`Median Monthly Income${formatCurrency(current.totalIncome)}`), name);
              assert.ok(period.includes(`Average Monthly Expenses${formatCurrency(Math.abs(current.totalExpense))}`), name);
              assert.ok(period.includes(`Median Monthly Expenses${formatCurrency(Math.abs(current.totalExpense))}`), name);
              assert.ok(period.includes(`Expense Ratio${ratio}`), name);
            }
          }
          assert.deepEqual(response, before, name);
        }
      }
    });

    await t.test("Spending and Trends retain populated and empty sections across every range and layout", () => {
      for (const mobile of [false, true]) {
        for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
          const isAllTime = timeframe === "all";
          const count = isAllTime ? 2 : Number(timeframe);
          const points = Array.from({ length: count }, (_, index) => {
            const date = new Date(Date.UTC(2026, 1 - count + index, 1));
            const income = (isAllTime ? 12000 : 1000) + index * 100.25;
            const expense = (isAllTime ? 1200 : 100) + index * 10.5;
            return {
              ...summary, totalIncome: income, totalExpense: -expense, netBalance: income - expense,
              year: isAllTime ? 2025 + index : date.getUTCFullYear(),
              month: isAllTime ? null : date.getUTCMonth() + 1,
            };
          });
          const expenseTotal = points.reduce((sum, point) => sum + Math.abs(point.totalExpense), 0);
          const incomeTotal = points.reduce((sum, point) => sum + point.totalIncome, 0);
          const response: StatisticsOverview = {
            ...data, allTime: isAllTime, monthsBack: isAllTime ? null : count,
            startDate: isAllTime ? "2025-01-01" : `${points[0].year}-${String(points[0].month).padStart(2, "0")}-01`,
            trendGranularity: isAllTime ? "year" : "month", trend: [...points].reverse(),
            summary: { ...summary, totalIncome: incomeTotal, totalExpense: -expenseTotal,
              netBalance: incomeTotal - expenseTotal, transactionCount: count },
            // Distinct server-supplied monthly statistics must not become yearly statistics.
            monthlyTotals: { monthCount: isAllTime ? 24 : count,
              averageIncome: 1004.25, medianIncome: 1000.75, averageExpense: 102.5, medianExpense: 100.25 },
            categories: [
              { category: "Food", totalExpense: expenseTotal * 0.75, percentage: 75, transactionCount: 3 },
              { category: "Rent", totalExpense: expenseTotal * 0.25, percentage: 25, transactionCount: 1 },
            ],
            topExpenses: [
              { id: "expense-one", description: "Synthetic groceries", category: "Food", amount: -74.25, date: "2026-01-15" },
              { id: "expense-two", description: "Synthetic rent", category: "Rent", amount: -25.75, date: "2026-01-10" },
            ],
            // Deliberately retained for one month to prove unsupported candidates remain hidden.
            recurringExpenses: [{ description: "Synthetic subscription", category: "Subscriptions & Services",
              averageAmount: 12.5, minAmount: 12, maxAmount: 13, occurrenceCount: 3, monthCount: 2, lastDate: "2026-01-20" }],
          };
          const before = structuredClone(response);
          const spending = render("spending", { timeframe, mobile, response });
          const text = visibleText(spending);
          assert.ok(spending.indexOf("Expenses by Category") < spending.indexOf("Top expense transactions"));
          assert.ok(spending.indexOf("Top expense transactions") < spending.indexOf(timeframe === "1" ? "Daily Average" : "Repeated expenses"));
          assert.ok(text.includes(`Food3 transactions${formatCurrency(expenseTotal * 0.75)}75 %`));
          assert.ok(text.includes(`Rent1 transactions${formatCurrency(expenseTotal * 0.25)}25 %`));
          assert.match(spending, /<button\b[^>]*aria-label="View Food transactions for /);
          for (const expense of response.topExpenses) {
            assert.ok(text.includes(`${expense.description}${expense.category} - ${formatDate(expense.date)}${formatCurrency(expense.amount)}`));
          }
          assert.equal(text.includes("Synthetic subscription"), timeframe !== "1");
          assert.equal(text.includes("Spending Pace"), timeframe === "1");
          assert.equal(text.includes("Detection requires repeated expenses across at least two months."), timeframe === "1");
          if (timeframe === "1") {
            // A completed historical month uses all 31 days and the actual totals.
            assert.ok(text.includes(`Daily Average${formatCurrency(expenseTotal / 31)}`));
            assert.ok(text.includes(`Projected Expenses${formatCurrency(expenseTotal)}`));
            assert.ok(text.includes(`Projected Balance${formatCurrency(incomeTotal - expenseTotal)}`));
            assert.ok(text.includes("Days Remaining0"));
          } else {
            assert.ok(text.includes(`Subscriptions &amp; Services - 3 occurrences across 2 months - Last ${formatDate("2026-01-20")}`));
            assert.ok(text.includes(`${formatCurrency(12.5)}avg`));
          }
          assert.doesNotMatch(spending, /Income versus expenses|Average Monthly Income|Month Comparison|No expense transactions/);
          assert.equal((spending.match(/Internal transfers and adjustments are excluded/g) ?? []).length, 1);

          const trends = render("trends", { timeframe, mobile, response });
          const trendText = visibleText(trends);
          const chart = section(trends, "Income versus expenses");
          const chartText = visibleText(chart);
          const details = [...chart.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map((match) => match[1]);
          assert.equal(details.length, count);
          points.forEach((point, index) => {
            assert.deepEqual(definitionText(details[index], "dt"), ["Income", "Expenses", "Net Balance"]);
            assert.deepEqual(definitionText(details[index], "dd"), [formatCurrency(point.totalIncome), formatCurrency(Math.abs(point.totalExpense)), formatCurrency(point.netBalance)]);
          });
          const bestLabel = isAllTime ? "2026" : "Jan. 2026";
          assert.ok(chartText.includes(`Income${formatCurrency(incomeTotal)}Expenses${formatCurrency(expenseTotal)}Net Balance${formatCurrency(incomeTotal - expenseTotal)}Best ${isAllTime ? "Year" : "Month"}${bestLabel}`));
          for (const [label, value] of [
            ["Average Monthly Income", 1004.25], ["Median Monthly Income", 1000.75],
            ["Average Monthly Expenses", 102.5], ["Median Monthly Expenses", 100.25],
          ] as const) assert.ok(trendText.includes(`${label}${formatCurrency(value)}`));
          const ratio = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(expenseTotal / incomeTotal * 100);
          assert.ok(trendText.includes(`Expense Ratio${ratio} %`));
          assert.ok(trends.indexOf("Income versus expenses") < trends.indexOf("Average Monthly Income"));
          assert.equal(trendText.includes("This selection shows one month."), timeframe === "1");
          assert.equal(trendText.includes("The chart shows yearly totals. Averages and medians below describe monthly totals for the selected period."), isAllTime);
          assert.equal(chartText.includes("Yearly totals"), isAllTime);
          assert.equal(chartText.includes("Monthly totals"), !isAllTime);
          const activeLink = (trends.match(/<a\b[^>]*>/g) ?? []).find((link) => link.includes('aria-current="page"'));
          assert.ok(activeLink?.includes(`timeframe=${timeframe}`));
          if (!isAllTime) assert.ok(activeLink?.includes("month=2026-01"));
          assert.doesNotMatch(trends, /Expenses by Category|Recurring Expense Candidates|Spending Pace|Month Comparison/);
          assert.equal((trends.match(/Internal transfers and adjustments are excluded/g) ?? []).length, 1);
          assert.doesNotMatch(spending + trends, /Infinity|NaN/);
          assert.deepEqual(response, before, "Detail views must not mutate server data");

          const emptyResponse = { ...response, summary: zeroSummary, monthlyTotals: undefined,
            categories: [], topExpenses: [], recurringExpenses: [], trend: [] };
          const emptySpending = render("spending", { timeframe, mobile, response: emptyResponse });
          assert.match(emptySpending, /No expenses for this period/);
          assert.match(emptySpending, /No expense transactions/);
          assert.equal(emptySpending.includes("No recurring candidates"), timeframe !== "1");
          const emptyTrends = visibleText(render("trends", { timeframe, mobile, response: emptyResponse }));
          assert.ok(emptyTrends.includes("No transactions found in this trend range."));
          for (const label of ["Average Monthly Income", "Median Monthly Income", "Average Monthly Expenses", "Median Monthly Expenses", "Expense Ratio"]) {
            assert.ok(emptyTrends.includes(`${label}N/A`));
          }
        }
        for (const income of [0, -10]) {
          const html = visibleText(render("trends", { mobile, response: { ...data, summary: { ...summary, totalIncome: income } } }));
          assert.ok(html.includes("Expense RatioN/A"));
          assert.ok(html.includes(`Average Monthly Income${formatCurrency(1000)}`));
        }
        for (const fixture of [
          { summary: { ...summary, totalIncome: 100, totalExpense: -300, netBalance: -200 },
            dailyAverage: 20, projectedExpenses: 560, projectedBalance: -460 },
          { summary: zeroSummary, dailyAverage: 0, projectedExpenses: 0, projectedBalance: 0 },
        ]) {
          const response = { ...data, summary: fixture.summary, startDate: "2026-02-01", endDate: "2026-02-28",
            trend: [{ ...fixture.summary, year: 2026, month: 2 }] };
          const before = structuredClone(response);
          const currentSpending = visibleText(render("spending", { mobile, month: "2026-02", response }));
          assert.ok(currentSpending.includes("15 of 28 days accounted for"));
          assert.ok(currentSpending.includes("Month Progress54 %"));
          assert.ok(currentSpending.includes(`Daily Average${formatCurrency(fixture.dailyAverage)}`));
          assert.ok(currentSpending.includes(`Projected Expenses${formatCurrency(fixture.projectedExpenses)}`));
          assert.ok(currentSpending.includes(`Projected Balance${formatCurrency(fixture.projectedBalance)}`));
          assert.ok(currentSpending.includes("Days Remaining13"));
          assert.doesNotMatch(currentSpending, /No spending pace yet|Infinity|NaN/);
          assert.deepEqual(response, before);
        }
        const futureSpending = render("spending", { mobile, month: "2026-03" });
        assert.match(futureSpending, /No spending pace yet/);
        assert.match(futureSpending, /Spending pace is available once the selected month has started/);
        assert.doesNotMatch(futureSpending, /Daily Average|Projected Expenses|Projected Balance/);
      }
    });

    await t.test("production category callback preserves expense filters and response calendar boundaries", async () => {
      // SSR does not run the effect that activates useNavigate. Only for this harness,
      // bind that hook directly to the memory router; the shell callback and URL builder
      // remain production code. This does not establish mounted routing or button clicks.
      const callbackServer = await createServer({
        ...serverOptions,
        plugins: [{
          name: "statistics-callback-router",
          enforce: "pre" as const,
          transform(source: string, id: string) {
            if (!id.endsWith("/StatisticsShell.tsx")) return;
            assert.ok(source.includes("const navigate = useNavigate();"));
            return { code: source
              .replace("import { useMemo }", "import { useMemo, useContext }")
              .replace("Outlet, useNavigate, useSearchParams", "Outlet, UNSAFE_DataRouterContext, useSearchParams")
              .replace("const navigate = useNavigate();", "const navigate = useContext(UNSAFE_DataRouterContext).router.navigate;"),
              map: null };
          },
        }],
      });
      try {
        const { StatisticsShell: CallbackShell } = await callbackServer.ssrLoadModule("/src/features/statistics/StatisticsShell.tsx") as { StatisticsShell: ComponentType };
        for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
          for (const dates of [
            { startDate: "2025-12-01T00:30:00+14:00", endDate: "2026-01-31T23:30:00-10:00" },
            { startDate: null, endDate: null },
          ]) {
            const client = new QueryClient();
            const queryKey = ["transactions", "statistics", timeframe === "all" ? { allTime: true } : {
              allTime: false, endYear: 2026, endMonth: 1, monthsBack: Number(timeframe),
            }];
            const response = { ...data, ...dates };
            const before = structuredClone(response);
            client.setQueryData(queryKey, response);
            const captureContext = t.mock.fn((context: StatisticsContext) => context);
            const ContextProbe = () => {
              captureContext(useOutletContext<StatisticsContext>());
              return null;
            };
            const router = createMemoryRouter([
              { path: "/statistics", element: createElement(CallbackShell), children: [
                { path: "spending", element: createElement(ContextProbe) },
              ] },
              { path: "/transactions", element: null },
            ], { initialEntries: [`/statistics/spending?timeframe=${timeframe}&month=2026-01`] });
            try {
              renderToString(createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme: appTheme }, createElement(RouterProvider, { router }))));
              const capturedContext = captureContext.mock.calls[0]?.arguments[0];
              assert.ok(capturedContext);
              assert.equal(capturedContext.timeframe, timeframe);
              const category = "Food & Groceries / Café + 50%";
              capturedContext.onCategorySelect(category);
              assert.equal(router.state.location.pathname, "/transactions");
              const params = new URLSearchParams(router.state.location.search);
              assert.equal(params.get("category"), category);
              assert.equal(params.get("type"), "expense");
              assert.equal(params.get("startDate"), dates.startDate?.slice(0, 10) ?? null);
              assert.equal(params.get("endDate"), dates.endDate?.slice(0, 10) ?? null);
              assert.deepEqual([...params.keys()].sort(), dates.startDate ? ["category", "endDate", "startDate", "type"] : ["category", "type"]);
              assert.deepEqual(response, before, "Category navigation must not mutate the response");
              await router.navigate(-1);
              assert.equal(router.state.location.pathname, "/statistics/spending");
              assert.equal(new URLSearchParams(router.state.location.search).get("timeframe"), timeframe);
            } finally {
              router.dispose();
              client.clear();
            }
          }
        }
      } finally {
        await callbackServer.close();
      }
    });

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
      for (const mobile of [false, true]) {
        const loading = render(id, { loading: true, mobile });
        assert.match(loading, /Loading statistics/);
        assert.match(loading, /role="status"/);
        assert.match(loading, /aria-label="Statistics views"/);
        assert.doesNotMatch(loading, /aria-label="Headline metrics"|aria-label="Income versus expenses"/);
        const offlineLoading = render(id, { loading: true, online: false, mobile });
        assert.match(offlineLoading, /You appear to be offline/);
        // A genuinely uncached offline query is pending/paused, not isLoading.
        // It must wait for reconnection rather than invent zero-valued financial data.
        const offlineUncached = render(id, { uncached: true, online: false, mobile });
        assert.match(offlineUncached, /Loading statistics/);
        assert.match(offlineUncached, /You appear to be offline/);
        assert.match(offlineUncached, /continue once the connection is back/);
        assert.match(offlineUncached, /role="status"/);
        assert.doesNotMatch(offlineUncached, /Showing the last available statistics|aria-label="Headline metrics"|aria-label="Income versus expenses"|No expense transactions/);
        const onlineUncached = render(id, { uncached: true, mobile });
        assert.match(onlineUncached, /Loading statistics/);
        assert.doesNotMatch(onlineUncached, /aria-label="Headline metrics"|aria-label="Income versus expenses"/);
        const failure = render(id, { error: true, mobile });
        assert.match(failure, /Statistics are unavailable/);
        assert.match(failure, /role="alert"/);
        assert.match(failure, /<button[^>]*>Retry<\/button>/);
        assert.match(render(id, { error: true, online: false, mobile }), /You're offline|You&#x27;re offline/);
        const refreshing = render(id, { refreshing: true, mobile });
        assert.match(refreshing, /Refreshing statistics/);
        assert.match(refreshing, /Internal transfers and adjustments are excluded/);
        const cachedOffline = render(id, { online: false, mobile });
        assert.match(cachedOffline, /Showing the last available statistics for this period/);
        assert.match(cachedOffline, /aria-label="Statistics views"/);
        assert.equal(visibleText(cachedOffline).includes("Income versus expenses"), id !== "spending");
        assert.doesNotMatch(loading + failure + refreshing + cachedOffline, /aria-roledescription="carousel"|Next slide/);
      }

    }
    const unavailable = render("overview", { response: { ...data, previousMonthSummary: null } });
    assert.match(unavailable, /Previous-month comparison is unavailable/);
    assert.deepEqual(definitionText(section(unavailable, "Month comparison"), "dt"), []);
    const empty = render("overview", { response: { ...data, summary: zeroSummary, trend: [], previousMonthSummary: zeroSummary } });
    assert.match(empty, /Month Comparison/);
    assert.match(empty, /No transactions found in this trend range/);
    assert.match(empty, /N\/A/);

    await t.test("final document flow exposes controls, headings and every detail without carousel navigation", () => {
      for (const mobile of [false, true]) {
        for (const timeframe of ["1", "3", "6", "12", "all"] as const) {
          for (const { id } of STATISTICS_VIEWS) {
            const html = render(id, { timeframe, mobile });
            assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
            assert.match(html, /<h1[^>]*>Statistics<\/h1>/);
            assert.doesNotMatch(html, /aria-roledescription="carousel"|aria-roledescription="slide"|Next slide|Previous slide/);
            assert.doesNotMatch(html, /<section[^>]*tabindex=/);
            if (mobile) {
              assert.match(html, /aria-controls="statistics-period-options" aria-expanded="false" aria-label="Show period controls"/);
            }
            assert.match(html, /aria-label="Statistics timeframe"/);
            for (const label of ["1 month", "3 months", "6 months", "1 year", "All time"]) {
              assert.ok(html.includes(`aria-label="${label}"`));
            }
            if (timeframe !== "all") {
              assert.match(html, /aria-label="Previous month"/);
              assert.match(html, /aria-label="Next month"/);
              assert.match(html, /type="month"/);
            } else assert.doesNotMatch(html, /type="month"/);
            if (id !== "spending") {
              const chart = section(html, "Income versus expenses");
              assert.match(chart, /role="region" aria-label="Income and expense chart with exact values" tabindex="0"/);
              assert.deepEqual(definitionText(chart, "dt").slice(0, 2), ["Income", "Expenses"]);
            }
          }
        }
      }
    });

    await t.test("slow-loading feedback uses the final status surface with offline precedence", async () => {
      const { LoadingState } = await server.ssrLoadModule("/src/components/AsyncState.tsx") as { LoadingState: ComponentType<{
        label: string; isSlow: boolean; isOffline: boolean; minHeight: number;
      }> };
      for (const isOffline of [false, true]) {
        const html = renderToString(createElement(ThemeProvider, { theme: appTheme },
          createElement(LoadingState, { label: "Loading statistics...", isSlow: true, isOffline, minHeight: 240 })));
        assert.match(html, /Loading statistics/);
        assert.equal(html.includes("This is taking longer than usual"), !isOffline);
        assert.equal(html.includes("You appear to be offline"), isOffline);
      }
    });

    const comparisonCases = [
      { name: "zero previous activity", current: summary, previous: zeroSummary,
        changes: ["New (increased from zero)", "New (increased from zero)", "New (increased from zero)"], countChange: "New (increased from zero)" },
      { name: "unchanged zero activity", current: zeroSummary, previous: zeroSummary,
        changes: ["Unchanged (0 %)", "Unchanged (0 %)", "Unchanged (0 %)"], countChange: "Unchanged (0 %)" },
      { name: "falling expenses and improving negative balance", current: { ...summary, totalIncome: 120, totalExpense: -150, netBalance: -30, transactionCount: 6 },
        previous: { ...summary, totalIncome: 100, totalExpense: -200, netBalance: -100, transactionCount: 4 },
        changes: ["Increased (+20 %)", "Decreased (-25 %)", "Increased (+70 %)"], countChange: "Increased (+50 %)" },
      { name: "positive expense magnitude and worsening negative balance", current: { ...summary, totalIncome: 75, totalExpense: 125, netBalance: -150, transactionCount: 2 },
        previous: { ...summary, totalIncome: 100, totalExpense: -100, netBalance: -100, transactionCount: 4 },
        changes: ["Decreased (-25 %)", "Increased (+25 %)", "Decreased (-50 %)"], countChange: "Decreased (-50 %)" },
      { name: "unchanged nonzero values", current: summary, previous: summary,
        changes: ["Unchanged (0 %)", "Unchanged (0 %)", "Unchanged (0 %)"], countChange: "Unchanged (0 %)" },
      { name: "new negative balance", current: { ...zeroSummary, totalExpense: -10, netBalance: -10 }, previous: zeroSummary,
        changes: ["Unchanged (0 %)", "New (increased from zero)", "New (decreased from zero)"], countChange: "Unchanged (0 %)" },
      { name: "balance crosses zero", current: { ...summary, totalIncome: 200, totalExpense: -100, netBalance: 100 },
        previous: { ...summary, totalIncome: 100, totalExpense: -200, netBalance: -100 },
        changes: ["Increased (+100 %)", "Decreased (-50 %)", "Increased (+200 %)"], countChange: "Unchanged (0 %)" },
    ];
    for (const mobile of [false, true]) {
      for (const fixture of comparisonCases) {
        const response = { ...data, summary: fixture.current, previousMonthSummary: fixture.previous };
        const before = structuredClone(response);
        const html = render("overview", { response, mobile });
        const panel = section(html, "Month comparison");
        assert.deepEqual(definitionText(panel, "dt"), ["Income", "Expenses", "Net Balance"], fixture.name);
        assert.match(panel, /Januar 2026 vs Dezember 2025/);
        const currentValues = [fixture.current.totalIncome, Math.abs(fixture.current.totalExpense), fixture.current.netBalance];
        const previousValues = [fixture.previous.totalIncome, Math.abs(fixture.previous.totalExpense), fixture.previous.netBalance];
        assert.deepEqual(definitionText(panel, "dd"), currentValues.map((value, i) =>
          `Current ${formatCurrency(value)}Previous ${formatCurrency(previousValues[i])}${fixture.changes[i]}`), fixture.name);
        assert.doesNotMatch(panel, /Transactions|Infinity|NaN|unavailable/);
        const secondary = section(html, "Additional period information");
        assert.ok(secondary.includes(`Previous ${fixture.previous.transactionCount}; ${fixture.countChange}`), fixture.name);
        assert.deepEqual(response, before, "Comparison must not mutate summaries");
      }
      const unavailableHtml = render("overview", { response: { ...data, previousMonthSummary: null }, mobile });
      assert.match(section(unavailableHtml, "Month comparison"), /Previous-month comparison is unavailable/);
      assert.deepEqual(definitionText(section(unavailableHtml, "Month comparison"), "dt"), []);
      assert.deepEqual(definitionText(section(unavailableHtml, "Headline metrics"), "dd"), [formatCurrency(1000), formatCurrency(100), formatCurrency(900), "90 %"]);
      assert.doesNotMatch(section(unavailableHtml, "Additional period information"), /Previous|Unchanged|New \(/);
      for (const timeframe of ["3", "6", "12", "all"] as const) {
        // Deliberately retain a previous summary: a longer-range total must never be compared with it.
        const html = render("overview", { timeframe, mobile });
        const panel = section(html, "Explore this period");
        assert.doesNotMatch(html, /aria-label="Month comparison"/);
        assert.deepEqual(definitionText(panel, "dt"), []);
        assert.match(panel, /one-month selection/);
        const periodSearch = timeframe === "all" ? "timeframe=all" : `timeframe=${timeframe}&amp;month=2026-01`;
        for (const view of ["spending", "trends"]) {
          assert.ok(panel.includes(`href="/statistics/${view}?${periodSearch}&amp;tag=a&amp;tag=b"`));
        }
        assert.doesNotMatch(section(html, "Additional period information"), /Previous|Unchanged|New \(/);
      }
    }

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
        assert.doesNotMatch(html, /aria-roledescription="carousel"|Next slide|Previous slide/, name);
        const headline = section(html, "Headline metrics");
        assert.deepEqual(definitionText(headline, "dt"), ["Income", "Expenses", "Net Balance", "Savings Rate"], name);
        assert.deepEqual(definitionText(headline, "dd"), [
          formatCurrency(current.totalIncome), formatCurrency(Math.abs(current.totalExpense)), formatCurrency(current.netBalance), rate,
        ], name);
        assert.match(headline, /Savings Rate is net balance as a share of income\. It is distinct from Saved \/ Invested\./);
        const secondary = section(html, "Additional period information");
        assert.deepEqual(definitionText(secondary, "dt"), ["Saved / Invested", "Transactions"], name);
        const transactionChange = current.transactionCount === 0 ? "Unchanged (0 %)" : "New (increased from zero)";
        assert.deepEqual(definitionText(secondary, "dd"), [formatCurrency(current.totalSavedOrInvested), `${current.transactionCount}Januar 2026 vs Dezember 2025: Previous 0; ${transactionChange}`], name);
        // Secondary information follows the chart and comparison in normal document order.
        assert.ok(html.indexOf('aria-label="Additional period information"') > html.lastIndexOf('aria-label="Headline metrics"'));
        assert.match(html, /Income versus expenses/);
        assert.ok(html.indexOf('aria-label="Additional period information"') > html.indexOf("Income versus expenses"));
        assert.ok(html.indexOf('aria-label="Headline metrics"') < html.indexOf('aria-label="Income versus expenses"'));
        assert.ok(html.indexOf('aria-label="Income versus expenses"') < html.indexOf('aria-label="Month comparison"'));
        assert.ok(html.indexOf('aria-label="Month comparison"') < html.indexOf('aria-label="Additional period information"'));
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
