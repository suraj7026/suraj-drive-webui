import { ApiError } from "../api/core";
import { UploadError } from "../api/client";

export function isTransientUploadError(error: unknown): boolean {
  if (error instanceof UploadError) return error.retryable;
  if (error instanceof ApiError) return error.status === 408 || error.status === 429 || error.status >= 500;
  return error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError");
}

export function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function retryUploadRequest<T>(work: () => Promise<T>, signal: AbortSignal, attempts = 5, baseDelayMs = 1000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await work();
    } catch (error) {
      if (signal.aborted || !isTransientUploadError(error) || attempt + 1 >= attempts) throw error;
      await abortableDelay(Math.min(30_000, baseDelayMs * 2 ** attempt) * (0.75 + Math.random() * 0.5), signal);
    }
  }
}
