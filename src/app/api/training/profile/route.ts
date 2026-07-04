import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { computeProfile } from '~/libs/training';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const profile = await computeProfile(user.id);
  return NextResponse.json({ profile });
}
