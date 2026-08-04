import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

type ManifestIcon = {
  src: string;
};

type ManifestShortcut = {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: ManifestIcon[];
};

type WebAppManifest = {
  scope: string;
  shortcuts?: ManifestShortcut[];
};

const publicDirectory = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.webmanifest", publicDirectory), "utf8"),
) as WebAppManifest;

test("defines an in-scope Add transaction PWA shortcut with valid icons", () => {
  const shortcut = manifest.shortcuts?.find(
    (candidate) => candidate.name === "Add transaction",
  );

  assert.ok(shortcut);
  assert.equal(shortcut.short_name, "Add transaction");
  assert.equal(shortcut.url, "/transactions/quick-add");
  assert.ok(shortcut.description?.trim());

  const appOrigin = "https://budgetbeacon.test";
  const scopeUrl = new URL(manifest.scope, appOrigin);
  const shortcutUrl = new URL(shortcut.url, appOrigin);

  assert.equal(shortcutUrl.origin, scopeUrl.origin);
  assert.ok(shortcutUrl.pathname.startsWith(scopeUrl.pathname));
  assert.deepEqual(
    shortcut.icons?.map((icon) => icon.src),
    ["/app-icon-192.png", "/app-icon-512.png"],
  );

  for (const icon of shortcut.icons ?? []) {
    assert.ok(
      existsSync(new URL(icon.src.slice(1), publicDirectory)),
      `Missing shortcut icon: ${icon.src}`,
    );
  }
});
