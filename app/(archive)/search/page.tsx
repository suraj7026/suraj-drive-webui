import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSearchContext } from "@/lib/services/archive-service";

type SearchPageProps = {
  searchParams: Promise<{
	q?: string; type?: string; owner?: string; location?: string; shared?: string;
	starred?: string; trash?: string; modified_after?: string; modified_before?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const context = await getSearchContext(params.q ?? "", {
	type: params.type, owner: params.owner, location: params.location, shared: params.shared,
	starred: params.starred, trash: params.trash, modifiedAfter: params.modified_after,
	modifiedBefore: params.modified_before,
  });
  return <ArchiveSectionView context={context} />;
}
