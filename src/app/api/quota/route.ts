import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { queryOne } from '~/libs/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const row = await queryOne<{ total: number; remaining: number }>(
      `
      insert into user_quotas (user_id)
      values ($1)
      on conflict (user_id) do update set user_id = excluded.user_id
      returning total, remaining
      `,
      [user.id]
    );
    return NextResponse.json({ total: row!.total, remaining: row!.remaining });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '额度信息加载失败' },
      { status: 500 }
    );
  }
}
