import assert from "node:assert/strict";
import test from "node:test";
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

test("removing a manual override previews the automatic category default", () => {
  const saved = {
    category: "Food & Groceries",
    spendingFlexibility: "Essential",
    spendingFlexibilitySource: "Manual",
  } as const;
  assert.equal(
    getSpendingFlexibilitySummary("UseAutomatic", "Food & Groceries", saved, defaults),
    "Optimizable · Category default",
  );
});
