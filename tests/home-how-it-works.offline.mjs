/* global process */
/*
 * Offline public-component contract tests. No browser, server, sockets, or
 * private application code is loaded. TypeScript is a repository devDependency.
 * Run from the repository root:
 *   node --test tests/home-how-it-works.offline.mjs
 * Override the source/compiler paths only to compare an isolated baseline.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const loadModule = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ts = loadModule(process.env.TYPESCRIPT_PATH || "typescript");

const sourcePath = process.env.HOME_SOURCE || path.resolve(__dirname, "../src/Home.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "Home.tsx",
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
  reportDiagnostics: true,
});
const errors = compiled.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
  getCanonicalFileName: (name) => name,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n",
}));
// import.meta.env only supplies the unchanged public media prefix. CommonJS
// cannot evaluate import.meta; no source event handler or target is rewritten.
const runnable = compiled.outputText.replaceAll("import.meta.env.BASE_URL", '"/"');

function flatten(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}

function setup(enabled, { missingTarget = false } = {}) {
  const events = [];
  let activeElement = null;
  const elements = new Map();
  const jsx = (type, props) => ({ type, props: props || {} });
  const imports = {
    react: { useState: (initial) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "./AthleteScene": { AthleteScene: "MockPublicAthleteScene" },
    "./Experience": { Reveal: "MockReveal" },
    "./packageProposals": { PACKAGE_PROPOSALS: [] },
    "./motion": { useMotion: () => ({ enabled }) },
  };
  const exports = {};
  vm.runInNewContext(runnable, {
    exports,
    require: (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
      return imports[name];
    },
    document: {
      getElementById: (id) => elements.get(id) || null,
    },
  }, { filename: sourcePath, timeout: 1000 });
  const nodes = flatten(exports.Home());
  for (const node of nodes) {
    if (typeof node.type !== "string" || !node.props.id) continue;
    const id = node.props.id;
    assert.ok(!elements.has(id), `Duplicate rendered id: ${id}`);
    elements.set(id, {
      node,
      focus: (options) => {
        events.push({ kind: "focus", id, preventScroll: options?.preventScroll });
        // A plain section is not programmatically focusable without tabindex.
        if (Number.isInteger(node.props.tabIndex)) activeElement = id;
      },
      scrollIntoView: (options) => {
        events.push({ kind: "scroll", id, behavior: options?.behavior });
      },
    });
  }
  const controls = nodes.filter((node) => node.type === "button" &&
    flattenText(node.props.children).includes("See how it works"));
  assert.equal(controls.length, 1, "There must be exactly one actual hero control");
  if (missingTarget) elements.delete("how-it-works");
  return {
    click: () => controls[0].props.onClick(),
    elements,
    events,
    activeElement: () => activeElement,
  };
}

function flattenText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return node && typeof node === "object" ? flattenText(node.props?.children) : "";
}

test("the actual scroll target is a named, programmatically focusable public section", () => {
  const { elements } = setup(true);
  const target = elements.get("how-it-works");
  assert.ok(target, "The handler target must exist in the returned Home JSX");
  assert.equal(target.node.type, "section");
  assert.equal(target.node.props.tabIndex, -1, "Do not add an extra normal tab stop");
  const labelIds = target.node.props["aria-labelledby"]?.split(/\s+/) || [];
  assert.equal(labelIds.length, 1);
  const label = elements.get(labelIds[0]);
  assert.ok(label, "The section's accessible-name mapping must resolve");
  assert.equal(label.node.type, "h2");
  assert.equal(flattenText(label.node.props.children), "A week with a clear next step.");
});

for (const enabled of [true, false]) {
  const preference = enabled ? "normal motion" : "reduced motion";
  test(`the actual handler requests focus before scrolling with ${preference}`, () => {
    const page = setup(enabled);
    page.click();
    assert.equal(page.activeElement(), "how-it-works");
    assert.deepEqual(page.events, [
      { kind: "focus", id: "how-it-works", preventScroll: true },
      { kind: "scroll", id: "how-it-works", behavior: enabled ? "smooth" : "auto" },
    ]);
  });
  test(`repeated activation preserves the same target and ${preference}`, () => {
    const page = setup(enabled);
    for (let count = 0; count < 3; count += 1) page.click();
    assert.equal(page.activeElement(), "how-it-works");
    assert.deepEqual(page.events, Array.from({ length: 3 }, () => [
      { kind: "focus", id: "how-it-works", preventScroll: true },
      { kind: "scroll", id: "how-it-works", behavior: enabled ? "smooth" : "auto" },
    ]).flat());
  });
}

test("a missing target is safely ignored", () => {
  const page = setup(true, { missingTarget: true });
  assert.doesNotThrow(page.click);
  assert.deepEqual(page.events, []);
  assert.equal(page.activeElement(), null);
});
