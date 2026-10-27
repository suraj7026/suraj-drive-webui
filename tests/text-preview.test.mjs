import { test } from "node:test";
import assert from "node:assert/strict";
import preview from "../.test-build/lib/api/text-preview.js";
const { fetchTextPreview, MAX_TEXT_PREVIEW_BYTES: limit } = preview;

test("requests a prefix plus one byte to detect truncation", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers.Range, `bytes=0-${limit}`);
    assert.equal(init.credentials, "omit");
    return new Response(new Uint8Array(limit + 1).fill(97), { status: 206 });
  });
  const result = await fetchTextPreview("https://storage.example/test", new AbortController().signal);
  assert.equal(result.text.length, limit);
  assert.equal(result.truncated, true);
});

test("cancels the body when the server ignores Range", async (t) => {
  let cancelled = false;
  let pulls = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(64 * 1024).fill(97));
    },
    cancel() { cancelled = true; },
  }), { status: 200 }));
  const result = await fetchTextPreview("https://storage.example/test", new AbortController().signal);
  assert.equal(result.text.length, limit);
  assert.equal(result.truncated, true);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 10, `read ${pulls} chunks from an unbounded stream`);
});

test("handles exact boundary and empty files without false truncation", async (t) => {
  for (const length of [0, limit]) {
    t.mock.method(globalThis, "fetch", async () => new Response(new Uint8Array(length).fill(97)));
    const result = await fetchTextPreview("https://storage.example/test", new AbortController().signal);
    assert.equal(result.text.length, length);
    assert.equal(result.truncated, false);
  }
});

test("does not append a replacement character for a UTF-8 character cut by the limit", async (t) => {
  const bytes = new Uint8Array(limit + 1).fill(97);
  bytes.set([0xe2, 0x82], limit - 1);
  t.mock.method(globalThis, "fetch", async () => new Response(bytes));
  const result = await fetchTextPreview("https://storage.example/test", new AbortController().signal);
  assert.equal(result.text.length, limit - 1);
  assert.equal(result.truncated, true);
  assert.equal(result.text.includes("\ufffd"), false);
});

test("propagates cancellation to an outstanding fetch", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  }));
  const request = fetchTextPreview("https://storage.example/test", controller.signal);
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});

test("rejects failed storage responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Forbidden", { status: 403 }));
  await assert.rejects(fetchTextPreview("https://storage.example/test", new AbortController().signal), /HTTP 403/);
});
