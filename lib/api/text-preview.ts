export const MAX_TEXT_PREVIEW_BYTES = 512 * 1024;

export async function fetchTextPreview(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: { Range: `bytes=0-${MAX_TEXT_PREVIEW_BYTES}` },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (response.status === 204 || (response.status === 416 && response.headers.get("Content-Range") === "bytes */0")) {
    return { text: "", truncated: false };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error("Text preview stream is unavailable.");

  // A server may ignore Range. Bound retained bytes and stop reading regardless.
  const bytes = new Uint8Array(MAX_TEXT_PREVIEW_BYTES);
  const reader = response.body.getReader();
  let length = 0;
  let truncated = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_TEXT_PREVIEW_BYTES - length;
      const copied = Math.min(remaining, value.byteLength);
      bytes.set(value.subarray(0, copied), length);
      length += copied;
      if (value.byteLength > remaining) {
        truncated = true;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal.throwIfAborted();
  return {
    text: new TextDecoder().decode(bytes.subarray(0, length), { stream: truncated }),
    truncated,
  };
}
