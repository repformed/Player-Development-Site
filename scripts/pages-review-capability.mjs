// Read-only capability check. No provider credential or mutation is used.
import process from "node:process";
import console from "node:console";
import { readOwnerReviews } from "./pages-owner-attestation.mjs";
const number = Number(process.argv[2]);
const result = await readOwnerReviews(number, process.env.GH_TOKEN);
console.log(
  JSON.stringify({
    repository: result.repository,
    pullRequest: number,
    headSha: result.headSha,
    ownerIdentityPresent: !!result.ownerId,
    reviewRecords: result.reviews.length,
    operation: "read-only capability; not review approval",
  }),
);
