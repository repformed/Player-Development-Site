import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, posix } from "node:path";
import { createRequire } from "node:module";
import {
  root,
  must,
  workflowPath,
  templatePin,
  cssFiles,
  htmlFiles,
  textOnlyJsx,
  publicCss,
} from "./pages-auto-scope.mjs";
export const publicModules = new Set([
  "src/Home.tsx",
  "src/Membership.tsx",
  "src/LearningExample.tsx",
  "src/MeetTheStaff.tsx",
  "src/AthleteScene.tsx",
  "src/SocialLinks.tsx",
]);
export const publicStyles = new Set([
  ...cssFiles,
  "src/homeJourney.css",
  "src/learningExample.css",
  "src/meetTheStaff.css",
  "src/social-links.css",
]);
const staticPages = new Set(htmlFiles);
const dangerous =
  /^(?:auth|account|billing|payment|payments|entitlements?|guardian|private|admin|backend|functions?|credentials?|secrets?)(?:[._-]|$)/i;
const safeSegments = (path) =>
  !path
    .split("/")
    .some((x) => x === ".." || x.startsWith(".") || dangerous.test(x));
export function publicPath(path) {
  if (
    publicModules.has(path) ||
    publicStyles.has(path) ||
    staticPages.has(path) ||
    [
      "public/robots.txt",
      "public/sitemap.xml",
      "public/social-links.json",
    ].includes(path)
  )
    return true;
  if (!safeSegments(path)) return false;
  if (/^src\/publicFeatures\/[A-Za-z0-9_./-]+\.(?:tsx?|jsx?|css)$/.test(path))
    return true;
  if (/^tests\/public-features\/[A-Za-z0-9_/-]+\.spec\.ts$/.test(path))
    return true;
  if (
    /^public\/(?:features|assets|pages)\/[A-Za-z0-9_./-]+\.(?:html|js|css|json|svg|png|jpe?g|webp|avif|gif|woff2?)$/.test(
      path,
    ) &&
    !path.split("/").some((x) => x.startsWith("_"))
  )
    return true;
  return false;
}
const git = (source, args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trimEnd();
export function treeInventory(source, ref) {
  const rows = git(source, ["ls-tree", "-r", "--full-tree", ref])
    .split("\n")
    .filter(Boolean);
  return new Map(
    rows.map((line) => {
      const m = /^(\d+) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(line);
      must(m, "Unrecognized Git inventory");
      return [m[4], { mode: m[1], type: m[2], sha: m[3] }];
    }),
  );
}
export async function publicInputScope(
  source,
  controlSha,
  sourceSha,
  { syntax = true } = {},
) {
  must(
    /^[a-f0-9]{40}$/.test(controlSha) && /^[a-f0-9]{40}$/.test(sourceSha),
    "Exact source/controller identities required",
  );
  must(
    git(source, ["rev-parse", "HEAD"]) === sourceSha,
    "Wrong source checkout",
  );
  execFileSync("git", ["merge-base", "--is-ancestor", controlSha, sourceSha], {
    cwd: source,
    stdio: "pipe",
  });
  const old = treeInventory(source, controlSha),
    now = treeInventory(source, sourceSha),
    changes = [];
  for (const path of new Set([...old.keys(), ...now.keys()])) {
    const a = old.get(path),
      b = now.get(path);
    if (a?.sha === b?.sha && a?.mode === b?.mode) continue;
    must(
      (!a || a.mode === "100644") &&
        (!b || b.mode === "100644") &&
        (!b || b.type === "blob"),
      "Symlink/executable/submodule/mode changes require separate control review",
    );
    if (path === workflowPath) {
      must(
        a && b,
        "Publishing workflow cannot be added or removed as a feature",
      );
      const template = await readFile(resolve(root, workflowPath), "utf8");
      const expected = template.replaceAll(templatePin, controlSha);
      must(
        (await readFile(resolve(source, path), "utf8")) === expected,
        "Only the exact reviewed controller pin is accepted",
      );
    } else
      must(publicPath(path), "Protected or unsupported source path: " + path);
    changes.push({
      path,
      kind: !a ? "added" : !b ? "deleted" : "modified",
      oldSha: a?.sha,
      newSha: b?.sha,
    });
  }
  if (syntax) {
    const ts = createRequire(resolve(source, "package.json"))("typescript");
    for (const change of changes)
      if (
        /\.(?:tsx?|jsx?)$/.test(change.path) &&
        !change.path.startsWith("tests/") &&
        change.kind !== "deleted"
      ) {
        const oldText = change.oldSha
          ? execFileSync("git", ["show", controlSha + ":" + change.path], {
              cwd: source,
              encoding: "utf8",
            })
          : "";
        publicModuleImports(
          change.path,
          oldText,
          await readFile(resolve(source, change.path), "utf8"),
          ts,
        );
      }
  }
  return {
    sourceSha,
    sourceTree: git(source, ["rev-parse", sourceSha + "^{tree}"]),
    controlSha,
    changes,
  };
}
const moduleName = (path) => path.replace(/\.(?:tsx?|jsx?)$/, "");
export function publicModuleImports(path, oldText, newText, ts) {
  const parse = (text) => {
    const sf = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      /\.tsx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    must(sf.parseDiagnostics.length === 0, "Public module parse error");
    return sf;
  };
  const imports = (sf) => {
    const list = [];
    const visit = (node) => {
      must(
        !ts.isImportEqualsDeclaration(node),
        "Import-equals module loading is not supported in public features",
      );
      if (
        ts.isIdentifier(node) &&
        ["require", "eval", "Function"].includes(node.text)
      )
        throw Error("Unsupported indirect public module execution");
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          must(
            ts.isStringLiteral(node.moduleSpecifier),
            "Literal public module reference required",
          );
          const symbols = [];
          if (ts.isImportDeclaration(node)) {
            if (node.importClause?.name) symbols.push("default");
            const binding = node.importClause?.namedBindings;
            if (binding) {
              if (ts.isNamedImports(binding))
                symbols.push(
                  ...binding.elements.map(
                    (x) => (x.propertyName || x.name).text,
                  ),
                );
              else symbols.push("*");
            }
          } else {
            if (node.exportClause && ts.isNamedExports(node.exportClause))
              symbols.push(
                ...node.exportClause.elements.map(
                  (x) => (x.propertyName || x.name).text,
                ),
              );
            else symbols.push("*");
          }
          list.push({
            target: node.moduleSpecifier.text,
            symbols: symbols.sort(),
            dynamic: false,
          });
        }
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        must(
          node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]),
          "Dynamic module expression is not a reviewed public boundary",
        );
        list.push({
          target: node.arguments[0].text,
          symbols: ["*"],
          dynamic: true,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return list;
  };
  const old = imports(parse(oldText || "")),
    current = imports(parse(newText));
  for (const item of current) {
    must(
      !/[\\%?#]/.test(item.target),
      "Encoded/query module loading requires separate review",
    );
    const base = posix.normalize(posix.join(posix.dirname(path), item.target));
    if (["react", "react/jsx-runtime", "lucide-react"].includes(item.target))
      continue;
    if (
      item.target.startsWith(".") &&
      (base.startsWith("src/publicFeatures/") ||
        publicModules.has(base) ||
        [...publicModules].some((x) => moduleName(x) === base) ||
        publicStyles.has(base))
    )
      continue;
    must(
      !item.dynamic &&
        old.some(
          (x) =>
            x.target === item.target &&
            !x.dynamic &&
            item.symbols.every((s) => x.symbols.includes(s)),
        ),
      "New private/backend/provider import is outside the public feature boundary: " +
        item.target,
    );
  }
}
export async function narrowPublicDelta(
  source,
  before,
  after,
  syntaxTools = source,
) {
  const a = treeInventory(source, before),
    b = treeInventory(source, after),
    changes = [];
  const require = createRequire(resolve(syntaxTools, "package.json")),
    ts = require("typescript"),
    postcss = require("postcss");
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    if (
      a.get(path)?.sha === b.get(path)?.sha &&
      a.get(path)?.mode === b.get(path)?.mode
    )
      continue;
    must(
      a.has(path) &&
        b.has(path) &&
        a.get(path).mode === "100644" &&
        b.get(path).mode === "100644",
      "Narrow edits cannot add/delete/rename/mode-change files",
    );
    const old = execFileSync("git", ["show", before + ":" + path], {
        cwd: source,
        encoding: "utf8",
      }),
      current = execFileSync("git", ["show", after + ":" + path], {
        cwd: source,
        encoding: "utf8",
      });
    if (path === "src/Home.tsx") textOnlyJsx(old, current, ts);
    else if (cssFiles.includes(path)) publicCss(old, current, postcss);
    else if (staticPages.has(path))
      execFileSync("python3", [resolve(root, "scripts/pages-public-text.py")], {
        input: JSON.stringify({ old, new: current }),
        stdio: "pipe",
      });
    else
      throw Error(
        "Unreviewed code cannot be inherited through a later narrow edit: " +
          path,
      );
    changes.push(path);
  }
  return changes;
}
