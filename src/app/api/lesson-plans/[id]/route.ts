import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  deleteLessonPlan,
  getLessonPlan,
  lessonPlanOwnerId,
  updateLessonPlan,
  updateLessonPlanTitle,
} from '~/libs/lesson-plans';
import type { LessonPlan } from '~/data/lesson-plan-types';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });

  try {
    const plan = await getLessonPlan(id, user.id);
    if (!plan) {
      const ownerId = await lessonPlanOwnerId(id);
      if (ownerId !== null) {
        return NextResponse.json({ error: '无权访问该教案' }, { status: 403 });
      }
      return NextResponse.json({ error: '教案不存在或已被删除' }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '教案加载失败' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });

  let body: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'generationError'>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  try {
    const ownerId = await lessonPlanOwnerId(id);
    if (ownerId === null) {
      return NextResponse.json({ error: '教案不存在或已被删除' }, { status: 404 });
    }
    if (ownerId !== user.id) {
      return NextResponse.json({ error: '无权修改该教案' }, { status: 403 });
    }

    const plan = await updateLessonPlan(id, user.id, body);
    if (!plan) {
      return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
    }
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '保存失败，请重试' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }

  try {
    const ownerId = await lessonPlanOwnerId(id);
    if (ownerId === null) {
      return NextResponse.json({ error: '教案不存在或已被删除' }, { status: 404 });
    }
    if (ownerId !== user.id) {
      return NextResponse.json({ error: '无权修改该教案' }, { status: 403 });
    }

    const plan = await updateLessonPlanTitle(id, user.id, title);
    if (!plan) return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '保存失败，请重试' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });

  try {
    const ownerId = await lessonPlanOwnerId(id);
    if (ownerId === null) {
      return NextResponse.json({ error: '教案不存在或已被删除' }, { status: 404 });
    }
    if (ownerId !== user.id) {
      return NextResponse.json({ error: '无权删除该教案' }, { status: 403 });
    }

    const ok = await deleteLessonPlan(id, user.id);
    if (!ok) return NextResponse.json({ error: '删除失败，请重试' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '删除失败，请重试' }, { status: 500 });
  }
}
