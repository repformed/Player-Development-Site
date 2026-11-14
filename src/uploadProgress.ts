export type UploadProgress = { loaded: number; total: number };
const observers = new Map<string, (progress: UploadProgress) => void>();
export async function trackUpload<T>(
  path: string,
  callback: ((progress: UploadProgress) => void) | undefined,
  action: () => Promise<T>,
) {
  if (!callback) return action();
  const key = `/storage/v1/object/${path}`;
  observers.set(key, callback);
  try {
    return await action();
  } finally {
    observers.delete(key);
  }
}
/** Preserve the SDK's authenticated request, using XHR only for observed uploads. */
export function progressFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const notify = observers.get(new URL(url).pathname);
  if (!notify || !init?.body)
    return fetch(input, { ...init, cache: "no-store" });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method || "POST", url);
    xhr.responseType = "blob";
    // A transport budget, not a review-delivery promise. A retry keeps the reserved ID.
    xhr.timeout = 5 * 60 * 1000;
    new Headers(init.headers).forEach((value, key) =>
      xhr.setRequestHeader(key, value),
    );
    const signal = init.signal;
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) notify({ loaded: e.loaded, total: e.total });
    };
    xhr.onload = () => {
      cleanup();
      const headers = new Headers();
      for (const line of xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)) {
        const split = line.indexOf(":");
        if (split > 0)
          headers.append(line.slice(0, split), line.slice(split + 1).trim());
      }
      resolve(
        new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers,
        }),
      );
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("The upload connection was interrupted."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new DOMException(
        "The upload timed out. Retry the same video or check your history.",
        "TimeoutError",
      ));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload canceled.", "AbortError"));
    };
    if (signal?.aborted) {
      reject(new DOMException("Upload canceled.", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(init.body as XMLHttpRequestBodyInit);
  });
}
