import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createPracticeSession, listPracticeSessions } from '~/libs/training';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const items = await listPracticeSessions(user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { scenario_id?: number };
  const sid = Number(body.scenario_id);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: '缺少 scenario_id' }, { status: 400 });
  try {
    const session = await createPracticeSession(user.id, sid);
    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '创建练习失败' }, { status: 500 });
  }
}
