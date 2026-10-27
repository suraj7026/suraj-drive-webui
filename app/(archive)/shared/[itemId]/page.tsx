import { notFound } from "next/navigation";
import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSharedFolderContext } from "@/lib/services/archive-service";

export default async function SharedFolderPage({ params }: { params: Promise<{ itemId: string }> }) {
	const { itemId } = await params;
	const context = await getSharedFolderContext(itemId);
	if (!context) notFound();
	return <ArchiveSectionView context={context} />;
}
