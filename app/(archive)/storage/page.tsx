import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSectionContext } from "@/lib/services/archive-service";

export default async function StoragePage() {
  const context = await getSectionContext("storage");
  return <ArchiveSectionView context={context} />;
}
