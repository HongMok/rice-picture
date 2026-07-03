import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { finishGame } from '~/libs/games';
import { DIFFICULTIES, type Difficulty } from '~/data/game-types';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  let body: { score?: number; stars?: number; difficulty?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const score = Number(body.score);
  const stars = Number(body.stars);
  // difficulty 仅对 reflex 类必填，认知类留 null
  const difficulty = (body.difficulty && DIFFICULTIES.includes(body.difficulty as Difficulty))
    ? (body.difficulty as Difficulty)
    : null;
  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: '得分参数错误' }, { status: 400 });
  }
  if (![1, 2, 3].includes(stars)) {
    return NextResponse.json({ error: '星级参数错误' }, { status: 400 });
  }

  const result = await finishGame({ gameId: id, userId: user.id, score, stars, difficulty });
  if (!result) return NextResponse.json({ error: '游戏不存在' }, { status: 404 });

  return NextResponse.json({
    gameId: result.game.id,
    score: result.game.score,
    stars: result.game.stars,
    difficulty: result.game.difficulty,
    totalPoints: result.totalPoints,
  });
}
