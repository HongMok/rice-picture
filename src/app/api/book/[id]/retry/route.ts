import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { writeStory } from '~/libs/qwen';
import { createImageTask } from '~/libs/dashscope';
import {
  getBook,
  getBookPages,
  resetBookForRetry,
  setBookStatus,
  setBookStory,
  setPageTask,
} from '~/libs/books';
import { styleSuffix, COMMON_NEGATIVE, sizeForRatio } from '~/data/taxonomy';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 重试失败绘本：读取原 brief + options，清掉旧 pages，重新写文 + 逐页生图。
 * 保留 book id，不新建行。
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const bookId = Number(params.id);
  if (!Number.isFinite(bookId)) {
    return NextResponse.json({ error: '无效 id' }, { status: 400 });
  }

  const book = await getBook(bookId, user.id);
  if (!book) return NextResponse.json({ error: '绘本不存在' }, { status: 404 });

  const brief = (book.brief || '').trim();
  if (!brief) {
    return NextResponse.json({ error: '找不到原始描述，无法重试' }, { status: 400 });
  }
  const opts = book.options || {};
  const pageCount = book.page_count || 4;
  const ratio = (opts.ratio as string) || '4:3';
  const styleKey = (opts.styleKey as string) || 'watercolor';

  await resetBookForRetry(bookId);

  try {
    const story = await writeStory(brief, {
      ageGroup: opts.ageGroup,
      genre: opts.genre,
      theme: opts.theme && opts.theme !== '（不指定）' ? opts.theme : undefined,
      character: opts.character,
      perspective: opts.perspective,
      pageCount,
      // 重试时暂不复用模板 system_prompt（未在 books 里持久化）
    });

    await setBookStory({
      bookId,
      title: story.title,
      pages: story.pages,
    });
    await setBookStatus(bookId, 'ILLUSTRATING');

    const pages = await getBookPages(bookId);
    const size = sizeForRatio(ratio);
    for (const p of pages) {
      try {
        const taskId = await createImageTask({
          prompt: `${p.scene}。${styleSuffix(styleKey)}`,
          negativePrompt: COMMON_NEGATIVE,
          size,
        });
        await setPageTask({ pageId: p.id, taskId });
      } catch {
        // 单页失败留给轮询补提交
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    return NextResponse.json({
      bookId,
      title: story.title,
      pageCount: story.pages.length,
      status: 'ILLUSTRATING',
    });
  } catch (err: any) {
    await setBookStatus(bookId, 'FAILED');
    return NextResponse.json(
      { error: err?.message || '重新生成失败', bookId },
      { status: 502 }
    );
  }
}
