/** Framework-independent server logic. Never import this module into the app. */
export type VerifiedUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  passwordAuthenticatedAt: number | null;
};
type Invitation = {
  id: string;
  state: string;
  delivery_code?: string;
};
export type LifecycleBackend = {
  verifyUser(token: string): Promise<VerifiedUser | null>;
  reserveInvitation(
    actor: string,
    id: string,
    email: string,
    role: string,
  ): Promise<{ deliver: boolean; invitation: Invitation }>;
  deliverInvitation(
    email: string,
  ): Promise<{
    userId: string | null;
    code:
      | "sent"
      | "mail_setup_required"
      | "delivery_unconfirmed"
      | "account_exists";
  }>;
  finishInvitation(
    id: string,
    userId: string | null,
    code: string,
  ): Promise<Invitation>;
  beginClosure(userId: string, requestId: string): Promise<{ id: string }>;
  closureMedia(userId: string): Promise<string[]>;
  removeVideos(paths: string[]): Promise<void>;
  clearClosureData(userId: string, requestId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  finishClosure(requestId: string, failed: boolean): Promise<void>;
};
const origins = new Set([
  "https://coachbilliott.github.io",
  "https://repformed.pages.dev",
  "https://repformed.com",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clientErrors = [
  "Owner access is required.",
  "This account already exists. Use Manage account access.",
  "An invitation is already pending. Refresh invitations.",
  "Invitation limit reached. Wait before inviting more people.",
  "Too many delivery attempts. Ask the Owner to check email configuration.",
];
function publicFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (
    clientErrors.find((allowed) => message.includes(allowed)) ||
    "The request was not confirmed. Refresh your account and retry. No successful deletion or email delivery is implied."
  );
}

class LifecycleBodyError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
/** Bound input only. Never time out/replay a mutating account operation. */
async function lifecycleBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new LifecycleBodyError(400, "A request body is required.");
  let stopped = false, cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    // Cancellation itself can stall; it must not delay the rejection response.
    try { void reader.cancel().catch(() => {}); } catch { /* Already closed. */ }
  };
  const read = async () => {
    let text = "", bytes = 0;
    const decoder = new TextDecoder();
    for (;;) {
      if (stopped) throw new Error("Body read stopped");
      const chunk = await reader.read();
      if (stopped) throw new Error("Body read stopped");
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4096) {
        cancel(); throw new LifecycleBodyError(413, "Request is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new Error("Invalid body");
    return value as Record<string, unknown>;
  };
  try {
    return await Promise.race([new Promise<never>((_, reject) => {
      onAbort = () => {
        stopped = true; cancel();
        reject(new LifecycleBodyError(408, "Request interrupted. No account action was started."));
      };
      request.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        stopped = true; cancel();
        reject(new LifecycleBodyError(408, "Request body timed out. No account action was started."));
      }, 10_000);
      if (request.signal.aborted) onAbort();
    }), Promise.resolve().then(read)]);
  } finally {
    stopped = true;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
    try { reader.releaseLock(); } catch { /* A cancelled read may still settle. */ }
  }
}

export function lifecycleHandler(
  backend: LifecycleBackend,
  now = () => Date.now(),
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origin && origins.has(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
      "Access-Control-Allow-Headers":
        "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (status: number, value: unknown) =>
      new Response(JSON.stringify(value), { status, headers });
    if (origin && !origins.has(origin))
      return reply(403, { error: "This website origin is not allowed." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return reply(401, { error: "Sign in again before continuing." });
    let user: VerifiedUser | null;
    try {
      user = await backend.verifyUser(authorization.slice(7));
    } catch {
      return reply(503, {
        error: "Account verification is unavailable. Reconnect and retry.",
      });
    }
    if (!user || !user.emailConfirmed)
      return reply(401, { error: "A verified account is required." });
    let body: Record<string, unknown>;
    try {
      body = await lifecycleBody(request);
    } catch (error) {
      if (error instanceof LifecycleBodyError)
        return reply(error.status, { error: error.message });
      return reply(400, { error: "Invalid request." });
    }
    const requestId = body.requestId;
    if (typeof requestId !== "string" || !uuid.test(requestId))
      return reply(400, { error: "Use a valid request ID." });
    if (body.action === "invite") {
      if (
        Object.keys(body).some(
          (k) => !["action", "requestId", "email", "role"].includes(k),
        ) ||
        typeof body.email !== "string" ||
        body.email.length > 254 ||
        !emailPattern.test(body.email.trim()) ||
        typeof body.role !== "string" ||
        !["manager", "coach", "parent", "athlete"].includes(body.role)
      )
        return reply(400, {
          error:
            "Choose an adult email and Parent, Athlete, Coach or Manager access.",
        });
      const email = body.email.trim().toLowerCase();
      try {
        const reserved = await backend.reserveInvitation(
          user.id,
          requestId,
          email,
          body.role,
        );
        if (!reserved.deliver)
          return reply(200, {
            invitation: reserved.invitation,
            duplicate: true,
          });
        let delivered: Awaited<
          ReturnType<LifecycleBackend["deliverInvitation"]>
        >;
        try {
          delivered = await backend.deliverInvitation(email);
        } catch {
          delivered = { userId: null, code: "delivery_unconfirmed" };
        }
        const invitation = await backend.finishInvitation(
          requestId,
          delivered.userId,
          delivered.code,
        );
        return reply(200, { invitation });
      } catch (error) {
        return reply(400, { error: publicFailure(error) });
      }
    }
    if (
      body.action !== "delete" ||
      body.confirmation !== "DELETE" ||
      Object.keys(body).some(
        (k) => !["action", "requestId", "confirmation"].includes(k),
      )
    )
      return reply(400, { error: "Confirm the account action explicitly." });
    const passwordTime = user.passwordAuthenticatedAt;
    const age = passwordTime === null ? Infinity : now() / 1000 - passwordTime;
    if (!Number.isFinite(age) || age < -30 || age > 300)
      return reply(403, {
        error: "Re-enter your current password before deleting your account.",
      });
    let job: { id: string } | null = null;
    try {
      // Target is the verified caller, never an ID supplied by the browser.
      job = await backend.beginClosure(user.id, requestId);
      const paths = await backend.closureMedia(user.id);
      if (
        paths.some(
          (path) =>
            !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm)$/i.test(
              path,
            ),
        )
      )
        throw new Error("Unexpected private media path.");
      for (let n = 0; n < paths.length; n += 50)
        await backend.removeVideos(paths.slice(n, n + 50));
      await backend.clearClosureData(user.id, job.id);
      await backend.deleteAuthUser(user.id);
      // Auth erasure is definitive. A receipt update failure must not imply that
      // the erased person needs to sign in again to finish deleting the account.
      let receiptSaved = true;
      try {
        await backend.finishClosure(job.id, false);
      } catch {
        receiptSaved = false;
      }
      return reply(200, { deleted: true, requestId: job.id, receiptSaved });
    } catch {
      if (job) {
        try {
          await backend.finishClosure(job.id, true);
        } catch {
          /* Keep the existing frozen request for retry. */
        }
      }
      return reply(409, {
        error: job
          ? "Deletion is unfinished. Access is paused while cleanup is pending. Keep this request and retry; an Owner can review its status."
          : "This account cannot be deleted automatically. Refresh account deletion and use the assisted review option if shown.",
        requestId: job?.id || requestId,
      });
    }
  };
}
