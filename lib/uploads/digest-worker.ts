import { createSHA256 } from "hash-wasm";

type DigestRequest = { file: File };
type DigestResponse =
  | { type: "progress"; bytes: number }
  | { type: "complete"; digest: string }
  | { type: "error"; message: string };

self.onmessage = async (event: MessageEvent<DigestRequest>) => {
  try {
    const hasher = await createSHA256();
    hasher.init();
    const reader = event.data.file.stream().getReader();
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      hasher.update(chunk.value);
      bytes += chunk.value.byteLength;
      self.postMessage({ type: "progress", bytes } satisfies DigestResponse);
    }
    self.postMessage({ type: "complete", digest: hasher.digest("hex") } satisfies DigestResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Unable to verify the selected file",
    } satisfies DigestResponse);
  }
};

export {};
