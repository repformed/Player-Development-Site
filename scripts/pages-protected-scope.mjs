// Dependency-free, read-only classification. This module grants no deployment authority.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { URL } from "node:url";
const fail = (ok, message) => {
  if (!ok) throw Error(message);
};
const canonical = (x) =>
  JSON.stringify(x, (_, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );
const same = (a, b) => canonical(a) === canonical(b);
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" });
const sha = (x) => /^[a-f0-9]{40}$/.test(x || "");
export const readerDocuments = new Set([
  "ACCOUNT-LIFECYCLE.md",
  "APP-TESTING.md",
  "PARTNER-GUIDE.md",
  "README.md",
  "UPLOAD-GUIDE.md",
  "VIEWS-GUIDE.md",
]);
const oldOrigin = "https://coachbilliott.github.io/Player-Development-Site/";
const newOrigin = "https://repformed.com/";
function resolvePackage(packages, from, name) {
  let scope = from;
  for (;;) {
    const key = (scope ? scope + "/" : "") + "node_modules/" + name;
    if (packages[key]) return key;
    if (!scope) return null;
    const n = scope.lastIndexOf("node_modules/");
    fail(n >= 0, "Unsupported package scope");
    scope = scope.slice(0, n).replace(/\/$/, "");
  }
}
// Include optional and peer resolutions as well as dependencies; dev flags are not authority.
export function runtimeGraph(lock) {
  fail(
    lock.lockfileVersion === 3 && lock.packages?.[""],
    "npm lock v3/root required",
  );
  const packages = lock.packages,
    visited = new Set(),
    queue = [""];
  while (queue.length) {
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    const row = packages[key];
    fail(
      row && !row.link && !row.workspaces,
      "Workspace/link runtime resolution unsupported",
    );
    const names = new Set([
      ...Object.keys(row.dependencies || {}),
      ...Object.keys(row.optionalDependencies || {}),
      ...Object.keys(row.peerDependencies || {}),
    ]);
    for (const name of names) {
      const resolved = resolvePackage(packages, key, name);
      const optional =
        name in (row.optionalDependencies || {}) ||
        row.peerDependenciesMeta?.[name]?.optional;
      fail(resolved || optional, "Unresolved runtime dependency/peer: " + name);
      if (resolved) queue.push(resolved);
    }
  }
  return Object.fromEntries(
    [...visited]
      .filter(Boolean)
      .sort()
      .map((k) => [k, packages[k]]),
  );
}
export function developmentDependencyDelta(
  beforePackage,
  afterPackage,
  beforeLock,
  afterLock,
) {
  for (const value of [beforePackage, afterPackage])
    for (const [name, range] of Object.entries(value.devDependencies || {}))
      fail(
        /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) &&
          typeof range === "string" &&
          /^[~^]?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(range),
        "Only reviewed semver development declarations supported; no URL/alias/workspace sources",
      );
  const withoutDev = (x) =>
    Object.fromEntries(
      Object.entries(x).filter(([k]) => k !== "devDependencies"),
    );
  fail(
    same(withoutDev(beforePackage), withoutDev(afterPackage)),
    "Only devDependencies may change in package.json; scripts/runtime/config are frozen",
  );
  fail(
    same(
      Object.fromEntries(
        Object.entries(beforeLock).filter(([k]) => k !== "packages"),
      ),
      Object.fromEntries(
        Object.entries(afterLock).filter(([k]) => k !== "packages"),
      ),
    ),
    "Lock root metadata changed",
  );
  fail(
    same(
      withoutDev(beforeLock.packages?.[""] || {}),
      withoutDev(afterLock.packages?.[""] || {}),
    ),
    "Lock package root metadata/runtime changed",
  );
  fail(
    same(afterLock.packages[""].devDependencies, afterPackage.devDependencies),
    "Package/lock development declarations differ",
  );
  fail(
    same(
      beforeLock.packages[""].devDependencies,
      beforePackage.devDependencies,
    ),
    "Baseline package/lock declarations differ",
  );
  fail(
    same(runtimeGraph(beforeLock), runtimeGraph(afterLock)),
    "Runtime/optional/peer graph changed",
  );
  const changes = [];
  for (const name of new Set([
    ...Object.keys(beforeLock.packages),
    ...Object.keys(afterLock.packages),
  ])) {
    if (!name) continue;
    const a = beforeLock.packages[name],
      b = afterLock.packages[name];
    if (same(a, b)) continue;
    fail(
      (!a || a.dev === true) && (!b || b.dev === true),
      "Non-development lock node changed: " + name,
    );
    for (const row of [a, b].filter(Boolean)) {
      let url;
      try {
        url = new URL(row.resolved);
      } catch {
        throw Error("Registry URL required: " + name);
      }
      fail(
        url.protocol === "https:" &&
          url.hostname === "registry.npmjs.org" &&
          !url.port &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          !row.link &&
          !row.workspaces,
        "Unapproved package source: " + name,
      );
      fail(
        /^sha(?:256|384|512)-[A-Za-z0-9+/]+=*$/.test(row.integrity || ""),
        "Package integrity required: " + name,
      );
      fail(
        !row.hasInstallScript,
        "Changed installation hook requires separate review: " + name,
      );
    }
    changes.push({
      path: name,
      before: a?.version || null,
      after: b?.version || null,
    });
  }
  fail(changes.length > 0, "No dependency change");
  return {
    changedNodes: changes,
    installPolicy:
      "npm ci --ignore-scripts; any required hook needs separate scoped review",
    meaning:
      "Integrity binds package bytes, not safety; exact-tree review and audit still required",
  };
}
export function readerLinkDelta(path, before, after, fileExists, appSource) {
  fail(readerDocuments.has(path), "Document not in reader-link scope");
  const a = before.split("\n"),
    b = after.split("\n");
  fail(a.length === b.length, "Reader repair must preserve lines");
  let replacements = 0;
  const targets = [];
  const deploymentStart =
    path === "README.md"
      ? a.findIndex((x) => x === "## Published demo and deployment")
      : Infinity;
  fail(deploymentStart >= 0, "Known README deployment boundary required");
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    fail(
      a[i].includes(oldOrigin) &&
        a[i].replaceAll(oldOrigin, newOrigin) === b[i],
      "Only exact reader URL prefixes may change",
    );
    fail(i < deploymentStart, "Deployment procedure excluded");
    for (const match of a[i].matchAll(
      /https:\/\/coachbilliott\.github\.io\/Player-Development-Site\/[^\s<>)]*/g,
    )) {
      const next = match[0]
          .replace(/[.,;:]+$/, "")
          .replace(oldOrigin, newOrigin),
        url = new URL(next);
      fail(
        !url.username &&
          !url.password &&
          url.origin === "https://repformed.com",
        "Canonical reader origin required",
      );
      const route = decodeURIComponent(url.pathname);
      fail(
        !route.includes("..") && !route.includes("\\"),
        "Unsafe reader route",
      );
      fail(
        fileExists(route === "/" ? "index.html" : "public" + route),
        "No source equivalent for reader route: " + route,
      );
      if (url.hash)
        fail(
          appSource.includes(JSON.stringify(url.hash.slice(1))),
          "Unknown application fragment",
        );
      replacements++;
      targets.push(next);
    }
  }
  fail(replacements > 0, "No reader URL change");
  return { replacements, targets: [...new Set(targets)].sort() };
}
export function protectedScope(source, baseline, selected) {
  fail(
    sha(baseline) && sha(selected) && baseline !== selected,
    "Exact distinct baseline/source commits required",
  );
  fail(
    git(source, ["rev-parse", "HEAD"]).trim() === selected,
    "Wrong selected checkout",
  );
  git(source, ["merge-base", "--is-ancestor", baseline, selected]);
  const diff = git(source, ["diff", "--raw", "--no-abbrev", baseline, selected])
    .trim()
    .split("\n")
    .filter(Boolean);
  fail(diff.length > 0, "No protected source change");
  const paths = diff.map((line) => {
    const m = /^:100644 100644 [a-f0-9]{40} [a-f0-9]{40} M\t(.+)$/.exec(line);
    fail(
      m,
      "Only regular-file modifications supported; no rename/link/mode changes",
    );
    return m[1];
  });
  const read = (ref, path) => git(source, ["show", ref + ":" + path]);
  let kind, details;
  if (paths.every((p) => ["package.json", "package-lock.json"].includes(p))) {
    kind = "development-dependencies";
    details = developmentDependencyDelta(
      ...[baseline, selected].map((ref) =>
        JSON.parse(read(ref, "package.json")),
      ),
      ...[baseline, selected].map((ref) =>
        JSON.parse(read(ref, "package-lock.json")),
      ),
    );
  } else if (paths.every((p) => readerDocuments.has(p))) {
    kind = "reader-documentation";
    const inventory = new Set(
      git(source, ["ls-tree", "-r", "--name-only", selected])
        .trim()
        .split("\n"),
    );
    const app = read(selected, "src/App.tsx");
    details = paths.map((p) => ({
      path: p,
      ...readerLinkDelta(
        p,
        read(baseline, p),
        read(selected, p),
        (name) => inventory.has(posix.normalize(name)),
        app,
      ),
    }));
  } else
    throw Error(
      "Mixed or unsupported protected changes; auth/account/billing/backend/release controls remain gated",
    );
  return {
    version: 1,
    kind,
    baselineSha: baseline,
    baselineTree: git(source, ["rev-parse", baseline + "^{tree}"]).trim(),
    sourceSha: selected,
    sourceTree: git(source, ["rev-parse", selected + "^{tree}"]).trim(),
    paths: paths.sort(),
    details,
    scopeDigest: createHash("sha256")
      .update(
        canonical({
          baselineSha: baseline,
          sourceSha: selected,
          kind,
          paths: paths.sort(),
          details,
        }),
      )
      .digest("hex"),
    grantsDeploymentAuthority: false,
  };
}
