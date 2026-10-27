import { test } from "node:test";
import assert from "node:assert/strict";
import queueModule from "../.test-build/lib/uploads/queue.js";
import clientModule from "../.test-build/lib/api/client.js";
import retryModule from "../.test-build/lib/uploads/retry.js";
const { UploadQueue } = queueModule;
const { uploadBlobWithProgress, UploadError } = clientModule;
const { retryUploadRequest, abortableDelay } = retryModule;
const tick = () => new Promise((resolve) => setImmediate(resolve));

class FakeXHR {
  static sent = [];
  timeout = 0;
  listeners = new Map();
  upload = { addEventListener: (name, fn) => { this.progress = fn; } };
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  open() {}
  setRequestHeader() {}
  send() { FakeXHR.sent.push(this); FakeXHR.onSend?.(this); }
  abort() { this.aborted = true; this.listeners.get("abort")?.(); }
  succeed() { this.status = 200; this.listeners.get("load")(); }
}

function stubXHR(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  Object.defineProperty(globalThis, "XMLHttpRequest", { value: FakeXHR, configurable: true, writable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "XMLHttpRequest", previous); else delete globalThis.XMLHttpRequest; });
}

test("107-file queue proceeds past 12 completed files when three storage requests stall", async (t) => {
  stubXHR(t);
  FakeXHR.sent = [];
  FakeXHR.onSend = (xhr) => {
    if (![13, 14, 15].includes(FakeXHR.sent.length)) queueMicrotask(() => xhr.succeed());
  };
  const queue = new UploadQueue();
  let complete = 0;
  let failed = 0;
  await Promise.all(Array.from({ length: 107 }, (_, id) => queue.enqueue({
    id: String(id), size: 1,
    transfer: async () => {
      await uploadBlobWithProgress({ url: "https://storage.example/part", data: new Blob(["x"]), stallTimeoutMs: 10 });
      complete++;
    },
  }).catch((error) => { assert.equal(error.retryable, true); failed++; })));
  assert.equal(complete, 104);
  assert.equal(failed, 3);
  assert.equal(FakeXHR.sent.length, 107);
  assert(FakeXHR.sent.slice(12, 15).every((xhr) => xhr.aborted));
});

test("verification releases transfer slots but obeys processing backpressure", async () => {
  const queue = new UploadQueue({ transfers: 3, files: 6, bytes: 6 });
  const releases = [];
  let started = 0;
  const jobs = Array.from({ length: 107 }, (_, id) => queue.enqueue({ id: String(id), size: 1, transfer: async () => {
    started++;
    return () => new Promise((resolve) => releases.push(resolve));
  } }));
  await tick();
  assert.equal(started, 6);
  while (started < 107 || releases.length) {
    releases.splice(0).forEach((release) => release());
    await tick();
  }
  await Promise.all(jobs);
});

test("a file larger than the byte budget runs alone and pending cancellation does not consume slots", async () => {
  const queue = new UploadQueue({ transfers: 3, files: 6, bytes: 10 });
  let release;
  let second = false;
  const first = queue.enqueue({ id: "large", size: 100, transfer: async () => () => new Promise((resolve) => { release = resolve; }) });
  const cancelled = queue.enqueue({ id: "cancelled", size: 1, transfer: async () => assert.fail("cancelled work ran") });
  queue.cancelPending("cancelled");
  const next = queue.enqueue({ id: "next", size: 1, transfer: async () => { second = true; } });
  await tick();
  assert.equal(second, false);
  release();
  await Promise.all([first, cancelled, next]);
  assert.equal(second, true);
});

test("one scheduler bounds simultaneous batches, and errors release capacity", async () => {
  const queue = new UploadQueue();
  let active = 0;
  let peak = 0;
  const run = (id) => queue.enqueue({ id, size: 1, transfer: async () => {
    active++; peak = Math.max(peak, active);
    await tick(); active--;
    if (id === "a0") throw new Error("one failed file");
  } }).catch(() => undefined);
  await Promise.all(["a", "b"].flatMap((batch) => Array.from({ length: 20 }, (_, i) => run(batch + i))));
  assert.equal(peak, 3);
});

test("storage watchdog resets on progress, waits for the final response, and cleans abort listeners", async (t) => {
  stubXHR(t);
  FakeXHR.sent = []; FakeXHR.onSend = undefined;
  const controller = new AbortController();
  const pending = uploadBlobWithProgress({ url: "https://storage.example/part", data: new Blob(["x"]), signal: controller.signal, stallTimeoutMs: 40 });
  const xhr = FakeXHR.sent[0];
  xhr.progress({ lengthComputable: true, loaded: 1 });
  xhr.succeed();
  await pending;
  controller.abort();
  assert.equal(xhr.aborted, undefined);
});

