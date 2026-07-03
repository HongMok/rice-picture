import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createImageTask, queryImageTask } from '~/libs/dashscope';
import {
  getLessonPlan,
  lessonPlanOwnerId,
  updateLessonPlan,
} from '~/libs/lesson-plans';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 目标清单 · 单个目标项 AI 生成配图（同步等待任务完成）
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
    return NextResponse.json({ error: '目标项没有名称，请先填写或提供描述' }, { status: 400 });
  }

  const prompt = customPrompt
    ? `${customPrompt}。纯白背景，扁平插画风，简洁清晰，儿童友好，居中构图`
    : `${targetName.split(/[、,，]/)[0] || targetName}，纯白背景，扁平插画风，简洁清晰，儿童友好，居中构图`;

  let taskId: string;
  try {
    taskId = await createImageTask({
      prompt,
      negativePrompt: '文字, 水印, 多余元素, 复杂背景, 阴影',
      size: '1024*1024',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '生图任务创建失败' },
      { status: 502 }
    );
  }

  // 同步轮询直到完成或超时（最多 ~45 秒）
  const start = Date.now();
  const timeoutMs = 45_000;
  const intervalMs = 2_000;
  let imageUrl: string | undefined;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const result = await queryImageTask(taskId);
    if (result.status === 'SUCCEEDED' && result.imageUrl) {
      imageUrl = result.imageUrl;
      break;
    }
    if (result.status === 'FAILED') {
      return NextResponse.json(
        { error: result.message || '生成失败' },
        { status: 502 }
      );
    }
  }
  if (!imageUrl) {
    return NextResponse.json({ error: '生成超时，请稍后重试' }, { status: 504 });
  }

  // 写回 goalChecklist
  const nextChecklist = plan.goalChecklist.map((g) =>
    g.id === itemId ? { ...g, imageUrl } : g
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
    return NextResponse.json(
      { error: err?.message || '保存图片失败，请重试', imageUrl },
      { status: 500 }
    );
  }

  return NextResponse.json({ imageUrl });
}
