import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createImageTask } from '~/libs/dashscope';
import { getWorkById, resetWorkForRetry } from '~/libs/works';
import { styleSuffix, COMMON_NEGATIVE, sizeForRatio } from '~/data/taxonomy';

export const runtime = 'nodejs';

/**
 * 重试失败图卡：读取该 work 原始 input_text（含 brief/styleKey/ratio），
 * 重新提交生图任务并写回 works 表（保留 id、title，重置 status/task_id/output_url）。
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const workId = Number(params.id);
  if (!Number.isFinite(workId)) {
    return NextResponse.json({ error: '无效 id' }, { status: 400 });
  }

  const work = await getWorkById(workId, user.id);
  if (!work) return NextResponse.json({ error: '图卡不存在' }, { status: 404 });

  let brief = '';
  let styleKey = 'warm';
  let ratio = '4:3';
  try {
    const parsed = JSON.parse(work.input_text || '{}');
    brief = String(parsed.brief || '').trim();
    styleKey = parsed.styleKey || styleKey;
    ratio = parsed.ratio || ratio;
  } catch {
    // input_text 不是合法 JSON：兜底用它本身当 brief
    brief = (work.input_text || '').trim();
  }
  if (!brief) {
    return NextResponse.json({ error: '找不到原始描述，无法重试' }, { status: 400 });
  }

  const prompt = work.prompt || `${brief}。${styleSuffix(styleKey)}`;

  try {
    const taskId = await createImageTask({
      prompt,
      negativePrompt: COMMON_NEGATIVE,
      size: sizeForRatio(ratio),
    });
    await resetWorkForRetry({ workId, userId: user.id, taskId });
    return NextResponse.json({ workId, taskId, status: 'PENDING' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '重新提交失败' },
      { status: 502 }
    );
  }
}
