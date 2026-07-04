import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createImageTask } from '~/libs/dashscope';
import {
  getLessonPlan,
  lessonPlanOwnerId,
  updateLessonPlan,
} from '~/libs/lesson-plans';
import { styleSuffix, COMMON_NEGATIVE } from '~/data/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 两步式生图（1/2）：创建任务，把 taskId 存到 goalChecklist 项上并立即返回。
// body: { itemId: string, prompt?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const planId = Number(params.id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });
  }

  let body: { itemId?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const itemId = String(body.itemId || '').trim();
  const customPrompt = String(body.prompt || '').trim();
  if (!itemId) return NextResponse.json({ error: '缺少 itemId' }, { status: 400 });

  const ownerId = await lessonPlanOwnerId(planId);
  if (ownerId === null) return NextResponse.json({ error: '教案不存在' }, { status: 404 });
  if (ownerId !== user.id) return NextResponse.json({ error: '无权修改该教案' }, { status: 403 });

  const plan = await getLessonPlan(planId, user.id);
  if (!plan) return NextResponse.json({ error: '教案不存在' }, { status: 404 });

  const item = plan.goalChecklist.find((g) => g.id === itemId);
  if (!item) return NextResponse.json({ error: '目标项不存在' }, { status: 404 });

  const targetName = (item.name || '').trim();
  if (!targetName && !customPrompt) {
    return NextResponse.json({ error: '目标项没有名称，请先填写' }, { status: 400 });
  }

  // 教学图卡专用 prompt：主体从第一个逗号/顿号前取，附加 flat 风格后缀
  const subject = customPrompt || (targetName.split(/[、,,]/)[0] || targetName);
  const prompt = `${subject}。${styleSuffix('flat')}`;

  let taskId: string;
  try {
    taskId = await createImageTask({
      prompt,
      negativePrompt: COMMON_NEGATIVE,
      size: '1024*1024',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '生图任务创建失败' },
      { status: 502 }
    );
  }

  // 把 taskId 存到该 item 上，方便跨会话恢复
  const nextChecklist = plan.goalChecklist.map((g) =>
    g.id === itemId ? { ...g, imageTaskId: taskId } : g
  );

  try {
    await updateLessonPlan(planId, user.id, {
      type: plan.type,
      title: plan.title,
      source: plan.source,
      duration: plan.duration,
      goalHierarchy: plan.goalHierarchy,
      teachingSetup: plan.teachingSetup,
      abcProcedure: plan.abcProcedure,
      goalChecklist: nextChecklist,
    });
  } catch (err: any) {
    // 存 taskId 失败不阻塞，只是无法跨会话续查
    console.warn('[goal-item-image tasks] persist taskId failed:', err?.message);
  }

  return NextResponse.json({ taskId, status: 'PENDING' });
}
