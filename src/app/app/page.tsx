import { getCurrentUser } from '~/libs/auth';
import { listBooksWithCover } from '~/libs/books';
import { listWorks } from '~/libs/works';
import { Workbench } from '~/components/app/Workbench';
import type { LibItem } from '~/components/app/Sidebar';

export const dynamic = 'force-dynamic';

export default async function AppPage() {
  const user = await getCurrentUser();
  const [books, works] = user
    ? await Promise.all([listBooksWithCover(user.id), listWorks(user.id)])
    : [[], []];

  const items: LibItem[] = [
    ...books.map((b) => ({
      id: b.id,
      kind: 'book' as const,
      title: b.title,
      status: b.status,
      coverUrl: b.cover_url,
    })),
    ...works.map((w) => ({
      id: w.id,
      kind: 'image' as const,
      title: w.title,
      status: w.status,
      coverUrl: w.output_url,
    })),
  ];

  return <Workbench initialItems={items} />;
}
