import type { FileType } from "@/lib/models/archive";

export type PreviewKind = "image" | "pdf" | "video" | "unsupported";

export function getPreviewKind(fileType: FileType | undefined): PreviewKind {
  switch (fileType) {
    case "image":
      return "image";
    case "pdf":
      return "pdf";
    case "video":
      return "video";
    default:
      return "unsupported";
  }
}

export function isPreviewable(fileType: FileType | undefined): boolean {
  return getPreviewKind(fileType) !== "unsupported";
}
