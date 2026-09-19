import type { ArchiveContext, Bucket, FileItem, FileType, SearchFilters, SectionKey } from "@/lib/models/archive";
import type { BackendFileObject, BackendFolderEntry, BackendListResponse, BackendSearchResponse, BackendShortcutEntry, BackendStorageSummary } from "@/lib/models/backend";
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
  const response = await fetchCompleteListing(prefix);
  const items = mapListingItems(response, user.drive_id, user.name, normalizedPath);

  return {
    user,
    section: "archive" as const,
    eyebrow: normalizedPath.length === 0 ? "The Archive" : `My Archive / ${normalizedPath.join(" / ")}`,
    heading: normalizedPath.length === 0 ? "My Archive" : titleFromSegments(normalizedPath),
    bucket: buildBucket(user.drive_id, "archive", archiveDescription),
    path: normalizedPath,
    currentFolderId: response.current_folder_id,
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

export async function getSearchContext(query: string, filters: Omit<SearchFilters, "query"> = {}): Promise<ArchiveContext> {
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
	  searchFilters: { query: "", ...filters },
    };
  }

  const response = await fetchCompleteSearch(trimmedQuery, filters);
	const folders = (response.folders ?? []).map((folder) => {
		const segments = folder.prefix.split("/").filter(Boolean);
		return mapFolder(folder, user.drive_id, user.name, segments.slice(0, -1));
	});
	const items = [...folders, ...response.results.map((file) => mapFile(file, user.drive_id, user.name, [])), ...(response.shortcuts ?? []).map((shortcut) => mapShortcut(shortcut, user.drive_id, user.name, []))];

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
	searchFilters: { query: trimmedQuery, ...filters },
  };
}

export async function getSharedFolderContext(itemId: string): Promise<ArchiveContext | null> {
	const user = await requireCurrentUser();
	try {
		const response = await fetchCompleteItemEndpoint(`/api/items/${encodeURIComponent(itemId)}/children`, "Shared folder");
		const items = mapListingItems(response, user.drive_id, "Shared with me", []);
		return {
			user, section: "shared", eyebrow: "Shared with me", heading: "Shared folder",
			bucket: buildBucket(user.drive_id, "shared", "A folder shared with you."),
			path: [], currentFolderId: response.current_folder_id, currentFolderLabel: "Shared folder", collections: [], items,
			defaultSelectedId: items[0]?.id ?? null, transferQueue: [], emptyStateMessage: "This shared folder is empty.",
		};
	} catch {
		return null;
	}
}

