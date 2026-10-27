import { buildApiUrl, readApiResponse } from "./core";

export async function clientApiFetch<T>(pathname: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const response = await fetch(buildApiUrl(pathname), {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    headers,
    credentials: "include",
    cache: "no-store",
  });

  return readApiResponse<T>(response);
}

type UploadOptions = {
  url: string;
  file: File;
  onProgress?: (loadedBytes: number) => void;
  signal?: AbortSignal;
};

type BlobUploadOptions = {
  url: string;
  data: Blob;
  onProgress?: (loadedBytes: number) => void;
  signal?: AbortSignal;
  stallTimeoutMs?: number;
};

export class UploadError extends Error {
  status: number;
  code?: string;
  detail?: string;
  retryable: boolean;

  constructor(message: string, opts: { status: number; code?: string; detail?: string; retryable: boolean }) {
    super(message);
    this.name = "UploadError";
    this.status = opts.status;
    this.code = opts.code;
    this.detail = opts.detail;
    this.retryable = opts.retryable;
  }
}

export function uploadFileWithProgress({ url, file, onProgress, signal }: UploadOptions) {
  return uploadBlobWithProgress({ url, data: file, onProgress, signal });
}

export function uploadBlobWithProgress({ url, data, onProgress, signal, stallTimeoutMs = 90_000 }: BlobUploadOptions) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    let settled = false;
    let lastLoaded = 0;
    let watchdog: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      signal?.removeEventListener("abort", abortUpload);
      if (error) reject(error);
      else resolve();
    };
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        finish(new UploadError("Upload stalled: no progress from storage. Please retry.", { status: 408, retryable: true }));
        xhr.abort();
      }, stallTimeoutMs);
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (event.loaded > lastLoaded) {
        lastLoaded = event.loaded;
        armWatchdog();
      }
      if (!event.lengthComputable) {
        return;
      }
      onProgress?.(event.loaded);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish();
        return;
      }

      const detail = parseS3ErrorBody(xhr.responseText);
      const codePart = detail?.code ? ` ${detail.code}` : "";
      const messagePart = detail?.message ? `: ${detail.message}` : "";
      const message = `Upload failed (HTTP ${xhr.status}${codePart})${messagePart}`;
      finish(
        new UploadError(message, {
          status: xhr.status,
          code: detail?.code,
          detail: detail?.message,
          retryable: isRetryableUploadStatus(xhr.status, detail?.code),
        })
      );
    });

    xhr.addEventListener("error", () => {
      finish(
        new UploadError("Upload failed: network error", {
          status: 0,
          retryable: true,
        })
      );
    });

    xhr.addEventListener("abort", () => {
      finish(new DOMException("Upload aborted", "AbortError"));
    });

    const abortUpload = () => xhr.abort();
    signal?.addEventListener("abort", abortUpload, { once: true });

    xhr.open("PUT", url);
    if (data.type) {
      xhr.setRequestHeader("Content-Type", data.type);
    }
    armWatchdog();
    try {
      xhr.send(data);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Unable to start upload"));
    }
  });
}

function parseS3ErrorBody(body: string): { code?: string; message?: string } | null {
  if (!body) {
    return null;
  }
  const codeMatch = body.match(/<Code>([^<]+)<\/Code>/);
  const messageMatch = body.match(/<Message>([^<]+)<\/Message>/);
  if (!codeMatch && !messageMatch) {
    return null;
  }
  return { code: codeMatch?.[1], message: messageMatch?.[1] };
}

const RETRYABLE_S3_CODES = new Set([
  "RequestTimeTooSkewed",
  "ExpiredToken",
  "TokenRefreshRequired",
  "InternalError",
  "SlowDown",
  "ServiceUnavailable",
  "RequestTimeout",
  "SignatureDoesNotMatch",
]);

function isRetryableUploadStatus(status: number, code?: string): boolean {
  if (status === 0) {
    return true;
  }
  if (status >= 500) {
    return true;
  }
  if (status === 403 && code && RETRYABLE_S3_CODES.has(code)) {
    return true;
  }
  if (status === 403 && !code) {
    return true;
  }
  if (status === 408 || status === 425 || status === 429) {
    return true;
  }
  return false;
}
