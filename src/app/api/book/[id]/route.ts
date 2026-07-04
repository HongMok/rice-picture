import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createImageTask, queryImageTask } from '~/libs/dashscope';
import {
  getBook,
  getBookPages,
  updatePageStatus,
  setPageTask,
  setBookStatus,
} from '~/libs/books';
import { styleSuffix, COMMON_NEGATIVE, sizeForRatio } from '~/data/taxonomy';
import { hasBlobToken, persistImage } from '~/libs/blob';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '无效 id' }, { status: 400 });
  }

  const book = await getBook(id, user.id);
  if (!book) return NextResponse.json({ error: '绘本不存在' }, { status: 404 });

  let pages = await getBookPages(id);

  if (book.status === 'ILLUSTRATING') {
    const size = sizeForRatio(book.options?.ratio || '4:3');
    const styleKey = (book.options?.styleKey as string) || 'watercolor';

    // 1) 补提交：仍无 task_id 的页，本轮尝试提交一个（每轮最多补 2 个，避免限流）
    let submitted = 0;
    for (const p of pages) {
      if (!p.task_id && submitted < 2) {
        try {
          const taskId = await createImageTask({
            prompt: `${p.scene}。${styleSuffix(styleKey)}`,
            negativePrompt: COMMON_NEGATIVE,
            size,
          });
          await setPageTask({ pageId: p.id, taskId });
          submitted++;
        } catch {
          // 限流，下轮再试
        }
      }
    }

    // 2) 查询有 task 且未完成的页
    await Promise.all(
      pages
        .filter(
          (p) => p.task_id && p.status !== 'SUCCEEDED' && p.status !== 'FAILED'
        )
        .map(async (p) => {
          const r = await queryImageTask(p.task_id!);
          if (r.status === 'SUCCEEDED') {
            // 有 Blob token 时把 24h 临时链转成永久 URL；失败退回原链，不阻塞
            let finalUrl = r.imageUrl;
            if (r.imageUrl && hasBlobToken()) {
              try {
                finalUrl = await persistImage(
                  r.imageUrl,
                  `book-${id}-p${p.page_index}`
                );
              } catch (err) {
                console.warn('[persistImage] book page fallback', err);
              }
            }
            await updatePageStatus({
              pageId: p.id,
              status: 'SUCCEEDED',
              imageUrl: finalUrl,
            });
          } else if (r.status === 'FAILED') {
            await updatePageStatus({ pageId: p.id, status: 'FAILED' });
          } else if (r.status === 'RUNNING' && p.status === 'PENDING') {
            await updatePageStatus({ pageId: p.id, status: 'RUNNING' });
          }
        })
    );

    pages = await getBookPages(id);

    // 3) 完成判定：所有页都有终态（成功或失败）才算结束
    const done = pages.filter((p) => p.status === 'SUCCEEDED').length;
    const settled = pages.filter(
      (p) => p.status === 'SUCCEEDED' || p.status === 'FAILED'
    ).length;
    if (settled === pages.length) {
      const status = done > 0 ? 'DONE' : 'FAILED';
      await setBookStatus(id, status);
      book.status = status;
    }
  }

  const doneCount = pages.filter((p) => p.status === 'SUCCEEDED').length;

  return NextResponse.json({
    book: {
      id: book.id,
      title: book.title,
      brief: book.brief,
      status: book.status,
      pageCount: book.page_count,
      options: book.options || {},
    },
    doneCount,
    pages: pages.map((p) => ({
      pageIndex: p.page_index,
      text: p.text,
      status: p.status,
      imageUrl: p.image_url,
    })),
  });
}
