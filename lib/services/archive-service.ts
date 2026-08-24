import type { ArchiveContext, Bucket, FileItem, FileType, SectionKey } from "@/lib/models/archive";
import type { BackendFileObject, BackendFolderEntry, BackendListResponse, BackendSearchResponse } from "@/lib/models/backend";
import { titleFromSegments } from "@/lib/utils/archive-path";
import { serverApiFetch } from "@/lib/api/server";
import { requireCurrentUser } from "@/lib/services/auth-service";

const archiveDescription = "Private files stored in your personal drive.";

export async function getArchiveContext(bucketId: string, path: string[]): Promise<ArchiveContext | null> {
  const user = await requireCurrentUser();
  const normalizedPath = path.filter(Boolean);

  if (bucketId !== user.drive_id) {
    return null;
  }

  const prefix = joinPath(normalizedPath);
  const response = await serverApiFetch<BackendListResponse>("/api/files" + toQueryString({ prefix }));
  const items = mapListingItems(response, user.drive_id, user.name, normalizedPath);

  return {
    user,
    section: "archive" as const,
    eyebrow: normalizedPath.length === 0 ? "The Archive" : `My Archive / ${normalizedPath.join(" / ")}`,
    heading: normalizedPath.length === 0 ? "My Archive" : titleFromSegments(normalizedPath),
    bucket: buildBucket(user.drive_id, "archive", archiveDescription),
    path: normalizedPath,
    currentFolderLabel: normalizedPath.at(-1) ?? "My Archive",
    collections: [],
    items,
    defaultSelectedId: items[0]?.id ?? null,
    transferQueue: [],
    emptyStateMessage: normalizedPath.length === 0
      ? "Upload a file or create a folder to start filling this drive."
      : "This folder is empty.",
  };
}

export async function getSearchContext(query: string): Promise<ArchiveContext> {
  const user = await requireCurrentUser();
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      user,
      section: "archive" as const,
      eyebrow: "Archive Search",
      heading: "Search the archive",
      bucket: buildBucket(user.drive_id, "archive", archiveDescription),
      path: [],
      currentFolderLabel: "Search",
      collections: [],
      items: [],
      defaultSelectedId: null,
      transferQueue: [],
      emptyStateMessage: "Enter a file name in the search bar to search your drive.",
    };
  }

  const response = await serverApiFetch<BackendSearchResponse>("/api/search" + toQueryString({ q: trimmedQuery }));
  const items = response.results.map((file) => mapFile(file, user.drive_id, user.name));

  return {
    user,
    section: "archive" as const,
    eyebrow: "Archive Search",
    heading: `Results for \"${trimmedQuery}\"`,
    bucket: buildBucket(user.drive_id, "archive", archiveDescription),
    path: [],
    currentFolderLabel: "Search Results",
    collections: [],
    items,
    defaultSelectedId: items[0]?.id ?? null,
    transferQueue: [],
    emptyStateMessage: `No files matched \"${trimmedQuery}\".`,
  };
}

export async function getSectionContext(section: Exclude<SectionKey, "archive">): Promise<ArchiveContext> {
  const user = await requireCurrentUser();

  return {
    user,
    section,
    eyebrow: "Backend Coverage",
    heading: sectionTitle(section),
    bucket: buildBucket(user.drive_id, section, sectionDescription(section)),
    path: [],
    currentFolderLabel: sectionTitle(section),
    collections: [],
    items: [],
    defaultSelectedId: null,
    transferQueue: [],
    emptyStateMessage:
      "This view is waiting for its dedicated metadata-backed API before it can show real content.",
  };
}

function buildBucket(id: string, kind: SectionKey, description: string): Bucket {
  return {
    id,
    name: "My Archive",
    kind,
    description,
  };
}

function mapListingItems(response: BackendListResponse, bucketId: string, owner: string, path: string[]) {
  const folders = response.folders.map((folder) => mapFolder(folder, bucketId, owner, path));
  const files = response.files.map((file) => mapFile(file, bucketId, owner));
  return [...folders, ...files];
}

function mapFolder(folder: BackendFolderEntry, bucketId: string, owner: string, path: string[]): FileItem {
  return {
    id: folder.id,
    bucketId,
    kind: "folder",
    fileType: "folder",
    name: folder.name,
    slug: folder.name,
    path,
    owner,
    tags: ["Folder"],
  };
}

function mapFile(file: BackendFileObject, bucketId: string, owner: string): FileItem {
  const segments = splitKey(file.key);

  return {
    id: file.id,
    bucketId,
    kind: "file",
    fileType: inferFileType(file.name, file.content_type),
    name: file.name,
    slug: segments.slug,
    path: segments.path,
    owner,
    updatedAt: file.last_modified,
    sizeBytes: file.size,
    tags: file.content_type ? [file.content_type] : undefined,
  };
}

function splitKey(key: string) {
  const segments = key.split("/").filter(Boolean);
  return {
    path: segments.slice(0, -1),
    slug: segments.at(-1) ?? key,
  };
}

function inferFileType(name: string, contentType: string): FileType {
  const lowerName = name.toLowerCase();
  const ct = (contentType ?? "").toLowerCase();

  if (/\.(raw|cr2|nef|arw|dng|orf|rw2|raf)$/i.test(lowerName)) {
    return "raw";
  }
  if (
    ct.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|ico|heic|heif|avif|jfif)$/i.test(lowerName)
  ) {
    return "image";
  }
  if (
    ct.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|webm|m4v|ogv|3gp|wmv|flv|mpe?g|mts)$/i.test(lowerName)
  ) {
    return "video";
  }
  if (
    ct.startsWith("audio/") ||
    /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|wma|aiff?)$/i.test(lowerName)
  ) {
    return "audio";
  }
  if (ct === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (ct.includes("csv") || lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (
    ct.startsWith("text/") ||
    ct === "application/json" ||
    ct === "application/xml" ||
    /\.(txt|md|markdown|log|json|jsonl|xml|ya?ml|toml|ini|conf|env|html?|css|s?css|less|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql)$/i.test(lowerName)
  ) {
    return "text";
  }
  return "other";
}

function sectionTitle(section: Exclude<SectionKey, "archive">): string {
  switch (section) {
    case "shared":
      return "Shared";
  }
}

function sectionDescription(section: Exclude<SectionKey, "archive">): string {
  switch (section) {
    case "shared":
      return "Collaboration spaces will appear here once the backend exposes shared metadata.";
  }
}

function joinPath(path: string[]) {
  return path.join("/");
}

function toQueryString(query: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!value) {
      continue;
    }
    params.set(key, value);
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}
