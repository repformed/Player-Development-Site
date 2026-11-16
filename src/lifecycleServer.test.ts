import { afterEach, describe, it, expect, vi } from "vitest";
import {
  lifecycleHandler,
  type LifecycleBackend,
} from "../backend/functions/account-lifecycle/handler";
const actor = "a2000000-0000-4000-8000-000000000001";
const requestId = "a2000000-0000-4000-8000-000000000002";
const media = `${actor}/a2000000-0000-4000-8000-000000000003/a2000000-0000-4000-8000-000000000004.mp4`;
const now = 1800000000000;
function setup() {
  const events: string[] = [];
  const backend: LifecycleBackend = {
    verifyUser: vi.fn(async () => ({
      id: actor,
      email: "fictional@example.test",
      emailConfirmed: true,
      passwordAuthenticatedAt: now / 1000 - 10,
    })),
    reserveInvitation: vi.fn(async () => ({
      deliver: true,
      invitation: { id: requestId, state: "preparing" },
    })),
    deliverInvitation: vi.fn(async () => ({
      userId: "invited-user",
      code: "sent" as const,
    })),
    finishInvitation: vi.fn(async () => ({
      id: requestId,
      state: "sent",
      delivery_code: "sent",
    })),
    beginClosure: vi.fn(async () => {
      events.push("begin");
      return { id: requestId };
    }),
    closureMedia: vi.fn(async () => [media]),
    removeVideos: vi.fn(async () => {
      events.push("storage");
    }),
    clearClosureData: vi.fn(async () => {
      events.push("records");
    }),
    deleteAuthUser: vi.fn(async () => {
      events.push("auth");
    }),
    finishClosure: vi.fn(async (_id, failed) => {
      events.push(failed ? "failed" : "completed");
    }),
  };
  return { backend, handle: lifecycleHandler(backend, () => now), events };
}
function req(
  body: unknown,
  token = "Bearer verified",
  origin = "https://coachbilliott.github.io",
) {
  return new Request(
    "https://project.supabase.co/functions/v1/account-lifecycle",
    {
      method: "POST",
      headers: {
        Authorization: token,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
const deletion = { action: "delete", requestId, confirmation: "DELETE" };
const invitation = {
  action: "invite",
  requestId,
  email: "Invited@EXAMPLE.test",
  role: "coach",
};
afterEach(() => vi.useRealTimers());
it("bounds a stalled body before any invitation or deletion work starts", async () => {
  vi.useFakeTimers();
  const f = setup();
  const request = req(invitation);
  const cancel = vi.fn(async () => {});
  let release!: (value: ReadableStreamReadResult<Uint8Array>) => void;
  Object.defineProperty(request, "body", { value: {
    getReader: () => ({ read: () => new Promise(resolve => { release = resolve; }), cancel }),
  } });
  let settled = false;
  const response = f.handle(request).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(10_001);
  expect(settled).toBe(true);
  expect((await response).status).toBe(408);
  release({ done: true, value: undefined });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.backend.reserveInvitation).not.toHaveBeenCalled();
  expect(f.backend.beginClosure).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});
it("does not wait for a stalled cancellation after rejecting an oversized body", async () => {
  vi.useFakeTimers();
  const f = setup();
  const request = req(invitation);
  Object.defineProperty(request, "body", { value: { getReader: () => ({
    read: async () => ({ done: false, value: new Uint8Array(4097) }),
    cancel: () => new Promise(() => {}),
  }) } });
  let settled = false;
  const response = f.handle(request).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(10_001);
  expect(settled).toBe(true);
  expect((await response).status).toBe(413);
  expect(f.backend.reserveInvitation).not.toHaveBeenCalled();
  expect(f.backend.beginClosure).not.toHaveBeenCalled();
});
it("rejects an interrupted body without starting or replaying an account action", async () => {
  const f = setup();
  const controller = new AbortController();
  const request = new Request(req(invitation), { signal: controller.signal });
  const cancel = vi.fn(async () => {});
  Object.defineProperty(request, "body", { value: {
    getReader: () => ({ read: () => new Promise(() => {}), cancel }),
  } });
  controller.abort();
  expect((await f.handle(request)).status).toBe(408);
  expect(cancel).toHaveBeenCalledOnce();
  expect(f.backend.reserveInvitation).not.toHaveBeenCalled();
  expect(f.backend.beginClosure).not.toHaveBeenCalled();
});
it("rejects an abort during an outstanding read and ignores its late completion", async () => {
  const f = setup();
  const controller = new AbortController();
  const request = new Request(req(invitation), { signal: controller.signal });
  let release!: (value: ReadableStreamReadResult<Uint8Array>) => void;
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  Object.defineProperty(request, "body", { value: { getReader: () => ({
    read: () => { markStarted(); return new Promise(resolve => { release = resolve; }); },
    cancel: async () => {},
  }) } });
  const response = f.handle(request);
  await started; controller.abort();
  expect((await response).status).toBe(408);
  release({ done: false, value: new TextEncoder().encode(JSON.stringify(invitation)) });
  await Promise.resolve(); await Promise.resolve();
  expect(f.backend.reserveInvitation).not.toHaveBeenCalled();
  expect(f.backend.beginClosure).not.toHaveBeenCalled();
});
describe("trusted account lifecycle handler", () => {
  it("rejects absent, invalid and unverified sessions before privileged work", async () => {
    const { backend, handle } = setup();
    expect((await handle(req(deletion, ""))).status).toBe(401);
    vi.mocked(backend.verifyUser).mockResolvedValueOnce(null);
    expect((await handle(req(deletion))).status).toBe(401);
    expect(backend.beginClosure).not.toHaveBeenCalled();
  });
  it("rejects another browser origin", async () => {
    const { backend, handle } = setup();
    expect(
      (
        await handle(
          req(invitation, "Bearer verified", "https://unrelated.example"),
        )
      ).status,
    ).toBe(403);
    expect(backend.verifyUser).not.toHaveBeenCalled();
  });
  it.each(["https://repformed.com", "https://repformed.pages.dev"])(
    "accepts the production origin %s without bypassing session verification",
    async (origin) => {
      const { backend, handle } = setup();
      const preflight = await handle(
        new Request("https://project.supabase.co", {
          method: "OPTIONS",
          headers: { Origin: origin },
        }),
      );
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      const unsigned = await handle(req(invitation, "", origin));
      expect(unsigned.status).toBe(401);
      expect(backend.verifyUser).not.toHaveBeenCalled();
      const signed = await handle(req(invitation, "Bearer verified", origin));
      expect(signed.status).toBe(200);
      expect(signed.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(backend.verifyUser).toHaveBeenCalledWith("verified");
    },
  );
  it("supports native preflight without running any account operation", async () => {
    const { backend, handle } = setup();
    const response = await handle(
      new Request("https://project.supabase.co", {
        method: "OPTIONS",
        headers: { Origin: "capacitor://localhost" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost",
    );
    expect(backend.verifyUser).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies and client-supplied deletion targets", async () => {
    const { backend, handle } = setup();
    expect(
      (await handle(req({ ...deletion, targetUser: "another-person" }))).status,
    ).toBe(400);
    expect(
      (await handle(req({ ...invitation, email: "a".repeat(5000) }))).status,
    ).toBe(413);
    expect(backend.beginClosure).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and recent password authentication", async () => {
    const { backend, handle } = setup();
    expect(
      (await handle(req({ ...deletion, confirmation: "yes" }))).status,
    ).toBe(400);
    vi.mocked(backend.verifyUser).mockResolvedValueOnce({
      id: actor,
      email: "fictional@example.test",
      emailConfirmed: true,
      passwordAuthenticatedAt: now / 1000 - 301,
    });
    expect((await handle(req(deletion))).status).toBe(403);
    expect(backend.beginClosure).not.toHaveBeenCalled();
  });
  it("does not accept a fresh refresh token as a password reauthentication", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.verifyUser).mockResolvedValueOnce({
      id: actor,
      email: "fictional@example.test",
      emailConfirmed: true,
      passwordAuthenticatedAt: null,
    });
    expect((await handle(req(deletion))).status).toBe(403);
  });
  it("deletes only the verified caller, in media/records/Auth order", async () => {
    const { backend, handle, events } = setup();
    const response = await handle(req(deletion));
    expect(await response.json()).toMatchObject({ deleted: true, requestId });
    expect(backend.beginClosure).toHaveBeenCalledWith(actor, requestId);
    expect(backend.deleteAuthUser).toHaveBeenCalledWith(actor);
    expect(events).toEqual([
      "begin",
      "storage",
      "records",
      "auth",
      "completed",
    ]);
  });
  it("stops before data/Auth deletion if media removal fails", async () => {
    const { backend, handle, events } = setup();
    vi.mocked(backend.removeVideos).mockRejectedValueOnce(
      new Error("Private backend failure"),
    );
    expect((await handle(req(deletion))).status).toBe(409);
    expect(backend.clearClosureData).not.toHaveBeenCalled();
    expect(backend.deleteAuthUser).not.toHaveBeenCalled();
    expect(events).toEqual(["begin", "failed"]);
  });
  it("never accepts unexpected server-returned media paths", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.closureMedia).mockResolvedValueOnce([
      "../training-media/another-person.mp4",
    ]);
    expect((await handle(req(deletion))).status).toBe(409);
    expect(backend.removeVideos).not.toHaveBeenCalled();
  });
  it("keeps a failed Auth deletion frozen and retryable without a false success", async () => {
    const { backend, handle, events } = setup();
    vi.mocked(backend.deleteAuthUser).mockRejectedValueOnce(
      new Error("Failed"),
    );
    const response = await handle(req(deletion));
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("deleted");
    expect(events).toEqual(["begin", "storage", "records", "failed"]);
  });
  it("reports confirmed Auth erasure honestly if receipt saving alone fails", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.finishClosure).mockRejectedValueOnce(
      new Error("Receipt timeout"),
    );
    expect(await (await handle(req(deletion))).json()).toMatchObject({
      deleted: true,
      receiptSaved: false,
    });
  });
  it("uses the verified Owner identity, normalized email and server-approved role", async () => {
    const { backend, handle } = setup();
    expect((await handle(req(invitation))).status).toBe(200);
    expect(backend.reserveInvitation).toHaveBeenCalledWith(
      actor,
      requestId,
      "invited@example.test",
      "coach",
    );
    expect(backend.deliverInvitation).toHaveBeenCalledWith(
      "invited@example.test",
    );
    expect((await handle(req({ ...invitation, role: "owner" }))).status).toBe(
      400,
    );
  });
  it("does not send another email for a duplicate request", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.reserveInvitation).mockResolvedValueOnce({
      deliver: false,
      invitation: { id: requestId, state: "sent" },
    });
    expect(await (await handle(req(invitation))).json()).toMatchObject({
      duplicate: true,
    });
    expect(backend.deliverInvitation).not.toHaveBeenCalled();
  });
  it("retains a safe failed status when delivery is not confirmed", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.deliverInvitation).mockRejectedValueOnce(
      new Error("SMTP password=PRIVATE"),
    );
    await handle(req(invitation));
    expect(backend.finishInvitation).toHaveBeenCalledWith(
      requestId,
      null,
      "delivery_unconfirmed",
    );
  });
  it("does not expose raw service errors or credential-shaped provider output", async () => {
    const { backend, handle } = setup();
    vi.mocked(backend.reserveInvitation).mockRejectedValueOnce(
      new Error("server token=PRIVATE"),
    );
    const response = await handle(req(invitation));
    expect(await response.text()).not.toContain("PRIVATE");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
