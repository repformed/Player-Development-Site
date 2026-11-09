import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const workflowPath = ".github/workflows/repformed-auto-pages.yml";
export const templatePin = "0000000000000000000000000000000000000000";
export const cssFiles = [
  "src/memberships.css",
  "public/help.css",
  "public/learn/guides.css",
];
export const htmlFiles = [
  "public/online-football-training/index.html",
  "public/football-iq/index.html",
  "public/offensive-line-fundamentals/index.html",
  "public/parent-guide/index.html",
];
export const must = (ok, message) => {
  if (!ok) throw Error(message);
};
const git = (source, args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trimEnd();
export function textOnlyJsx(oldText, newText, ts) {
  const normalize = (text) => {
    const sf = ts.createSourceFile(
      "Home.tsx",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    must(sf.parseDiagnostics.length === 0, "Public JSX parse error");
    const spans = [];
    const walk = (node) => {
      if (ts.isJsxText(node)) {
        const p = node.parent;
        const tag = p?.openingElement?.tagName?.getText(sf)?.toLowerCase();
        if (
          /^[a-z][a-z0-9-]*$/.test(tag || "") &&
          !["script", "style", "textarea", "iframe"].includes(tag)
        )
          spans.push([node.pos, node.end]);
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
    for (const [a, b] of spans.reverse())
      text = text.slice(0, a) + "__PUBLIC_TEXT__" + text.slice(b);
    return text;
  };
  must(
    normalize(oldText) === normalize(newText),
    "Home code, tags, attributes or expressions changed",
  );
}
export function publicCss(oldText, newText, postcss) {
  const properties = new Set([
    "font-size",
    "line-height",
    "gap",
    "row-gap",
    "column-gap",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "max-width",
    "min-width",
    "border-radius",
  ]);
  const scoped = (selector) =>
    selector
      .split(",")
      .every((s) =>
        /\.(?:proposed-memberships|proposed-package|membership-availability|proposal-[\w-]+|help-document|wrap|hero|section|lesson|quiz|actions|card|grid|top|crumb)(?![\w-])/.test(
          s,
        ),
      );
  const safeValue = (prop, value) => {
    must(!/[\\!;{}:@"'/-]/.test(value), "Unsupported CSS value syntax");
    const tokens =
      value.match(
        /(?:\d*\.)?\d+(?:px|rem|em|%|vw)?|(?:clamp|min|max)|[,()\s]+/g,
      ) || [];
    must(tokens.join("") === value, "Unsupported CSS value grammar");
    for (const t of tokens) {
      const m = /^((?:\d*\.)?\d+)(px|rem|em|%|vw)?$/.exec(t);
      if (!m) continue;
      const n = Number(m[1]),
        u = m[2] || "";
      if (prop === "font-size")
        must(
          n >=
            ({ px: 8, rem: 0.5, em: 0.5, "%": 50, vw: 0.5 }[u] ?? Infinity) &&
            n <= ({ px: 96, rem: 6, em: 6, "%": 300, vw: 10 }[u] ?? -1),
          "Font size out of public range",
        );
      else if (prop === "line-height")
        must(
          (u === "" || u === "em") && n >= 1 && n <= 3,
          "Line height out of range",
        );
      else if (prop === "max-width" || prop === "min-width")
        must(
          n >= ({ px: 128, rem: 8, em: 8, "%": 50, vw: 50 }[u] ?? Infinity) &&
            n <= ({ px: 1600, rem: 120, em: 120, "%": 100, vw: 100 }[u] ?? -1),
          "Public width out of range",
        );
      else
        must(
          (n === 0 || !!u) &&
            n <= ({ px: 128, rem: 8, em: 8, "%": 25, vw: 10, "": 0 }[u] ?? -1),
          "Public spacing out of range",
        );
    }
  };
  const parse = (text) => {
    const ast = postcss.parse(text);
    const decl = [];
    ast.walkDecls((n) => decl.push(n));
    return decl;
  };
  const a = parse(oldText),
    b = parse(newText);
  must(a.length === b.length, "CSS declaration structure changed");
  const spans = [[], []];
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (x.value === y.value) continue;
    must(
      x.prop === y.prop &&
        x.parent.type === "rule" &&
        y.parent.type === "rule" &&
        x.parent.selector === y.parent.selector &&
        scoped(x.parent.selector) &&
        properties.has(x.prop) &&
        !x.important &&
        !y.important,
      "CSS change needs separate review",
    );
    safeValue(y.prop, y.value);
    for (const [k, node, text] of [
      [0, x, oldText],
      [1, y, newText],
    ]) {
      const start = node.source.start.offset,
        end = node.source.end.offset + 1,
        part = text.slice(start, end);
      const colon = part.indexOf(":");
      let from = start + colon + 1;
      while (/\s/.test(text[from] || "")) from++;
      must(
        text.slice(from, from + node.value.length) === node.value,
        "Nonliteral CSS value needs review",
      );
      spans[k].push([from, from + node.value.length]);
    }
  }
  const normalize = (text, k) => {
    for (const [a, b] of spans[k].reverse())
      text = text.slice(0, a) + "__PUBLIC_VALUE__" + text.slice(b);
    return text;
  };
  must(
    normalize(oldText, 0) === normalize(newText, 1),
    "CSS bytes outside allowed declarations changed",
  );
}
export async function eligibility(
  source,
  controlSha,
  sourceSha,
  { syntax = true } = {},
) {
  must(
    /^[a-f0-9]{40}$/.test(controlSha) &&
      controlSha !== templatePin &&
      /^[a-f0-9]{40}$/.test(sourceSha),
    "Exact source/control identities required",
  );
  must(
    git(source, ["rev-parse", "HEAD"]) === sourceSha,
    "Source checkout identity mismatch",
  );
  const sourceTree = git(source, ["rev-parse", "HEAD^{tree}"]);
  const diffs = git(source, [
    "diff",
    "--raw",
    "--no-abbrev",
    controlSha,
    sourceSha,
  ])
    .split("\n")
    .filter(Boolean);
  const changed = [];
  for (const line of diffs) {
    const m =
      /^:(100644|100755) (100644|100755) [a-f0-9]{40} [a-f0-9]{40} M\t(.+)$/.exec(
        line,
      );
    must(
      m && m[1] === m[2],
      "New/deleted/renamed/mode-changed files require review",
    );
    changed.push(m[3]);
  }
  const approved = new Set([
    ...cssFiles,
    ...htmlFiles,
    "src/Home.tsx",
    workflowPath,
  ]);
  for (const path of changed)
    must(approved.has(path), "Outside automatic public scope: " + path);
  const expected = (
    await readFile(resolve(root, workflowPath), "utf8")
  ).replaceAll(templatePin, controlSha);
  must(
    (await readFile(resolve(source, workflowPath), "utf8")) === expected,
    "Automatic workflow differs from reviewed pinned template",
  );
  if (syntax) {
    const require = createRequire(resolve(source, "package.json"));
    const ts = require("typescript"),
      postcss = require("postcss");
    for (const path of changed) {
      if (path === workflowPath) continue;
      const current = await readFile(resolve(source, path), "utf8");
      // git show preserves trailing newlines; trimEnd above is unsuitable for byte comparisons.
      const original = execFileSync("git", ["show", controlSha + ":" + path], {
        cwd: source,
        encoding: "utf8",
      });
      if (path === "src/Home.tsx") textOnlyJsx(original, current, ts);
      else if (cssFiles.includes(path)) publicCss(original, current, postcss);
      else
        execFileSync(
          "python3",
          [resolve(root, "scripts/pages-public-text.py")],
          {
            input: JSON.stringify({ old: original, new: current }),
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
    }
  }
  return { sourceSha, sourceTree, controlSha, changed };
}
