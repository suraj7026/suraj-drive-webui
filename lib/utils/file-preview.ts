import type { FileItem, FileType } from "@/lib/models/archive";

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|ico|heic|heif|avif|jfif)$/i;
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|m4v|ogv|3gp|wmv|flv|mpe?g|mts)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|wma|aiff?)$/i;
const TEXT_EXT = /\.(txt|md|markdown|log|json|jsonl|xml|ya?ml|toml|ini|conf|env|html?|css|s?css|less|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql|csv)$/i;

// HEIC/HEIF need client-side conversion via heic2any before <img> can render them.
const HEIC_EXT = /\.(heic|heif)$/i;
// Image formats no browser/library combo can reasonably render in <img> (TIFF, camera raw).
const NON_RENDERABLE_IMAGE_EXT = /\.(tiff?|cr2|nef|arw|dng|orf|rw2|raf|raw)$/i;

export function getPreviewKind(fileType: FileType | undefined, fileName?: string): PreviewKind {
  switch (fileType) {
    case "image":
      return "image";
    case "pdf":
      return "pdf";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "text":
    case "csv":
      return "text";
    default:
      break;
  }

  if (fileName) {
    if (IMAGE_EXT.test(fileName)) return "image";
    if (VIDEO_EXT.test(fileName)) return "video";
    if (AUDIO_EXT.test(fileName)) return "audio";
    if (/\.pdf$/i.test(fileName)) return "pdf";
    if (TEXT_EXT.test(fileName)) return "text";
  }

  return "unsupported";
}

export function getPreviewKindForItem(item: FileItem): PreviewKind {
  return getPreviewKind(item.fileType, item.name);
}

export function isPreviewable(fileType: FileType | undefined, fileName?: string): boolean {
  return getPreviewKind(fileType, fileName) !== "unsupported";
}

export function isBrowserRenderableImage(fileName: string): boolean {
  return IMAGE_EXT.test(fileName) && !NON_RENDERABLE_IMAGE_EXT.test(fileName);
}

export function needsHeicConversion(fileName: string): boolean {
  return HEIC_EXT.test(fileName);
}
