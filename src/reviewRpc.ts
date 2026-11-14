/** Bounds one review RPC, including response parsing; never replays a write.
 * Aborting a request cannot prove whether the server committed it.
 */
export async function boundedReviewRpc<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  readOnly = false,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException(
        readOnly
          ? "Review history could not be loaded in time. Reconnect and refresh."
          : "The request timed out. Its outcome has not been confirmed. Check your review history before retrying the same video.",
        "TimeoutError",
      );
      reject(error);
      controller.abort(error);
    }, 30000);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
