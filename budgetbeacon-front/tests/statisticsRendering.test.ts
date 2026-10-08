import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { ThemeProvider, type Theme } from "@mui/material/styles";

import type { StatisticsOverview } from "../src/types/api.ts";
import { STATISTICS_VIEWS, type StatisticsView } from "../src/features/statistics/statisticsViews.ts";

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
    const render = (view: StatisticsView, options: {
      response?: StatisticsOverview;
      error?: boolean;
      loading?: boolean;
      refreshing?: boolean;
      online?: boolean;
    } = {}) => {
      const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
      const queryKey = ["transactions", "statistics", { allTime: false, endYear: 2026, endMonth: 1, monthsBack: 1 }];
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
      }], { initialEntries: [`${path}?timeframe=1&month=2026-01&tag=a&tag=b`] });
      const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
      Object.defineProperty(globalThis, "navigator", { value: { onLine: options.online ?? true }, configurable: true });
      try {
        return renderToString(createElement(QueryClientProvider, { client },
          createElement(ThemeProvider, { theme: appTheme }, createElement(RouterProvider, { router })),
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
  } finally {
    await server.close();
  }
});
