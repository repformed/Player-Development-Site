import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Precache only this project's versioned app shell, never accounts or uploaded media. */
export function appShell(): Plugin {
  return {
    name: "player-development-app-shell",
    apply: "build",
    writeBundle(options, bundle) {
      const publicFiles = [
        "manifest.webmanifest",
        "favicon.svg",
        "brand/repformed-mark.svg",
        "staff/victor-bennett.jpg",
        "staff/devyn-billiott.webp",
        "media/training-poster.jpg",
        "media/family-football.jpg",
        "media/solo-football.jpg",
        "media/repformed-horizontal-football-field.webp",
        "media/credits.txt",
        "icons/app-192.png",
        "icons/app-512.png",
        "icons/maskable-512.png",
        "icons/apple-touch-180.png",
      ];
      const files = [
        ...Object.keys(bundle).filter((name) =>
          /\.(html|js|css|woff2?)$/.test(name),
        ),
        ...publicFiles,
      ].sort();
      const template = readFileSync("build/service-worker.txt", "utf8");
      const hash = createHash("sha256").update(template);
      for (const name of files) {
        const asset = bundle[name];
        hash
          .update(name)
          .update(
            asset
              ? asset.type === "chunk"
                ? asset.code
                : asset.source
              : readFileSync(`public/${name}`),
          );
      }
      const worker = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 16))
        .replace("__ASSETS__", JSON.stringify(files));
      writeFileSync(resolve(options.dir || "dist", "sw.js"), worker);
      // Release metadata stays outside the published directory. Build tooling is
      // immutable to ordinary feature updates; it records compiler outputs.
      mkdirSync("artifacts", { recursive: true });
      const generated = Object.fromEntries(
        Object.entries(bundle).map(([name, asset]) => {
          const bytes = Buffer.from(
            asset.type === "chunk" ? asset.code : asset.source,
          );
          return [
            name,
            {
              bytes: bytes.length,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            },
          ];
        }),
      );
      writeFileSync(
        "artifacts/public-compiler-inventory.json",
        JSON.stringify(
          {
            version: 1,
            generated,
            precache: files,
            worker: {
              bytes: Buffer.byteLength(worker),
              sha256: createHash("sha256").update(worker).digest("hex"),
            },
            templateSha256: createHash("sha256").update(template).digest("hex"),
          },
          null,
          2,
        ) + "\n",
      );
    },
  };
}
