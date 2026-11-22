import assert from "node:assert/strict";
import test from "node:test";
import { readNavigationCollapsed, saveNavigationCollapsed } from "../src/components/navigationPreference.ts";

test("desktop navigation starts expanded and restores both saved states", (t) => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  t.after(() => { Reflect.deleteProperty(globalThis, "window"); });

  assert.equal(readNavigationCollapsed(), false);
  saveNavigationCollapsed(true);
  assert.equal(readNavigationCollapsed(), true);
  saveNavigationCollapsed(false);
  assert.equal(readNavigationCollapsed(), false);

  for (const key of values.keys()) values.set(key, "invalid");
  assert.equal(readNavigationCollapsed(), false);
});

test("unavailable browser storage leaves navigation expanded by default", (t) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() { throw new Error("Storage is blocked"); },
    },
  });
  t.after(() => { Reflect.deleteProperty(globalThis, "window"); });

  assert.equal(readNavigationCollapsed(), false);
  assert.doesNotThrow(() => saveNavigationCollapsed(true));
});
