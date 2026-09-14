export type BackendPagination = {
  offset?: number;
  limit: number;
  returned: number;
  total?: number;
  has_more: boolean;
  next_offset?: number;
  next_cursor?: string;
};

export type BackendFileObject = {
  id: string;
  key: string;
  name: string;
  size: number;
  last_modified: string;
  content_type: string;
  etag: string;
  trashed_at?: string;
	starred_at?: string;
	last_opened_at?: string;
	shared?: boolean;
};

export type BackendFolderEntry = {
  id: string;
  prefix: string;
  name: string;
  trashed_at?: string;
	starred_at?: string;
	last_opened_at?: string;
	shared?: boolean;
	folder_color?: string;
};

export type BackendShortcutEntry = {
	id: string;
	name: string;
	starred_at?: string;
	last_opened_at?: string;
	shared?: boolean;
};

export type BackendItemDetails = {
	id: string;
	drive_id: string;
	parent_id?: string;
	kind: "file" | "folder" | "shortcut";
	name: string;
	description?: string;
	folder_color?: string;
	mime_type?: string;
	size_bytes?: number;
	version_id?: string;
	trashed: boolean;
};

export type BackendShortcutResolution = {
	shortcut_id: string;
	broken: boolean;
	target?: BackendItemDetails;
};

export type BackendBatchResult = {
	item_id?: string;
	status: "succeeded" | "failed";
	code?: string;
};

export type BackendBatchResponse = {
	operation: "trash" | "restore" | "star" | "unstar";
	succeeded: number;
	failed: number;
	results: BackendBatchResult[];
};

export type BackendAuthSession = {
	id: string;
	user_agent?: string;
	ip_address?: string;
	current: boolean;
	created_at: string;
	last_seen_at: string;
	expires_at: string;
};

export type BackendStorageSummary = {
	quota_bytes: number;
	committed_bytes: number;
	reserved_bytes: number;
	trash_bytes: number;
	version_bytes: number;
	object_count: number;
};

export type BackendUserPreferences = {
	view_mode: "list" | "grid";
	density: "comfortable" | "compact";
	sort_key: string;
};

export type BackendItemPermission = {
	id: string;
	user_id: string;
	email: string;
	display_name: string;
	role: "viewer" | "commenter" | "editor";
	expires_at?: string;
	created_at: string;
};

export type BackendPermissionsResponse = {
	permissions: BackendItemPermission[];
	invitations: BackendShareInvitation[];
};

export type BackendShareInvitation = {
	id: string;
	email: string;
	role: "viewer" | "commenter" | "editor";
	status: "pending";
	expires_at: string;
	created_at: string;
};

export type BackendShareLink = {
	id: string;
	role: "viewer" | "commenter";
	allow_download: boolean;
	expires_at?: string;
	created_at: string;
	url?: string;
};

export type BackendShareLinksResponse = { links: BackendShareLink[] };

export type BackendPublicLinkItem = {
	id: string;
	kind: "file" | "folder";
	name: string;
	mime_type?: string;
	size_bytes?: number;
	allow_download: boolean;
	preview_url?: string;
};

export type BackendFileVersion = {
	id: string;
	version_number: number;
	size_bytes: number;
	mime_type: string;
	etag: string;
	keep_forever: boolean;
	is_current: boolean;
	created_at: string;
	ready_at: string;
};

export type BackendVersionsResponse = { versions: BackendFileVersion[] };

export type BackendActivityEvent = {
	id: string;
	event_type: string;
	actor_name: string;
	actor_email: string;
	created_at: string;
};

export type BackendActivityResponse = {
	events: BackendActivityEvent[];
	pagination: BackendPagination;
};

export type BackendComment = {
	id: string;
	parent_id?: string;
	author_id: string;
	author_name: string;
	author_email: string;
	body: string;
	resolved_at?: string;
	deleted: boolean;
	created_at: string;
	updated_at: string;
	can_edit: boolean;
	can_resolve: boolean;
	can_reply: boolean;
};

export type BackendCommentsResponse = { comments: BackendComment[] };

export type BackendListResponse = {
  current_folder_id?: string;
  prefix: string;
  folders: BackendFolderEntry[];
  files: BackendFileObject[];
	shortcuts?: BackendShortcutEntry[];
  pagination: BackendPagination;
};

export type BackendSearchResponse = {
  query: string;
  prefix: string;
  folders?: BackendFolderEntry[];
  results: BackendFileObject[];
	shortcuts?: BackendShortcutEntry[];
  pagination: BackendPagination;
};

export type BackendPresignResponse = {
  url: string;
  key: string;
  expires_in?: string;
};

export type BackendPreviewResponse = {
  status: "queued" | "processing" | "ready";
  job_id?: string;
  url?: string;
  key?: string;
  expires_in?: string;
  retry_after?: number;
};

export type BackendUploadReservation = {
  upload_id: string;
  key: string;
  name: string;
  expected_size: number;
  mime_type: string;
  status: "initiated" | "uploading" | "completing" | "completed" | "failed" | "aborted" | "expired";
  expires_at: string;
  upload_mode: "single" | "multipart";
  part_size?: number;
  expected_sha256?: string;
  processing_stage?: "verifying" | "scanning" | "ready" | "failed";
  uploaded_parts?: Array<{ part_number: number; etag: string; size: number }>;
  url?: string;
  expires_in?: string;
};

export type BackendUploadPartURLs = {
  parts: Array<{ part_number: number; url: string }>;
  expires_in: string;
};

export type BackendActiveUploadsResponse = {
	uploads: BackendUploadReservation[];
};
