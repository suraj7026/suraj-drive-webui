import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSectionContext } from "@/lib/services/archive-service";

export default async function RecentPage() {
  const context = await getSectionContext("recent");
  return <ArchiveSectionView context={context} />;
}
