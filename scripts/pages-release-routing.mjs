// Trusted routing is dependency-free. Source parsers run only in the uncredentialed build.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { must, workflowPath, templatePin } from "./pages-auto-scope.mjs";
import {
  treeInventory,
  publicPath,
  publicModuleImports,
  narrowPublicDelta,
} from "./pages-public-inputs.mjs";
import {
  protectedScope,
  readerDocuments,
  readerLinkDelta,
  developmentDependencyDelta,
} from "./pages-protected-scope.mjs";
import {
  publicReviewEvidence,
  sourceAuthorization,
  sameSourceAuthorization,
} from "./pages-public-evidence.mjs";
export const operationalBootstrapBase =
  "c15a0e08f0b85c04ba70c380042e794220cb3805";
const git = (source, args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trimEnd();
const read = (source, ref, path) =>
  execFileSync("git", ["show", ref + ":" + path], {
    cwd: source,
    encoding: "utf8",
  });
const sha = (x) => /^[a-f0-9]{40}$/.test(x || "");
const packagePaths = new Set(["package.json", "package-lock.json"]);
export function changedPaths(source, before, after) {
  const a = treeInventory(source, before),
    b = treeInventory(source, after),
    changes = [];
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(path),
      y = b.get(path);
    if (x?.sha === y?.sha && x?.mode === y?.mode) continue;
    must(
      (!x || x.mode === "100644") &&
        (!y || y.mode === "100644") &&
        (!y || y.type === "blob"),
      "Executable/link/submodule changes require separate control review",
    );
    changes.push({ path, before: x?.sha, after: y?.sha });
  }
  return changes;
}
export function frozenControls(source, control, selected) {
  const changes = changedPaths(source, control, selected);
  const expected = read(source, control, workflowPath).replaceAll(
    templatePin,
    control,
  );
  must(
    read(source, selected, workflowPath) === expected,
    "Exact independently reviewed controller/workflow pin required",
  );
  for (const { path } of changes)
    must(
      path === workflowPath ||
        publicPath(path) ||
        readerDocuments.has(path) ||
        packagePaths.has(path),
      "Cumulative protected state changed: " + path,
    );
  if (changes.some((x) => packagePaths.has(x.path)))
    developmentDependencyDelta(
      ...[control, selected].map((ref) =>
        JSON.parse(read(source, ref, "package.json")),
      ),
      ...[control, selected].map((ref) =>
        JSON.parse(read(source, ref, "package-lock.json")),
      ),
    );
  return changes;
}
export async function routedScope(
  source,
  control,
  selected,
  { syntax = false, syntaxTools = source } = {},
) {
  must(
    sha(control) &&
      sha(selected) &&
      git(source, ["rev-parse", "HEAD"]) === selected,
    "Exact source/controller checkout required",
  );
  execFileSync("git", ["merge-base", "--is-ancestor", control, selected], {
    cwd: source,
    stdio: "pipe",
  });
  const inherited = frozenControls(source, control, selected);
  const parents = git(source, ["show", "-s", "--format=%P", selected])
    .split(" ")
    .filter(Boolean);
  must(
    parents.length === 1 || parents.length === 2,
    "Unsupported main commit shape",
  );
  const baselineSha = parents[0];
  const delta = changedPaths(source, baselineSha, selected);
  must(delta.length > 0, "No main-source change");
  let kind;
  const exactControlTree = inherited.every((x) => x.path === workflowPath);
  if (
    exactControlTree &&
    baselineSha === operationalBootstrapBase &&
    parents.length === 2
  )
    kind = "controller-bootstrap";
  else if (delta.every((x) => packagePaths.has(x.path))) {
    kind = "development-dependencies";
    protectedScope(source, baselineSha, selected);
  } else if (delta.every((x) => readerDocuments.has(x.path))) {
    kind = "reader-documentation";
    protectedScope(source, baselineSha, selected);
  } else {
    must(
      delta.every((x) => publicPath(x.path)),
      "Mixed/protected main change has no automatic release category",
    );
    kind = "public-feature";
    if (syntax) {
      const ts = createRequire(resolve(syntaxTools, "package.json"))(
        "typescript",
      );
      for (const x of delta)
        if (
          x.after &&
          /\.(?:tsx?|jsx?)$/.test(x.path) &&
          !x.path.startsWith("tests/")
        )
          publicModuleImports(
            x.path,
            x.before ? read(source, baselineSha, x.path) : "",
            read(source, selected, x.path),
            ts,
          );
    }
  }
  return {
    kind,
    sourceSha: selected,
    sourceTree: git(source, ["rev-parse", selected + "^{tree}"]),
    controlSha: control,
    baselineSha,
    parents,
    changes: delta,
  };
}
function coarseNarrow(source, before, after) {
  const paths = changedPaths(source, before, after);
  must(
    paths.length > 0 &&
      paths.every(
        (x) =>
          x.before &&
          x.after &&
          (x.path === "src/Home.tsx" ||
            [
              "src/memberships.css",
              "public/help.css",
              "public/learn/guides.css",
              "public/online-football-training/index.html",
              "public/football-iq/index.html",
              "public/offensive-line-fundamentals/index.html",
              "public/parent-guide/index.html",
            ].includes(x.path)),
      ),
    "Unreviewed non-narrow source has no authority",
  );
  return paths.map((x) => x.path);
}
export async function routeAuthorization(source, scope, restRead, graphRead) {
  let authorization;
  if (scope.kind === "public-feature" && scope.parents.length === 1)
    authorization = await sourceAuthorization(
      source,
      scope.sourceSha,
      restRead,
      graphRead,
      { delta: async (s, a, b) => coarseNarrow(s, a, b) },
    );
  else {
    authorization = await publicReviewEvidence(
      scope.sourceSha,
      restRead,
      graphRead,
    );
    must(
      authorization && authorization.reviewedTree === scope.sourceTree,
      "Current exact-tree independent review required for protected/merged release",
    );
    const pr = await restRead(
      "/repos/repformed/Player-Development-Site/pulls/" +
        authorization.prNumber,
    );
    const commit = await restRead(
      "/repos/repformed/Player-Development-Site/git/commits/" + scope.sourceSha,
    );
    must(
      scope.parents.length === 2 &&
        commit.parents?.length === 2 &&
        commit.parents[0].sha === scope.baselineSha &&
        commit.parents[1].sha === authorization.reviewedHead &&
        pr.base.sha === scope.baselineSha &&
        pr.merge_commit_sha === scope.sourceSha,
      "Authenticated merge parents/base/head association required",
    );
  }
  return { ...scope, authorization };
}
export async function revalidateAuthorization(
  source,
  route,
  restRead,
  graphRead,
) {
  const scope = await routedScope(source, route.controlSha, route.sourceSha);
  must(
    scope.kind === route.kind &&
      scope.sourceTree === route.sourceTree &&
      scope.baselineSha === route.baselineSha,
    "Fresh main route differs",
  );
  const fresh = await routeAuthorization(source, scope, restRead, graphRead);
  sameSourceAuthorization(route.authorization, fresh.authorization);
  return fresh;
}
export async function validateUncredentialedRoute(
  source,
  route,
  { syntaxTools = source } = {},
) {
  const scope = await routedScope(source, route.controlSha, route.sourceSha, {
    syntax: true,
    syntaxTools,
  });
  must(
    JSON.stringify(scope) ===
      JSON.stringify(
        Object.fromEntries(
          Object.entries(route).filter(
            ([k]) =>
              k !== "authorization" &&
              k !== "runId" &&
              k !== "attempt" &&
              k !== "workflowSha",
          ),
        ),
      ),
    "Trusted route differs from uncredentialed checkout",
  );
  for (const step of route.authorization.chain || []) {
    const changes = await narrowPublicDelta(
      source,
      step.parent,
      step.sourceSha,
      syntaxTools,
    );
    must(
      JSON.stringify(changes) === JSON.stringify(step.changes),
      "Narrow syntax proof differs",
    );
  }
  return scope;
}
export async function docsContinuity(
  source,
  productionSha,
  parentSha,
  restRead,
  graphRead,
  checkCI,
  { allowPublic = false } = {},
) {
  let current = parentSha;
  const chain = [];
  for (let n = 0; n <= 64; n++) {
    if (current === productionSha) return chain;
    must(n < 64, "Unpublished documentation chain exceeds bound");
    const parents = git(source, ["show", "-s", "--format=%P", current]).split(
      " ",
    );
    must(
      parents.length === 1 || parents.length === 2,
      "Unsupported unpublished main source",
    );
    const paths = changedPaths(source, parents[0], current);
    if (allowPublic && paths.length && paths.every((x) => publicPath(x.path))) {
      // The latest source's exact full-tree review or syntactically proved narrow chain covers these public bytes.
      chain.push({
        sourceSha: current,
        baselineSha: parents[0],
        coveredPublicAncestor: true,
      });
      current = parents[0];
      continue;
    }
    must(
      parents.length === 2,
      "Unpublished documentation requires merged-PR identity",
    );
    const proof = protectedScopeAtRef(source, parents[0], current);
    must(
      proof.kind === "reader-documentation",
      "Unpublished non-documentation change before release",
    );
    const authorization = await publicReviewEvidence(
      current,
      restRead,
      graphRead,
    );
    must(
      authorization &&
        authorization.reviewedHead === parents[1] &&
        authorization.reviewedTree === proof.sourceTree,
      "Unpublished documentation lacks exact review",
    );
    await checkCI(current);
    chain.push({ sourceSha: current, baselineSha: parents[0], authorization });
    current = parents[0];
  }
  throw Error("Documentation continuity incomplete");
}
function protectedScopeAtRef(source, baseline, selected) {
  // No checkout mutation: validators use immutable Git blobs and only the source argument's HEAD check needs a view.
  const paths = changedPaths(source, baseline, selected);
  must(
    paths.every((x) => x.before && x.after && readerDocuments.has(x.path)),
    "Not a documentation-only ancestry step",
  );
  const inventory = treeInventory(source, selected),
    app = read(source, selected, "src/App.tsx");
  for (const { path } of paths)
    readerLinkDelta(
      path,
      read(source, baseline, path),
      read(source, selected, path),
      (name) => inventory.has(name),
      app,
    );
  return {
    kind: "reader-documentation",
    sourceTree: git(source, ["rev-parse", selected + "^{tree}"]),
    paths,
  };
}