export async function getSectionContext(section: Exclude<SectionKey, "archive">): Promise<ArchiveContext> {
  const user = await requireCurrentUser();
	if (section === "trash") {
		const response = await fetchCompleteTrash();
		const items = mapListingItems(response, user.drive_id, user.name, []);
		return {
			user,
			section,
			eyebrow: "Recovery",
			heading: "Trash",
			bucket: buildBucket(user.drive_id, section, "Items are retained for 30 days before permanent deletion."),
			path: [],
			currentFolderLabel: "Trash",
			collections: [],
			items,
			defaultSelectedId: items[0]?.id ?? null,
			transferQueue: [],
			emptyStateMessage: "Trash is empty.",
		};
	}
	if (section === "recent" || section === "starred" || section === "storage") {
		const [response, storage] = await Promise.all([
			fetchCompleteUserView(section),
			section === "storage" ? serverApiFetch<BackendStorageSummary>("/api/storage/summary") : Promise.resolve(null),
		]);
		const items = mapListingItems(response, user.drive_id, user.name, []);
		return {
			user,
			section,
			eyebrow: section === "storage" ? "Storage" : "My Drive",
			heading: sectionTitle(section),
			bucket: buildBucket(user.drive_id, section, sectionDescription(section)),
			path: [],
			currentFolderLabel: sectionTitle(section),
			collections: [],
			items,
			defaultSelectedId: items[0]?.id ?? null,
			transferQueue: [],
			emptyStateMessage: section === "recent" ? "Files you open will appear here." : section === "starred" ? "Star important files and folders to find them here." : "No files are using storage.",
			storageSummary: storage ? {
				quotaBytes: storage.quota_bytes,
				committedBytes: storage.committed_bytes,
				reservedBytes: storage.reserved_bytes,
				trashBytes: storage.trash_bytes,
				versionBytes: storage.version_bytes,
				objectCount: storage.object_count,
			} : undefined,
		};
	}
	if (section === "shared") {
		const response = await fetchCompleteShared();
		const items = mapListingItems(response, user.drive_id, "Shared with me", []);
		return {
			user,
			section,
			eyebrow: "Collaboration",
			heading: "Shared with me",
			bucket: buildBucket(user.drive_id, section, "Files and folders other people shared with you."),
			path: [],
			currentFolderLabel: "Shared with me",
			collections: [],
			items,
			defaultSelectedId: items[0]?.id ?? null,
			transferQueue: [],
			emptyStateMessage: "Files and folders shared with you will appear here.",
		};
	}

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

async function fetchCompleteListing(prefix: string): Promise<BackendListResponse> {
  const folders: BackendFolderEntry[] = [];
  const files: BackendFileObject[] = [];
	const shortcuts: BackendShortcutEntry[] = [];
  const seenItemIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor = "";
  let lastResponse: BackendListResponse | null = null;

  do {
    const response = await serverApiFetch<BackendListResponse>(
      "/api/files" + toQueryString({ prefix, limit: "200", cursor }),
    );
    lastResponse = response;
    for (const folder of response.folders) {
      if (!seenItemIds.has(folder.id)) {
        seenItemIds.add(folder.id);
        folders.push(folder);
      }
    }
    for (const file of response.files) {
      if (!seenItemIds.has(file.id)) {
        seenItemIds.add(file.id);
        files.push(file);
      }
    }
	for (const shortcut of response.shortcuts ?? []) {
		if (!seenItemIds.has(shortcut.id)) {
			seenItemIds.add(shortcut.id);
			shortcuts.push(shortcut);
		}
	}

    if (!response.pagination.has_more) {
      cursor = "";
      break;
    }
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("The drive listing returned an invalid pagination cursor.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);

  if (!lastResponse) {
    throw new Error("The drive listing returned no response.");
  }
  return {
    ...lastResponse,
    folders,
    files,
	shortcuts,
    pagination: {
      ...lastResponse.pagination,
      returned: folders.length + files.length + shortcuts.length,
      has_more: false,
      next_cursor: undefined,
    },
  };
}

async function fetchCompleteSearch(query: string, filters: Omit<SearchFilters, "query">): Promise<BackendSearchResponse> {
	const folders: BackendFolderEntry[] = [];
  const results: BackendFileObject[] = [];
	const shortcuts: BackendShortcutEntry[] = [];
  const seenItemIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor = "";
  let lastResponse: BackendSearchResponse | null = null;

  while (true) {
    const response = await serverApiFetch<BackendSearchResponse>(
			"/api/search" + toQueryString({
				q: query, limit: "200", cursor, type: filters.type ?? "", owner: filters.owner ?? "",
				location: filters.location ?? "", shared: filters.shared ?? "", starred: filters.starred ?? "",
				trash: filters.trash ?? "", modified_after: toSearchTimestamp(filters.modifiedAfter, false),
				modified_before: toSearchTimestamp(filters.modifiedBefore, true),
			}),
    );
    lastResponse = response;
    for (const file of response.results) {
      if (!seenItemIds.has(file.id)) {
        seenItemIds.add(file.id);
        results.push(file);
      }
    }
		for (const folder of response.folders ?? []) {
			if (!seenItemIds.has(folder.id)) {
				seenItemIds.add(folder.id);
				folders.push(folder);
			}
		}
		for (const shortcut of response.shortcuts ?? []) {
			if (!seenItemIds.has(shortcut.id)) {
				seenItemIds.add(shortcut.id);
				shortcuts.push(shortcut);
			}
		}
    if (!response.pagination.has_more) {
      break;
    }
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
			throw new Error("Search returned an invalid pagination cursor.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  if (!lastResponse) {
    throw new Error("Search returned no response.");
  }
  return {
    ...lastResponse,
		folders,
    results,
		shortcuts,
    pagination: {
      ...lastResponse.pagination,
			returned: folders.length + results.length + shortcuts.length,
      has_more: false,
			next_cursor: undefined,
    },
  };
}

function toSearchTimestamp(value: string | undefined, endOfDay: boolean) {
	if (!value) return "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
	}
	return value;
}

async function fetchCompleteTrash(): Promise<BackendListResponse> {
	const folders: BackendFolderEntry[] = [];
	const files: BackendFileObject[] = [];
	const shortcuts: BackendShortcutEntry[] = [];
	const seenItemIds = new Set<string>();
	const seenCursors = new Set<string>();
	let cursor = "";
	let lastResponse: BackendListResponse | null = null;
	while (true) {
		const response = await serverApiFetch<BackendListResponse>(
			"/api/trash" + toQueryString({ limit: "200", cursor }),
		);
		lastResponse = response;
		for (const folder of response.folders) {
			if (!seenItemIds.has(folder.id)) {
				seenItemIds.add(folder.id);
				folders.push(folder);
			}
		}
		for (const file of response.files) {
			if (!seenItemIds.has(file.id)) {
				seenItemIds.add(file.id);
				files.push(file);
			}
		}
		for (const shortcut of response.shortcuts ?? []) {
			if (!seenItemIds.has(shortcut.id)) {
				seenItemIds.add(shortcut.id);
				shortcuts.push(shortcut);
			}
		}
		if (!response.pagination.has_more) {
			break;
		}
		const nextCursor = response.pagination.next_cursor;
		if (!nextCursor || seenCursors.has(nextCursor)) {
			throw new Error("Trash returned an invalid pagination cursor.");
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}
	if (!lastResponse) {
		throw new Error("Trash returned no response.");
	}
	return {
		...lastResponse,
		folders,
		files,
		shortcuts,
		pagination: { ...lastResponse.pagination, returned: folders.length + files.length + shortcuts.length, has_more: false, next_cursor: undefined },
	};
}

async function fetchCompleteUserView(view: "recent" | "starred" | "storage"): Promise<BackendListResponse> {
	return fetchCompleteItemEndpoint(`/api/views/${view}`, sectionTitle(view));
}

async function fetchCompleteShared(): Promise<BackendListResponse> {
	return fetchCompleteItemEndpoint("/api/shared", "Shared with me");
}

async function fetchCompleteItemEndpoint(endpoint: string, label: string): Promise<BackendListResponse> {
	const folders: BackendFolderEntry[] = [];
	const files: BackendFileObject[] = [];
	const shortcuts: BackendShortcutEntry[] = [];
	const seenItemIds = new Set<string>();
	const seenCursors = new Set<string>();
	let cursor = "";
	let lastResponse: BackendListResponse | null = null;
	while (true) {
		const response = await serverApiFetch<BackendListResponse>(endpoint + toQueryString({ limit: "200", cursor }));
		lastResponse = response;
		for (const folder of response.folders) {
			if (!seenItemIds.has(folder.id)) {
				seenItemIds.add(folder.id);
				folders.push(folder);
			}
		}
		for (const file of response.files) {
			if (!seenItemIds.has(file.id)) {
				seenItemIds.add(file.id);
				files.push(file);
			}
		}
		for (const shortcut of response.shortcuts ?? []) {
			if (!seenItemIds.has(shortcut.id)) {
				seenItemIds.add(shortcut.id);
				shortcuts.push(shortcut);
			}
		}
		if (!response.pagination.has_more) break;
		const nextCursor = response.pagination.next_cursor;
		if (!nextCursor || seenCursors.has(nextCursor)) {
			throw new Error(`${label} returned an invalid pagination cursor.`);
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}
	if (!lastResponse) throw new Error(`${label} returned no response.`);
	return {
		...lastResponse,
		folders,
		files,
		shortcuts,
		pagination: { ...lastResponse.pagination, returned: folders.length + files.length + shortcuts.length, has_more: false, next_cursor: undefined },
	};
}

function mapListingItems(response: BackendListResponse, bucketId: string, owner: string, path: string[]) {
  const folders = response.folders.map((folder) => mapFolder(folder, bucketId, owner, path));
  const files = response.files.map((file) => mapFile(file, bucketId, owner, path));
	const shortcuts = (response.shortcuts ?? []).map((shortcut) => mapShortcut(shortcut, bucketId, owner, path));
  return [...folders, ...files, ...shortcuts];
}

function mapShortcut(shortcut: BackendShortcutEntry, bucketId: string, owner: string, path: string[]): FileItem {
	return {
		id: shortcut.id, bucketId, kind: "shortcut", fileType: "other", name: shortcut.name,
		slug: shortcut.name, path, owner, updatedAt: shortcut.last_opened_at,
		starred: Boolean(shortcut.starred_at), shared: Boolean(shortcut.shared), tags: ["Shortcut"],
	};
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
		updatedAt: folder.trashed_at,
		starred: Boolean(folder.starred_at),
		shared: Boolean(folder.shared),
		folderColor: folder.folder_color,
    tags: ["Folder"],
  };
}

function mapFile(file: BackendFileObject, bucketId: string, owner: string, path: string[]): FileItem {
  return {
    id: file.id,
    bucketId,
    kind: "file",
    fileType: inferFileType(file.name, file.content_type),
    name: file.name,
		slug: file.name,
		path,
    owner,
		updatedAt: file.last_opened_at ?? file.trashed_at ?? file.last_modified,
		starred: Boolean(file.starred_at),
		shared: Boolean(file.shared),
    sizeBytes: file.size,
    tags: file.content_type ? [file.content_type] : undefined,
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
		case "recent":
			return "Recent";
		case "starred":
			return "Starred";
		case "storage":
			return "Storage";
		case "trash":
			return "Trash";
  }
}

function sectionDescription(section: Exclude<SectionKey, "archive">): string {
  switch (section) {
    case "shared":
      return "Collaboration spaces will appear here once the backend exposes shared metadata.";
		case "recent":
			return "Files and folders you opened most recently.";
		case "starred":
			return "Your important files and folders.";
		case "storage":
			return "Files ordered by storage used, including quota and version totals.";
		case "trash":
			return "Items are retained for 30 days before permanent deletion.";
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
