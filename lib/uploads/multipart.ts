import { clientApiFetch, uploadFileWithProgress, UploadError } from "@/lib/api/client";
import { ApiError } from "@/lib/api/core";

export const multipartThreshold = 32 * 1024 * 1024;

type Session = { token: string; key: string; part_size: number };

function request<T>(route: string, body: object, signal: AbortSignal) {
  return clientApiFetch<T>(`/api/files/multipart${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
  });
}

async function retry<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      signal.throwIfAborted();
      const retryable =
        (error instanceof UploadError && error.retryable) ||
        (error instanceof ApiError && (error.status >= 500 || [408, 429].includes(error.status))) ||
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === "TimeoutError");
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
}

export async function uploadMultipart(
  key: string,
  file: File,
  signal: AbortSignal,
  onProgress: (bytes: number) => void,
  onCompleting: () => void
) {
  const session = await request<Session>("", { key, size: file.size, content_type: file.type }, signal);
  try {
    for (let start = 0, part = 1; start < file.size; start += session.part_size, part++) {
      const chunk = file.slice(start, start + session.part_size);
      await retry(async () => {
        const { url } = await request<{ url: string }>("/part", { token: session.token, part }, signal);
        await uploadFileWithProgress({
          url,
          file: chunk,
          signal,
          stallTimeoutMs: 90_000,
          onProgress: (bytes) => onProgress(start + bytes),
        });
      }, signal);
      onProgress(start + chunk.size);
    }
    onCompleting();
    await retry(() => request("/complete", { token: session.token }, signal), signal);
    return session.key;
  } catch (error) {
    void request("/abort", { token: session.token }, AbortSignal.timeout(10_000)).catch(() => {});
    throw error;
  }
}
