import type { CurrentUser } from "@/lib/models/auth";
import type { TransferItem } from "@/lib/models/transfers";

export type SectionKey = "archive" | "recent" | "starred" | "shared" | "trash" | "storage";

export type Bucket = {
  id: string;
  name: string;
  kind: SectionKey;
  description: string;
};

export type CollectionCard = {
  id: string;
  title: string;
  objectCount: number;
  updatedLabel: string;
  shared?: boolean;
  href: string;
};

export type FileType = "folder" | "image" | "raw" | "video" | "audio" | "pdf" | "csv" | "text" | "other";

export type FileItem = {
  id: string;
  bucketId: string;
  kind: "file" | "folder" | "shortcut";
  fileType?: FileType;
  name: string;
  slug: string;
  path: string[];
  owner: string;
  updatedAt?: string;
  sizeBytes?: number;
  tags?: string[];
  shared?: boolean;
	starred?: boolean;
	folderColor?: string;
};

export type StorageSummary = {
	quotaBytes: number;
	committedBytes: number;
	reservedBytes: number;
	trashBytes: number;
	versionBytes: number;
	objectCount: number;
};

export type SearchFilters = {
	query: string;
	type?: string;
	owner?: string;
	location?: string;
	shared?: string;
	starred?: string;
	trash?: string;
	modifiedAfter?: string;
	modifiedBefore?: string;
};

export type ArchiveContext = {
  user: CurrentUser;
  section: SectionKey;
  eyebrow: string;
  heading: string;
  bucket: Bucket;
  path: string[];
  currentFolderId?: string;
  currentFolderLabel: string;
  collections: CollectionCard[];
  items: FileItem[];
  defaultSelectedId: string | null;
  transferQueue: TransferItem[];
  emptyStateMessage?: string;
	storageSummary?: StorageSummary;
	searchFilters?: SearchFilters;
};
