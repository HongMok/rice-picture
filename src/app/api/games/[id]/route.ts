import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getGame } from '~/libs/games';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const game = await getGame(id, user.id);
  if (!game) return NextResponse.json({ error: '游戏不存在' }, { status: 404 });

  return NextResponse.json({ game });
}
