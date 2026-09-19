import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSectionContext } from "@/lib/services/archive-service";

export default async function TrashPage() {
  const context = await getSectionContext("trash");
  return <ArchiveSectionView context={context} />;
}
