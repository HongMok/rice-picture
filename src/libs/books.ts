import { query, queryOne } from '~/libs/db';

export interface Book {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  title: string | null;
  brief: string | null;
  options: Record<string, any> | null;
  status: string; // DRAFTING / ILLUSTRATING / DONE / FAILED
  page_count: number;
}

export interface BookPage {
  id: number;
  book_id: number;
  page_index: number;
  text: string | null;
  scene: string | null;
  task_id: string | null;
  status: string; // PENDING/RUNNING/SUCCEEDED/FAILED
  image_url: string | null;
}

export async function createBook(params: {
  userId: number;
  brief: string;
  options: Record<string, any>;
  pageCount: number;
}): Promise<Book> {
  const row = await queryOne<Book>(
    `insert into books (user_id, brief, options, page_count, status)
     values ($1, $2, $3, $4, 'DRAFTING')
     returning *`,
    [params.userId, params.brief, params.options, params.pageCount]
  );
  return row!;
}

export async function setBookStory(params: {
  bookId: number;
  title: string;
  pages: { scene: string; text: string }[];
}): Promise<void> {
  await query('update books set title = $1, updated_at = now() where id = $2', [
    params.title,
    params.bookId,
  ]);
  for (let i = 0; i < params.pages.length; i++) {
    const p = params.pages[i];
    await query(
      `insert into book_pages (book_id, page_index, text, scene, status)
       values ($1, $2, $3, $4, 'PENDING')`,
      [params.bookId, i, p.text, p.scene]
    );
  }
}

export async function setPageTask(params: {
  pageId: number;
  taskId: string;
}): Promise<void> {
  await query('update book_pages set task_id = $1 where id = $2', [
    params.taskId,
    params.pageId,
  ]);
}

export async function updatePageStatus(params: {
  pageId: number;
  status: string;
  imageUrl?: string;
}): Promise<void> {
  await query(
    `update book_pages set status = $1, image_url = coalesce($2, image_url)
     where id = $3`,
    [params.status, params.imageUrl ?? null, params.pageId]
  );
}

export async function setBookStatus(
  bookId: number,
  status: string
): Promise<void> {
  await query('update books set status = $1, updated_at = now() where id = $2', [
    status,
    bookId,
  ]);
}

/**
 * 重置一本失败绘本：清空 pages、清空 title，把状态置回 DRAFTING，
 * 后续走原有的写文 + 逐页生图流水线。
 */
export async function resetBookForRetry(bookId: number): Promise<void> {
  await query('delete from book_pages where book_id = $1', [bookId]);
  await query(
    `update books set status = 'DRAFTING', title = null, updated_at = now()
      where id = $1`,
    [bookId]
  );
}

export async function getBook(
  bookId: number,
  userId: number
): Promise<Book | null> {
  return queryOne<Book>(
    `select * from books
      where id = $1 and user_id = $2 and deleted_at is null`,
    [bookId, userId]
  );
}

export async function getBookPages(bookId: number): Promise<BookPage[]> {
  return query<BookPage>(
    'select * from book_pages where book_id = $1 order by page_index asc',
    [bookId]
  );
}

export async function listBooks(userId: number, limit = 50): Promise<Book[]> {
  return query<Book>(
    `select * from books
      where user_id = $1 and deleted_at is null
      order by created_at desc
      limit $2`,
    [userId, limit]
  );
}

/** 列表用：带首页封面图 */
export async function listBooksWithCover(
  userId: number,
  limit = 50
): Promise<(Book & { cover_url: string | null })[]> {
  return query<Book & { cover_url: string | null }>(
    `select b.*,
            (select image_url from book_pages p
             where p.book_id = b.id and p.image_url is not null
             order by p.page_index asc limit 1) as cover_url
     from books b
     where b.user_id = $1 and b.deleted_at is null
     order by b.created_at desc
     limit $2`,
    [userId, limit]
  );
}

export async function updateBookTitle(
  id: number,
  userId: number,
  title: string
): Promise<Book | null> {
  return queryOne<Book>(
    `update books set title = $1, updated_at = now()
      where id = $2 and user_id = $3 and deleted_at is null
      returning *`,
    [title, id, userId]
  );
}

export async function softDeleteBook(
  id: number,
  userId: number
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `update books set deleted_at = now(), updated_at = now()
      where id = $1 and user_id = $2 and deleted_at is null
      returning id`,
    [id, userId]
  );
  return !!row;
}
