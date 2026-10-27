import { clientApiFetch, uploadBlobWithProgress } from "../api/client";
import type { BackendUploadPartURLs, BackendUploadReservation } from "../models/backend";
import { retryUploadRequest } from "./retry";

export async function uploadMultipartFile({ reservation, file, signal, onProgress, onRetry }: {
  reservation: BackendUploadReservation;
  file: File;
  signal: AbortSignal;
  onProgress: (bytes: number) => void;
  onRetry?: (part: number) => void;
}) {
  const partSize = reservation.part_size;
  if (!partSize || partSize <= 0) throw new Error("Multipart upload did not provide a valid part size.");
  const completed = new Map((reservation.uploaded_parts ?? []).map((part) => [part.part_number, part.size]));
  let completedBytes = [...completed.values()].reduce((sum, size) => sum + size, 0);
  onProgress(completedBytes);
  const missing = Array.from({ length: Math.ceil(file.size / partSize) }, (_, i) => i + 1).filter((part) => !completed.has(part));
  const controller = new AbortController();
  const batchSignal = AbortSignal.any([signal, controller.signal]);
  let cursor = 0;
  const inFlight = new Map<number, number>();
  const progress = () => onProgress(completedBytes + [...inFlight.values()].reduce((sum, size) => sum + size, 0));
  const worker = async () => {
    while (cursor < missing.length) {
      batchSignal.throwIfAborted();
      const partNumber = missing[cursor++];
      const part = file.slice((partNumber - 1) * partSize, Math.min(partNumber * partSize, file.size), file.type || "application/octet-stream");
      let attempt = 0;
      await retryUploadRequest(async () => {
        inFlight.delete(partNumber);
        if (attempt++ > 0) onRetry?.(partNumber);
        const response = await clientApiFetch<BackendUploadPartURLs>(`/api/uploads/${encodeURIComponent(reservation.upload_id)}/parts/presign`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ part_numbers: [partNumber] }), signal: batchSignal,
        });
        const url = response.parts.find((entry) => entry.part_number === partNumber)?.url;
        if (!url) throw new Error(`No upload URL for part ${partNumber}.`);
        await uploadBlobWithProgress({ url, data: part, signal: batchSignal, onProgress: (bytes) => { inFlight.set(partNumber, bytes); progress(); } });
      }, batchSignal);
      completedBytes += part.size;
      inFlight.delete(partNumber);
      progress();
    }
  };
  const workers = Array.from({ length: Math.min(4, missing.length) }, worker);
  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  }
}
