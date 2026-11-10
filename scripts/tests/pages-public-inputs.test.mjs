import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { publicPath, publicModuleImports } from "../pages-public-inputs.mjs";
import { root } from "../pages-auto-scope.mjs";
const ts = createRequire(resolve(root, "package.json"))("typescript");
test("reviewable public code, new feature assets and test additions have explicit paths", () => {
  for (const p of [
    "src/Home.tsx",
    "src/Membership.tsx",
    "src/publicFeatures/BackToTop.tsx",
    "src/publicFeatures/back-to-top.css",
    "public/features/back-to-top.svg",
    "public/pages/example/index.html",
    "tests/public-features/back-to-top.spec.ts",
  ])
    assert.equal(publicPath(p), true, p);
});
test("real sensitive/config/identity/deployment paths remain excluded", () => {
  for (const p of [
    "src/App.tsx",
    "src/main.tsx",
    "src/data.ts",
    "src/useSharedContent.ts",
    "src/accounts.ts",
    "src/privateAuth/new.ts",
    "src/publicFeatures/auth/session.ts",
    "src/publicFeatures/billing-client.ts",
    "src/publicFeatures/../../accounts.ts",
    "public/_worker.js",
    "public/features/_headers",
    "public/content-config.json",
    "public/service-policies/index.html",
    "backend/functions/new/index.ts",
    "package-lock.json",
    ".github/workflows/checks.yml",
    "tests/demo-fixture.ts",
  ])
    assert.equal(publicPath(p), false, p);
});
test("reviewed public imports may expand but cannot add private, provider, dynamic-expression or protected symbols", () => {
  const old =
    'import {Reveal} from "./Experience"; export const Home=()=> <p>Existing</p>;';
  assert.doesNotThrow(() =>
    publicModuleImports(
      "src/Home.tsx",
      old,
      'import {Reveal} from "./Experience"; import {lazy} from "react"; const x=import("./publicFeatures/BackToTop"); export const Home=()=> <p>Changed</p>;',
      ts,
    ),
  );
  for (const newer of [
    'import {Owner} from "./Experience";',
    'import {login} from "./accounts";',
    'import("./accounts")',
    "import(path)",
    'import {createClient} from "@supabase/supabase-js";',
  ])
    assert.throws(() => publicModuleImports("src/Home.tsx", old, newer, ts));
});
test("default-plus-named import, re-exports, require and import-equals cannot broaden old protected capability", () => {
  const old = 'import {Reveal} from "./Experience";';
  for (const newer of [
    'import SecretDefault,{Reveal} from "./Experience";',
    'export {NewPrivateSymbol} from "./Experience";',
    'export * from "./Experience";',
    'const load=require;load("./accounts");',
    'import x = require("./accounts");',
    "const evaluate=eval;evaluate(code);",
    'import("./publicFeatures/%2e%2e/accounts")',
  ])
    assert.throws(
      () => publicModuleImports("src/Home.tsx", old, newer, ts),
      newer,
    );
});
