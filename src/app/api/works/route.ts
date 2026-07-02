import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { listWorks } from '~/libs/works';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const works = await listWorks(user.id);
  return NextResponse.json({ works });
}
