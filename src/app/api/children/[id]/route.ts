import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { deleteChild, getChild, updateChild } from '~/libs/children';
import { listChildAnalysesRecent } from '~/libs/videos';
import { listChildGamesRecent } from '~/libs/games';

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

  const child = await getChild(id, user.id);
  if (!child) return NextResponse.json({ error: '个案不存在' }, { status: 404 });

  const [videos, games] = await Promise.all([
    listChildAnalysesRecent(id, user.id),
    listChildGamesRecent(id, user.id),
  ]);

  return NextResponse.json({
    child,
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      created_at: v.created_at,
    })),
    games: games.map((g) => ({
      id: g.id,
      game_type: g.game_type,
      title: g.title,
      status: g.status,
      score: g.score,
      stars: g.stars,
      difficulty: g.difficulty,
      created_at: g.created_at,
    })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const nickname = String(body.nickname || '').trim();
  if (!nickname) {
    return NextResponse.json({ error: '请填写孩子的称呼' }, { status: 400 });
  }

  const arr = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const child = await updateChild({
    id,
    userId: user.id,
    nickname: nickname.slice(0, 30),
    age: Number.isFinite(body.age) ? Number(body.age) : null,
    gender: body.gender ? String(body.gender) : null,
    diagnosis: body.diagnosis ? String(body.diagnosis) : null,
    severity: body.severity ? String(body.severity) : null,
    strengths: arr(body.strengths),
    weaknesses: arr(body.weaknesses),
    interests: arr(body.interests),
  });

  if (!child) return NextResponse.json({ error: '个案不存在' }, { status: 404 });
  return NextResponse.json({ child });
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

  const ok = await deleteChild(id, user.id);
  if (!ok) return NextResponse.json({ error: '个案不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
