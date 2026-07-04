import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createDraftLessonPlan } from '~/libs/lesson-plans';
import type { LessonPlanSource } from '~/data/lesson-plan-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 创建"生成中"的空壳教案。毫秒级返回 id，前端立即跳转到详情页占位。
 * 真正的 AI 起草由 POST /api/lesson-plans/[id]/generate 异步跑。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { title?: string; source?: LessonPlanSource | null } = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body：title 用默认值
  }

  const title = (body.title || '').trim().slice(0, 60) || '正在生成…';

  try {
    const plan = await createDraftLessonPlan(user.id, title, body.source ?? null);
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '创建失败，请重试' }, { status: 500 });
  }
}
