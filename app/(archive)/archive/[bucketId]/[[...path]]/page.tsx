import { notFound } from "next/navigation";
import { ArchiveBrowserView } from "@/components/archive/archive-browser-view";
import { getArchiveContext } from "@/lib/services/archive-service";

type PageProps = {
  params: Promise<{ bucketId: string; path?: string[] }>;
};

export default async function ArchivePathPage({ params }: PageProps) {
  const { bucketId, path } = await params;
  let folderPath: string[];
  try {
    // Catch-all params still contain the URL encoding for each folder name.
    folderPath = (path ?? []).map((segment) => decodeURIComponent(segment));
  } catch {
    notFound();
  }
  if (folderPath.some((segment) => segment.includes("/") || segment.includes("\\") || segment === "." || segment === "..")) {
    notFound();
  }
  const context = await getArchiveContext(bucketId, folderPath);

  if (!context) {
    notFound();
  }

  return <ArchiveBrowserView context={context} />;
}
