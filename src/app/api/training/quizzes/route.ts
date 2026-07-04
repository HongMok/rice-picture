import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { listQuizzes } from '~/libs/training';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const items = await listQuizzes();
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '测评列表加载失败' }, { status: 500 });
  }
}
