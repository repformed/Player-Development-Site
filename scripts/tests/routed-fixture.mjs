import { mkdtemp, mkdir, writeFile, rm, symlink, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { root } from "../pages-auto-scope.mjs";
export async function fixture(withPublic = false) {
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-routing-"));
  const git = (args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const put = async (p, data) => {
    await mkdir(resolve(dir, p, ".."), { recursive: true });
    await writeFile(resolve(dir, p), data);
  };
  const commit = () => {
    git(["add", "."]);
    git([
      "-c",
      "user.name=Fictional local fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "fictional fixture",
    ]);
    return git(["rev-parse", "HEAD"]);
  };
  git(["init"]);
  await put(".gitignore", "node_modules\n");
  await put(
    ".github/workflows/repformed-auto-pages.yml",
    'env:\n  PUBLIC_CONTROL_SHA: "' + "0".repeat(40) + '"\n',
  );
  await put("src/Home.tsx", "export const Home=()=> <p>Existing text</p>;\n");
  await put("src/App.tsx", 'const safeHash=["home","contact"];\n');
  await put("index.html", "<main>fixture</main>\n");
  await put(
    "README.md",
    "Visit https://coachbilliott.github.io/Player-Development-Site/#contact\n## Published demo and deployment\nUnchanged deployment guidance\n",
  );
  const p = {
    name: "fixture",
    version: "1.0.0",
    scripts: { build: "unchanged" },
    dependencies: { app: "1.0.0" },
    devDependencies: { tool: "1.0.0" },
  };
  const row = (version, dev) => ({
    version,
    dev,
    resolved: "https://registry.npmjs.org/tool/-/tool.tgz",
    integrity: "sha512-Ynl0ZXM=",
  });
  const lock = {
    name: p.name,
    version: p.version,
    lockfileVersion: 3,
    packages: {
      "": p,
      "node_modules/app": row("1.0.0", false),
      "node_modules/tool": row("1.0.0", true),
    },
  };
  await put("package.json", JSON.stringify(p));
  await put("package-lock.json", JSON.stringify(lock));
  if (withPublic)
    await cp(
      resolve(process.env.PUBLIC_TEST_SOURCE || root, "public"),
      resolve(dir, "public"),
      { recursive: true },
    );
  const control = commit();
  await put(
    ".github/workflows/repformed-auto-pages.yml",
    'env:\n  PUBLIC_CONTROL_SHA: "' + control + '"\n',
  );
  const base = commit();
  await symlink(resolve(root, "node_modules"), resolve(dir, "node_modules"));
  return {
    dir,
    git,
    put,
    commit,
    control,
    base,
    p,
    lock,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
