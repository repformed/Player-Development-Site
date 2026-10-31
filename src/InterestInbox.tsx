import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PACKAGE_PROPOSALS } from "./packageProposals";
// This RPC projects request history, not withdrawals or current permission.
const schema = z.array(
  z.object({
    id: z.string().uuid(),
    adult_name: z.string(),
    email: z.string(),
    package_interest: z.string(),
    created_at: z.string(),
    email_state: z.enum([
      "disabled",
      "queued",
      "processing",
      "retry",
      "accepted",
      "failed",
      "suppressed",
      "uncertain",
    ]),
    launch_choice: z.boolean().nullable().default(null),
    launch_choice_at: z.string().nullable().default(null),
    launch_notice_version: z.string().nullable().default(null),
    launch_requested_at: z.string().nullable().default(null),
    launch_requested_version: z.string().nullable().default(null),
  }),
);
export function InterestInbox({
  client,
  actor,
}: {
  client: SupabaseClient;
  actor: string;
}) {
  const [snapshot, setSnapshot] = useState<{
      actor: string;
      attempt: number;
      rows: z.infer<typeof schema>;
    } | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await client.rpc("interest_staff_inbox");
        if (error)
          throw new Error(
            "Interest requests could not be loaded. Please retry.",
          );
        const rows = schema.parse(data);
        if (active) {
          setSnapshot({ actor, rows, attempt: refresh });
          setError("");
        }
      } catch {
        if (active) {
          setSnapshot(null);
          setError("Interest requests could not be loaded. Please retry.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [client, actor, refresh]);
  const rows = snapshot?.actor === actor ? snapshot.rows : null;
  const loading =
    !error &&
    (!snapshot || snapshot.actor !== actor || snapshot.attempt !== refresh);
  return (
    <section
      className="panel"
      aria-label="Private package interest inbox"
      aria-busy={loading}
    >
      <h2>Package interest</h2>
      <p>Latest 100 requests.</p>
      <p>
        Launch-email permission: Review needed. Check prior requests and
        withdrawals before sending.
      </p>
      <button
        className="button secondary"
        disabled={loading}
        onClick={() => {
          setError("");
          setRefresh((v) => v + 1);
        }}
      >
        Refresh interest requests
      </button>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading interest requests…</p>}
      {rows &&
        (!rows.length ? (
          <p>No interest requests recorded.</p>
        ) : (
          <ul className="delivery-list">
            {rows.map((r) => {
              const hasLatestChoice =
                r.launch_choice !== null &&
                r.launch_choice_at &&
                r.launch_notice_version;
              const hasLaunchRequest =
                r.launch_requested_at && r.launch_requested_version;
              return (
                <li key={r.id}>
                  <strong>{r.adult_name || r.email}</strong>
                  {r.adult_name && <p>{r.email}</p>}
                  <p>
                    {PACKAGE_PROPOSALS.find((p) => p.id === r.package_interest)
                      ?.name ||
                      (r.package_interest === "undecided"
                        ? "Not sure yet"
                        : r.package_interest)}
                  </p>
                  <p>
                    Latest launch-email choice:{" "}
                    {hasLatestChoice
                      ? r.launch_choice
                        ? "Requested"
                        : "Not selected"
                      : "Not recorded"}
                  </p>
                  {hasLaunchRequest &&
                    (!hasLatestChoice || !r.launch_choice) && (
                      <p>Launch request on record for this email.</p>
                    )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
