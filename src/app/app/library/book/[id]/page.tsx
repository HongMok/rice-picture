import { notFound } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { getBook, getBookPages } from '~/libs/books';
import { BookDetail } from '~/components/app/BookDetail';

export const dynamic = 'force-dynamic';

export default async function BookDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const book = await getBook(id, user.id);
  if (!book) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm leading-[1.9] text-ink-soft">这本绘本不存在或已被删除。</p>
      </div>
    );
  }

  const rawPages = await getBookPages(id);
  const pages = rawPages.map((p) => ({
    pageIndex: p.page_index,
    text: p.text,
    status: p.status,
    imageUrl: p.image_url,
  }));

  return (
    <BookDetail
      id={book.id}
      initialTitle={book.title || '未命名绘本'}
      status={book.status}
      pages={pages}
    />
  );
}
