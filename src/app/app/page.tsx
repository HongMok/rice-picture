import { getCurrentUser } from '~/libs/auth';
import { listBooksWithCover } from '~/libs/books';
import { listWorks } from '~/libs/works';
import { Workbench } from '~/components/app/Workbench';
import type { LibItem } from '~/components/app/Sidebar';
import type { ModuleKey } from '~/components/app/ModuleNav';

export const dynamic = 'force-dynamic';

const VALID_PANELS: ModuleKey[] = ['image', 'book', 'game', 'video'];

export default async function AppPage({
  searchParams,
}: {
  searchParams: { panel?: string; open?: string };
}) {
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

  const initialPanel = VALID_PANELS.includes(searchParams.panel as ModuleKey)
    ? (searchParams.panel as ModuleKey)
    : undefined;

  const openRaw = Number(searchParams.open);
  const initialOpenId = Number.isInteger(openRaw) && openRaw > 0 ? openRaw : undefined;

  return (
    <Workbench
      initialItems={items}
      initialPanel={initialPanel}
      initialOpenId={initialOpenId}
    />
  );
}
