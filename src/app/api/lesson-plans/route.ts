import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createLessonPlan, listLessonPlans } from '~/libs/lesson-plans';
import type { LessonPlanSkeleton, LessonPlanSource } from '~/data/lesson-plan-types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const items = await listLessonPlans(user.id);
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '教案列表加载失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { skeleton?: LessonPlanSkeleton; source?: LessonPlanSource };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  if (!body.skeleton) {
    return NextResponse.json({ error: '缺少教案内容' }, { status: 400 });
  }

  try {
    const plan = await createLessonPlan(user.id, body.skeleton, body.source || null);
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '保存失败，请重试' }, { status: 500 });
  }
}
