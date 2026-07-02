import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { listBooksWithCover } from '~/libs/books';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const books = await listBooksWithCover(user.id);
  return NextResponse.json({
    books: books.map((b) => ({
      id: b.id,
      title: b.title,
      status: b.status,
      pageCount: b.page_count,
      coverUrl: b.cover_url,
      createdAt: b.created_at,
    })),
  });
}
