import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getCourse, updateCourseProgress } from '~/libs/training';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });
  const course = await getCourse(id);
  if (!course) return NextResponse.json({ error: '课程不存在' }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    progress_pct?: number;
    last_section?: number;
  };
  const pct = Math.max(0, Math.min(100, Number(body.progress_pct ?? 0)));
  const sec = Math.max(0, Number(body.last_section ?? 0));
  await updateCourseProgress(user.id, id, pct, sec);
  return NextResponse.json({ ok: true });
}
