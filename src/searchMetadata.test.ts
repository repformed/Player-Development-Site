import { describe, it, expect } from "vitest";
import { publicSearchRoute } from "./searchMetadata";
describe("public search route allowlist", () => {
  it("includes only genuine homepage sections", () => {
    for (const hash of ["", "#home", "#membership", "#staff", "#contact"])
      expect(publicSearchRoute(new URL("https://repformed.com/" + hash))).toBe(true);
  });
  it("excludes accounts, private routes, samples and query-bearing links", () => {
    for (const path of ["/#account", "/#workspace", "/#demo", "/#staff-settings", "/#unknown", "/?source=app", "/?code=secret", "/?interest=1#membership", "/preview/private/", "/interest-privacy.html"])
      expect(publicSearchRoute(new URL("https://repformed.com" + path))).toBe(false);
  });
});
