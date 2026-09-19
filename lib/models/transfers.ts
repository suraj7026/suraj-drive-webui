import type { CurrentUser } from "@/lib/models/auth";

export type TransferStatus = "queued" | "uploading" | "paused" | "done" | "error";

export type TransferItem = {
  id: string;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  tickBytes?: number;
  status: TransferStatus;
  statusLabel: string;
  targetLabel: string;
	targetPrefix?: string;
	targetParentId?: string;
  objectKey?: string;
  errorMessage?: string;
  resumable?: boolean;
	uploadId?: string;
	canResume?: boolean;
	uploadMode?: "single" | "multipart";
	partSize?: number;
	uploadedParts?: Array<{ part_number: number; etag: string; size: number }>;
	mimeType?: string;
	conflictMode?: "keep_both" | "new_version";
	expectedSHA256?: string;
};

export type UploadScreenData = {
  user: CurrentUser;
  targetLabel: string;
  targetPrefix: string;
  summary: Array<{ label: string; value: string }>;
  transfers: TransferItem[];
};
