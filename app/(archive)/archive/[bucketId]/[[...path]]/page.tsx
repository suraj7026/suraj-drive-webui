import { notFound } from "next/navigation";
import { ArchiveBrowserView } from "@/components/archive/archive-browser-view";
import { getArchiveContext } from "@/lib/services/archive-service";

type PageProps = {
  params: Promise<{ bucketId: string; path?: string[] }>;
  searchParams: Promise<{ offset?: string }>;
};

export default async function ArchivePathPage({ params, searchParams }: PageProps) {
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
  const { offset } = await searchParams;
  const context = await getArchiveContext(bucketId, folderPath, offset);

  if (!context) {
    notFound();
  }

  return <ArchiveBrowserView context={context} />;
}
