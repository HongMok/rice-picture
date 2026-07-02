import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createImageTask } from '~/libs/dashscope';
import { createWork } from '~/libs/works';
import { styleSuffix, COMMON_NEGATIVE, sizeForRatio } from '~/data/taxonomy';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    brief?: string;
    styleKey?: string;
    ratio?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const brief = (body.brief || '').trim();
  if (brief.length < 2) {
    return NextResponse.json({ error: '请描述你想要的图卡内容' }, { status: 400 });
  }

  const styleKey = body.styleKey || 'warm';
  const ratio = body.ratio || '4:3';
  const prompt = `${brief}。${styleSuffix(styleKey)}`;
  const title = brief.slice(0, 30);

  try {
    const taskId = await createImageTask({
      prompt,
      negativePrompt: COMMON_NEGATIVE,
      size: sizeForRatio(ratio),
    });
    const work = await createWork({
      userId: user.id,
      templateId: `image:${styleKey}`,
      title,
      inputText: JSON.stringify({ brief, styleKey, ratio }),
      prompt,
      taskId,
    });
    return NextResponse.json({ workId: work.id, taskId, status: 'PENDING' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '生成任务创建失败' },
      { status: 502 }
    );
  }
}
