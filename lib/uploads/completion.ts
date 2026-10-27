import { clientApiFetch } from "../api/client";
import type { BackendUploadReservation } from "../models/backend";
import { abortableDelay, retryUploadRequest } from "./retry";

export class UploadVerificationError extends Error {}

export function requestUploadCompletion(uploadId: string, digest: string, signal: AbortSignal) {
  return retryUploadRequest(() => clientApiFetch<BackendUploadReservation>(`/api/uploads/${encodeURIComponent(uploadId)}/complete`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_sha256: digest }), signal,
  }), signal);
}

export async function waitForUploadCompletion(uploadId: string, digest: string, size: number, signal: AbortSignal, onStage: (stage: "verifying" | "scanning") => void, initial?: BackendUploadReservation) {
  const deadline = Date.now() + 60 * 60_000 + 2 * Math.ceil(size / (5 * 1024 ** 2)) * 1000;
  let completion = initial ?? await requestUploadCompletion(uploadId, digest, signal);
  while (completion.status === "completing" || completion.processing_stage === "scanning") {
    if (Date.now() > deadline) throw new Error("Server verification is taking longer than expected. Retry verification to check again; uploaded bytes are retained.");
    onStage(completion.processing_stage === "scanning" ? "scanning" : "verifying");
    await abortableDelay(3000, signal);
    completion = await requestUploadCompletion(uploadId, digest, signal);
  }
  if (completion.status !== "completed" || completion.processing_stage === "failed") {
    throw new UploadVerificationError(completion.failure_message || "Upload verification failed. Retry or cancel this file; other uploads will continue.");
  }
}
