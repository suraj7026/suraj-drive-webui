type DigestWorkerResponse =
  | { type: "progress"; bytes: number }
  | { type: "complete"; digest: string }
  | { type: "error"; message: string };

export function sha256File(file: File, signal?: AbortSignal, onProgress?: (bytes: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./digest-worker.ts", import.meta.url), { type: "module" });
    let watchdog: ReturnType<typeof setTimeout>;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        finish();
        reject(new Error("Local file reading stalled. Reselect this file to retry."));
      }, 90_000);
    };
    const finish = () => {
      clearTimeout(watchdog);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException("File verification aborted", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Unable to verify the selected file"));
    };
    worker.onmessage = (event: MessageEvent<DigestWorkerResponse>) => {
      if (event.data.type === "progress") {
        armWatchdog();
        onProgress?.(event.data.bytes);
        return;
      }
      finish();
      if (event.data.type === "complete") {
        resolve(event.data.digest);
      } else {
        reject(new Error(event.data.message));
      }
    };
    armWatchdog();
    worker.postMessage({ file });
  });
}
