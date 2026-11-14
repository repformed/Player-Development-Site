import { afterEach, describe, expect, it, vi } from "vitest";
import { DRILLS } from "./data";
import {
  practiceResumeSchema,
  resumeItems,
  type PracticeResume,
} from "./practiceResume";
import { staffHandoff, takeStaffHandoff } from "./staffHandoff";
import { progressFetch, trackUpload } from "./uploadProgress";
const actor = "91000000-0000-4000-8000-000000000001",
  other = "91000000-0000-4000-8000-000000000002",
  resource = "91000000-0000-4000-8000-000000000003";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("scoped staff navigation", () => {
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    });
  }
  it("survives a non-consuming render, consumes once and never crosses staff accounts", () => {
    storage();
    staffHandoff(actor, resource, "workout");
    expect(takeStaffHandoff(actor, "workout", false)).toBe(resource);
    expect(takeStaffHandoff(actor, "editor")).toBeNull();
    expect(takeStaffHandoff(actor, "workout")).toBe(resource);
    expect(takeStaffHandoff(actor, "workout")).toBeNull();
    staffHandoff(actor, resource, "editor");
    expect(takeStaffHandoff(other, "editor")).toBeNull();
    expect(takeStaffHandoff(actor, "editor")).toBeNull();
  });
  it("expires a handoff instead of restoring an old workflow", () => {
    storage();
    vi.useFakeTimers();
    staffHandoff(actor, resource, "workout");
    vi.advanceTimersByTime(3600001);
    expect(takeStaffHandoff(actor, "workout")).toBeNull();
  });
});
describe("resume reconciliation", () => {
  const drill = {
    ...DRILLS[0],
    id: resource,
    source: "shared" as const,
    visibility: "member_only" as const,
    backendVersion: 3,
    reviewStage: "approved" as const,
  };
  const resume: PracticeResume = {
    profile_id: other,
    session_id: actor,
    resource_ids: [resource],
    resource_versions: [3],
    current_index: 0,
    workout_id: actor,
    workout_version: 2,
    assignment_version: 1,
    permission_version: 0,
    version: 1,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 1000).toISOString(),
  };
  const assignment = {
    id: actor,
    title: "Original session",
    summary: "",
    resource_ids: [resource],
    version: 2,
    eligible: true,
  };
  it("reopens only fresh approved resources in the assigned order", () => {
    expect(resumeItems(resume, [drill], assignment)).toEqual([drill]);
    expect(
      resumeItems(resume, [{ ...drill, backendVersion: 4 }], assignment),
    ).toBeNull();
    expect(
      resumeItems(resume, [{ ...drill, reviewStage: "pending" }], assignment),
    ).toBeNull();
    expect(
      resumeItems(resume, [drill], { ...assignment, resource_ids: [other] }),
    ).toBeNull();
    expect(
      resumeItems(resume, [drill], { ...assignment, version: 3 }),
    ).toBeNull();
  });
  it("rejects malformed saved positions and missing version lists", () => {
    expect(
      practiceResumeSchema.safeParse({ ...resume, current_index: 1 }).success,
    ).toBe(false);
    expect(
      practiceResumeSchema.safeParse({ ...resume, resource_versions: [] })
        .success,
    ).toBe(false);
  });
});
describe("real upload progress transport", () => {
  it("preserves the authenticated upload and reports network progress without changing ordinary fetches", async () => {
    const sent: { headers: Record<string, string>; body: unknown } = {
      headers: {},
      body: null,
    };
    let progress = 0;
    class FakeXHR {
      status = 200;
      statusText = "OK";
      response = new Blob(['{"Key":"original"}'], { type: "application/json" });
      responseType = "";
      upload: {
        onprogress?: (e: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void;
      } = {};
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      open = vi.fn();
      setRequestHeader(k: string, v: string) {
        sent.headers[k] = v;
      }
      getAllResponseHeaders() {
        return "content-type: application/json\r\n";
      }
      send(body: unknown) {
        sent.body = body;
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 5,
          total: 10,
        });
        queueMicrotask(() => this.onload?.());
      }
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const normal = vi.fn().mockResolvedValue(new Response("ordinary"));
    vi.stubGlobal("fetch", normal);
    const body = new Blob(["original"]);
    const response = await trackUpload(
      "training-media/original",
      (p) => (progress = p.loaded / p.total),
      () =>
        progressFetch(
          "https://fixture.supabase.co/storage/v1/object/training-media/original",
          {
            method: "POST",
            headers: { Authorization: "Bearer fictional-only" },
            body,
          },
        ),
    );
    expect(await response.json()).toEqual({ Key: "original" });
    expect(progress).toBe(0.5);
    expect(sent.headers.authorization).toBe("Bearer fictional-only");
    expect(sent.body).toBe(body);
    expect(normal).not.toHaveBeenCalled();
    await progressFetch(
      "https://fixture.supabase.co/storage/v1/object/training-media/original",
      { method: "POST", body },
    );
    expect(normal).toHaveBeenCalledOnce();
  });
  it("removes aborted transfer observers so retry uses a fresh request", async () => {
    class AbortedXHR {
      responseType = "";
      upload = {};
      onabort?: () => void;
      open() {}
      setRequestHeader() {}
      send() {}
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", AbortedXHR);
    const controller = new AbortController();
    const request = trackUpload(
      "training-media/cancel",
      () => undefined,
      () =>
        progressFetch(
          "https://fixture.supabase.co/storage/v1/object/training-media/cancel",
          {
            method: "POST",
            body: new Blob(["original"]),
            signal: controller.signal,
          },
        ),
    );
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    const fetch = vi.fn().mockResolvedValue(new Response("retry"));
    vi.stubGlobal("fetch", fetch);
    await progressFetch(
      "https://fixture.supabase.co/storage/v1/object/training-media/cancel",
      { method: "POST", body: new Blob(["original"]) },
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});

it("settles a stalled observed upload on timeout, detaches abort and allows a fresh same-path retry", async () => {
  const instances: StalledXHR[] = [];
  class StalledXHR {
    timeout = 0;
    responseType = "";
    upload = {};
    ontimeout?: () => void;
    onabort?: () => void;
    constructor() { instances.push(this); }
    open() {}
    setRequestHeader() {}
    send() {}
    abort() { this.onabort?.(); }
  }
  vi.stubGlobal("XMLHttpRequest", StalledXHR);
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const url = "https://fixture.invalid/storage/v1/object/athlete-review-videos/fictional-clip";
  const request = trackUpload("athlete-review-videos/fictional-clip", () => undefined,
    () => progressFetch(url, { method: "POST", body: new Blob(["fictional"]), signal: controller.signal }));
  void request.catch(() => undefined);
  try {
    const xhr = instances[0];
    expect(xhr.timeout).toBe(300000);
    expect(xhr.ontimeout).toBeTypeOf("function");
    xhr.ontimeout!();
    await expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    const ordinary = vi.fn().mockResolvedValue(new Response("fresh"));
    vi.stubGlobal("fetch", ordinary);
    await progressFetch(url, { method: "POST", body: new Blob(["fictional"]) });
    expect(ordinary).toHaveBeenCalledOnce();
  } finally { controller.abort(); }
});
