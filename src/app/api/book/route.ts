import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { writeStory } from '~/libs/qwen';
import { createImageTask } from '~/libs/dashscope';
import {
  createBook,
  setBookStory,
  getBookPages,
  setPageTask,
  setBookStatus,
} from '~/libs/books';
import { getTemplate } from '~/libs/templates';
import {
  styleSuffix,
  COMMON_NEGATIVE,
  sizeForRatio,
  PAGE_COUNTS,
} from '~/data/taxonomy';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    brief?: string;
    options?: Record<string, string>;
    pageCount?: number;
    ratio?: string;
    templateId?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const brief = (body.brief || '').trim();
  if (brief.length < 4) {
    return NextResponse.json({ error: '请多写一点故事描述（至少 4 个字）' }, { status: 400 });
  }
  const pageCount = PAGE_COUNTS.includes(body.pageCount as number)
    ? (body.pageCount as number)
    : 4;
  const ratio = body.ratio || '4:3';
  const opts = body.options || {};
  const styleKey = (opts.styleKey as string) || 'watercolor';

  // 若「做同款」带了 templateId，取该模板的专家 system_prompt
  let systemPrompt = '';
  if (body.templateId) {
    const t = await getTemplate(Number(body.templateId));
    if (t?.system_prompt) systemPrompt = t.system_prompt.trim();
  }

  // 1) 建 book 记录
  const book = await createBook({
    userId: user.id,
    brief,
    options: { ...opts, pageCount, ratio },
    pageCount,
  });

  try {
    // 2) 写故事拆页（LLM）
    const story = await writeStory(brief, {
      ageGroup: opts.ageGroup,
      genre: opts.genre,
      theme: opts.theme && opts.theme !== '（不指定）' ? opts.theme : undefined,
      character: opts.character,
      perspective: opts.perspective,
      pageCount,
      directive: systemPrompt || undefined,
    });

    await setBookStory({
      bookId: book.id,
      title: story.title,
      pages: story.pages,
    });
    await setBookStatus(book.id, 'ILLUSTRATING');

    // 3) 逐页提交生图任务（顺序提交，避免 DashScope 并发限流 429）。
    //    提交失败的页保持无 task_id，轮询阶段会自动补提交。
    const pages = await getBookPages(book.id);
    const size = sizeForRatio(ratio);
    for (const p of pages) {
      try {
        const pagePrompt = [p.scene, systemPrompt, styleSuffix(styleKey)]
          .filter(Boolean)
          .join('。');
        const taskId = await createImageTask({
          prompt: pagePrompt,
          negativePrompt: COMMON_NEGATIVE,
          size,
        });
        await setPageTask({ pageId: p.id, taskId });
      } catch {
        // 限流或失败：留给轮询阶段补提交
      }
      // 顺序节流：提交之间稍作间隔，规避并发限流
      await new Promise((r) => setTimeout(r, 800));
    }

    return NextResponse.json({
      bookId: book.id,
      title: story.title,
      pageCount: story.pages.length,
      status: 'ILLUSTRATING',
    });
  } catch (err: any) {
    await setBookStatus(book.id, 'FAILED');
    return NextResponse.json(
      { error: err?.message || '生成失败', bookId: book.id },
      { status: 502 }
    );
  }
}
