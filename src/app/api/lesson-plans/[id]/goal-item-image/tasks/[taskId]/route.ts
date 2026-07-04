import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { queryImageTask } from '~/libs/dashscope';
import { hasBlobToken, persistImage } from '~/libs/blob';
import {
  getLessonPlan,
  lessonPlanOwnerId,
  updateLessonPlan,
} from '~/libs/lesson-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 两步式生图（2/2）：查询任务状态，SUCCEEDED 时持久化到 Blob 并写回 goalChecklist
export async function GET(
  _req: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const planId = Number(params.id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });
  }

  const taskId = params.taskId;
  if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

  const ownerId = await lessonPlanOwnerId(planId);
  if (ownerId === null) return NextResponse.json({ error: '教案不存在' }, { status: 404 });
  if (ownerId !== user.id) return NextResponse.json({ error: '无权访问该教案' }, { status: 403 });

  const plan = await getLessonPlan(planId, user.id);
  if (!plan) return NextResponse.json({ error: '教案不存在' }, { status: 404 });

  // 找到用 taskId 追踪中的目标项（幂等：若已回写 imageUrl 则直接返回）
  const item = plan.goalChecklist.find(
    (g) => (g as any).imageTaskId === taskId
  );
  if (item?.imageUrl && !(item as any).imageTaskId) {
    return NextResponse.json({ status: 'SUCCEEDED', imageUrl: item.imageUrl });
  }

  const result = await queryImageTask(taskId);

  if (result.status === 'SUCCEEDED' && result.imageUrl && item) {
    // 存永久 Blob；无 Blob token 时降级用原 dashscope URL（会 24h 过期）
    let finalUrl = result.imageUrl;
    if (hasBlobToken()) {
      try {
        finalUrl = await persistImage(result.imageUrl, `lesson-plan-goal-${item.id}`);
      } catch (err: any) {
        console.warn('[goal-item-image tasks] persistImage failed:', err?.message);
      }
    }

    const nextChecklist = plan.goalChecklist.map((g) => {
      if (g.id !== item.id) return g;
      const { imageTaskId: _drop, ...rest } = g as any;
      return { ...rest, imageUrl: finalUrl };
    });

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
      console.warn('[goal-item-image tasks] persist url failed:', err?.message);
    }

    return NextResponse.json({ status: 'SUCCEEDED', imageUrl: finalUrl });
  }

  if (result.status === 'FAILED' && item) {
    // 清 taskId
    const nextChecklist = plan.goalChecklist.map((g) => {
      if (g.id !== item.id) return g;
      const { imageTaskId: _drop, ...rest } = g as any;
      return rest;
    });
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
    } catch {
      // ignore
    }
    return NextResponse.json({
      status: 'FAILED',
      message: result.message || '生成失败',
    });
  }

  return NextResponse.json({ status: result.status });
}
