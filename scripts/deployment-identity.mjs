import { URL } from "node:url";

/** Stable build identity survives public naming/theme changes. No deployment side effects. */
export function assertDeploymentIdentity(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const matches = tags.some(
    (tag) =>
      /\bname\s*=\s*["']application-id["']/i.test(tag) &&
      /\bcontent\s*=\s*["']com\.coachbilliott\.playerdevelopment["']/i.test(
        tag,
      ),
  );
  if (!matches)
    throw new Error("Build this repository's application before publishing.");
}
/** Repository ownership guard only; this function never publishes. */
export function assertPublishingRepository(remote) {
  const origin = new URL(remote);
  if (
    origin.hostname !== "github.com" ||
    origin.pathname.replace(/\.git$/, "").toLowerCase() !==
      "/repformed/player-development-site"
  )
    throw new Error(
      "Publishing is restricted to the Repformed Player Development repository.",
    );
}
