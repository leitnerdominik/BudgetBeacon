import assert from "node:assert/strict";
import test from "node:test";
import { COLOR_MODE_KEY, readColorMode, resolveColorMode, saveColorMode } from "../src/theme/colorMode.ts";

test("system appearance applies until an explicit choice overrides future system changes", () => {
  assert.equal(resolveColorMode(null, false), "light");
  assert.equal(resolveColorMode(null, true), "dark");
  assert.equal(resolveColorMode("light", true), "light");
  assert.equal(resolveColorMode("dark", false), "dark");
});

test("preference survives reload, rejects invalid values, and tolerates unavailable storage", (t) => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  t.after(() => { Reflect.deleteProperty(globalThis, "window"); });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
  assert.equal(readColorMode(), null);
  saveColorMode("dark");
  assert.equal(readColorMode(), "dark");
  saveColorMode("light");
  assert.equal(readColorMode(), "light");
  values.set(COLOR_MODE_KEY, "invalid");
  assert.equal(readColorMode(), null);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("blocked"); } } });
  assert.equal(readColorMode(), null);
  assert.doesNotThrow(() => saveColorMode("dark"));
});
