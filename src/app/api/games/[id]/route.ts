import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getGame, renameGame, softDeleteGame } from '~/libs/games';

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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const title = (body.title || '').trim();
  if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  if (title.length > 60) return NextResponse.json({ error: '标题最多 60 字' }, { status: 400 });

  await renameGame({ id, userId: user.id, title });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  await softDeleteGame({ id, userId: user.id });
  return NextResponse.json({ ok: true });
}
