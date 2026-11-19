import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import type { Transaction } from "../src/types/api.ts";
import { getSpendingFlexibilitySummary } from "../src/features/transactions/spendingFlexibility.ts";

const defaults = { "Food & Groceries": "Optimizable", "Eating Out": "Optional" } as const;

test("manual Unclassified suppresses an available automatic default", () => {
  assert.equal(
    getSpendingFlexibilitySummary("Unclassified", "Food & Groceries", undefined, defaults),
    "Unclassified · Manual",
  );
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Food & Groceries", undefined, defaults),
    "Optimizable · Category default",
  );
});

test("automatic preview uses the saved API result, or the new category's default after an edit", () => {
  const saved = {
    category: "Eating Out",
    spendingFlexibility: "Optional",
    spendingFlexibilitySource: "CategoryDefault",
    flexibilityConfidence: null,
  } as const;
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Eating Out", saved),
    "Optional · Category default",
  );
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Travel", saved, defaults),
    "Unclassified · No automatic assessment",
  );
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Travel", saved),
    undefined,
  );
});

test("removing a manual override defers the automatic result until saving", () => {
  const saved = {
    category: "Food & Groceries",
    spendingFlexibility: "Essential",
    spendingFlexibilitySource: "Manual",
    flexibilityConfidence: null,
  } as const;
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Food & Groceries", saved, defaults),
    "Automatic assessment will be shown after saving",
  );
});

test("labels the AI source and suggests review only below the confidence threshold", () => {
  const saved = {
    category: "Food & Groceries",
    spendingFlexibility: "Essential",
    spendingFlexibilitySource: "Ai",
    flexibilityConfidence: 0,
  } as const;
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", saved.category, saved, defaults),
    "Essential · AI · Review suggested",
  );
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", saved.category, { ...saved, flexibilityConfidence: 0.7 }, defaults),
    "Essential · AI",
  );
  assert.equal(
    getSpendingFlexibilitySummary("Optional", saved.category, saved, defaults),
    "Optional · Manual",
  );
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Eating Out", saved, defaults),
    "Optional · Category default",
  );
});

test("renders the saved AI assessment in a form with an unchanged description containing repeated spaces", async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    logLevel: "error",
  });

  try {
    const { TransactionForm } = await server.ssrLoadModule(
      "/src/features/transactions/components/TransactionForm.tsx",
    ) as { TransactionForm: ComponentType<{ transaction: Transaction }> };
    const { NotificationProvider } = await server.ssrLoadModule(
      "/src/components/NotificationProvider.tsx",
    ) as { NotificationProvider: ComponentType<{ children?: ReactNode }> };
    const transaction: Transaction = {
      id: "test-transaction",
      date: "2026-11-01",
      amount: -675,
      description: "RENT  NOVEMBER",
      category: "Housing & Utilities",
      treatment: "Expense",
      notes: null,
      aiConfidenceScore: 0.96,
      spendingFlexibilityOverride: null,
      spendingFlexibility: "Essential",
      spendingFlexibilitySource: "Ai",
      flexibilityConfidence: 0.65,
    };
    const html = renderToString(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(MemoryRouter, null,
        createElement(NotificationProvider, null, createElement(TransactionForm, { transaction })))));
    assert.match(html, /Essential · AI · Review suggested/);
  } finally {
    await server.close();
  }
});
