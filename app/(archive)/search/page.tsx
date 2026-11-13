import { ArchiveSectionView } from "@/components/archive/archive-section-view";
import { getSearchContext } from "@/lib/services/archive-service";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; offset?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, offset } = await searchParams;
  const context = await getSearchContext(q ?? "", offset);
  return <ArchiveSectionView context={context} />;
}
