import { afterEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { VideoReviews } from "./videoReviews";
import type { PrivatePlayer } from "./accounts";
const id = "80000000-0000-4000-8000-000000000001";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("a stalled review reservation settles once with an unknown outcome and aborts without replay", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  const transport = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal;
    return new Promise<Response>(() => undefined);
  });
  const client = createClient("https://fixture.invalid", "fictional-only", {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let outcome = "pending";
  const request = new VideoReviews(client).send(id, { id } as PrivatePlayer, id,
    new File(["fictional"], "fixture.webm", { type: "video/webm" }), 1);
  void request.then(() => { outcome = "confirmed"; }, () => { outcome = "uncertain"; });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(30000);
  expect(outcome).toBe("uncertain");
  await expect(request).rejects.toMatchObject({ name: "TimeoutError", message: expect.stringContaining("not been confirmed") });
  expect(signal?.aborted).toBe(true);
  expect(transport).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["headers", "body"] as const)("reconciles accepted finalization after stalled %s without uploading or finalizing twice", async mode => {
  vi.useFakeTimers();
  const row = {
    id, profile_id: id, account_id: id, submitted_by: id,
    resource_id: id, drill_title: "Fictional drill", asset_path: `${id}/fictional.webm`,
    media_type: "video/webm", byte_size: 9, duration_seconds: 1,
    status: "uploading", feedback: "", created_at: "2026-11-06T12:00:00Z", version: 1,
  };
  let uploads = 0, finishes = 0;
  let finishSignal: AbortSignal | null | undefined;
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  let lateResponse: ((response: Response) => void) | undefined;
  const ids: string[] = [];
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/begin_athlete_video")) {
      ids.push(JSON.parse(String(init?.body)).review_id);
      return Response.json(row);
    }
    if (path.includes("/storage/v1/object/")) {
      uploads++;
      return Response.json({ Key: path });
    }
    if (path.endsWith("/finish_athlete_video")) {
      finishes++;
      finishSignal = init?.signal;
      row.status = "queued"; row.version = 2;
      if (mode === "headers") return new Promise<Response>(resolve => { lateResponse = resolve; });
      return new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller; } }));
    }
    throw Error("Unexpected fictional transport operation");
  });
  const client = createClient("https://fixture.invalid", "fictional-only", {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const service = new VideoReviews(client);
  const file = new File(["fictional"], "fixture.webm", { type: "video/webm" });
  const first = service.send(id, { id } as PrivatePlayer, id, file, 1);
  void first.catch(() => undefined);
  await vi.waitFor(() => expect(finishes).toBe(1));
  await vi.advanceTimersByTimeAsync(30000);
  await expect(first).rejects.toMatchObject({ name: "TimeoutError", message: expect.stringContaining("not been confirmed") });
  expect(finishSignal?.aborted).toBe(true);
  expect(transport).toHaveBeenCalledTimes(3);
  lateResponse?.(Response.json(row));
  if (body) {
    body.enqueue(new TextEncoder().encode(JSON.stringify(row)));
    body.close();
  }
  await vi.advanceTimersByTimeAsync(0);
  await expect(first).rejects.toMatchObject({ name: "TimeoutError" });
  expect(uploads).toBe(1); expect(finishes).toBe(1);
  const recovered = await service.send(id, { id } as PrivatePlayer, id, file, 1);
  expect(recovered).toMatchObject({ id, status: "queued", version: 2 });
  expect(ids).toEqual([id, id]);
  expect(uploads).toBe(1); expect(finishes).toBe(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds stalled history reads without describing a failed write or replaying the RPC", async () => {
  vi.useFakeTimers();
  const transport = vi.fn(() => new Promise<Response>(() => undefined));
  const client = createClient("https://fixture.invalid", "fictional-only", {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const request = new VideoReviews(client).state({ id } as PrivatePlayer);
  void request.catch(() => undefined);
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(30000);
  await expect(request).rejects.toMatchObject({ name: "TimeoutError", message: "Review history could not be loaded in time. Reconnect and refresh." });
  expect(transport).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