test("pre-aborted uploads never send bytes and retry backoff honors cancellation", async (t) => {
  stubXHR(t);
  FakeXHR.sent = [];
  const controller = new AbortController(); controller.abort();
  await assert.rejects(uploadBlobWithProgress({ url: "unused", data: new Blob(), signal: controller.signal }), { name: "AbortError" });
  assert.equal(FakeXHR.sent.length, 0);
  await assert.rejects(abortableDelay(1000, controller.signal), { name: "AbortError" });
});

test("transient requests retry boundedly; permanent failures do not retry", async () => {
  let calls = 0;
  const signal = new AbortController().signal;
  const value = await retryUploadRequest(async () => { if (++calls < 3) throw new UploadError("stalled", { status: 408, retryable: true }); return "ok"; }, signal, 3, 0);
  assert.equal(value, "ok"); assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(retryUploadRequest(async () => { calls++; throw new UploadError("forbidden", { status: 403, retryable: false }); }, signal, 5, 0));
  assert.equal(calls, 1);
});

test("chunk retries fetch fresh URLs and preserve already uploaded parts", async (t) => {
  stubXHR(t);
  const multipartModule = await import("../.test-build/lib/uploads/multipart.js");
  FakeXHR.sent = [];
  const issued = [];
  const uploaded = [];
  let failedOnce = false;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const number = JSON.parse(init.body).part_numbers[0];
    issued.push(number);
    return new Response(JSON.stringify({ parts: [{ part_number: number, url: `https://storage.example/${number}/${issued.length}` }] }));
  });
  const originalOpen = FakeXHR.prototype.open;
  FakeXHR.prototype.open = function (_method, url) { this.url = url; };
  t.after(() => { FakeXHR.prototype.open = originalOpen; });
  FakeXHR.onSend = (xhr) => queueMicrotask(() => {
    const part = Number(new URL(xhr.url).pathname.split("/")[1]);
    if (part === 2 && !failedOnce) { failedOnce = true; xhr.listeners.get("error")(); }
    else { uploaded.push(part); xhr.succeed(); }
  });
  await multipartModule.default.uploadMultipartFile({
    reservation: { upload_id: "resumable", part_size: 2, uploaded_parts: [{ part_number: 1, size: 2 }] },
    file: new Blob(["abcdefghij"]), signal: new AbortController().signal, onProgress() {},
  });
  assert.deepEqual(uploaded.sort(), [2, 3, 4, 5]);
  assert.equal(issued.filter((part) => part === 2).length, 2);
  assert.equal(issued.includes(1), false);
});

test("terminal chunk errors cancel and drain sibling requests before releasing the file", async (t) => {
  stubXHR(t);
  const multipartModule = await import("../.test-build/lib/uploads/multipart.js");
  FakeXHR.sent = [];
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ parts: [1, 2, 3, 4].map((part_number) => ({ part_number, url: `https://storage.example/${part_number}` })) })));
  FakeXHR.onSend = (xhr) => {
    if (FakeXHR.sent.length === 1) queueMicrotask(() => { xhr.status = 413; xhr.responseText = ""; xhr.listeners.get("load")(); });
  };
  await assert.rejects(multipartModule.default.uploadMultipartFile({
    reservation: { upload_id: "terminal", part_size: 2 }, file: new Blob(["abcdefghij"]), signal: new AbortController().signal, onProgress() {},
  }), /413/);
  assert(FakeXHR.sent.slice(1).every((xhr) => xhr.aborted));
});

test("verification reports terminal scanner errors without uploading bytes again", async (t) => {
  const completionModule = (await import("../.test-build/lib/uploads/completion.js")).default;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests++;
    assert.equal(JSON.parse(init.body).expected_sha256, "digest");
    return new Response(JSON.stringify({ status: "completed", processing_stage: "failed", failure_message: "File exceeds the scanner's supported size." }));
  });
  await assert.rejects(completionModule.waitForUploadCompletion("uploaded", "digest", 100, new AbortController().signal, () => {}), /scanner's supported size/);
  assert.equal(requests, 1);
});

test("completion polling can be cancelled while the server is verifying", async () => {
  const completionModule = (await import("../.test-build/lib/uploads/completion.js")).default;
  const controller = new AbortController();
  const request = completionModule.waitForUploadCompletion("uploaded", "digest", 100, controller.signal, () => {}, { status: "completing" });
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});
