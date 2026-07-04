import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getChild } from '~/libs/children';
import { generateGame, describeCharacter } from '~/libs/game-gen';
import { resolveImage, type ImageSpec } from '~/libs/game-images';
import { createGame, setGameRounds, setGameStatus, listGames } from '~/libs/games';
import { GAME_ENGINE, type GameType, type EmotionRound, type MatchRound } from '~/data/game-types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const games = await listGames(user.id);
  return NextResponse.json({ games });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    childId?: number;
    gameType?: GameType;
    roundCount?: number;
    difficulty?: string;
    /** 覆盖使用哪个角色形象出题（不指定则用孩子 interests[0]） */
    character?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const childId = Number.isFinite(body.childId) ? Number(body.childId) : null;

  // reflex 类游戏（捉蝴蝶/打地鼠）：纯前端玩法，不出题不生图，
  //   建一条 BUILDING→READY 的空局记录，供结束后 finish 接口写回分数。
  if (body.gameType && GAME_ENGINE[body.gameType] === 'reflex') {
    const gameType = body.gameType;
    const game = await createGame({
      userId: user.id,
      childId,
      gameType,
      config: { gameType, childId, difficulty: body.difficulty || null },
    });
    await setGameStatus(game.id, 'READY');
    return NextResponse.json({ gameId: game.id, gameType, status: 'READY' });
  }

  const gameType: GameType = body.gameType === 'match' ? 'match' : 'emotion';
  // 默认 3 题：减少一轮要生成的图片数量，缩短出图等待
  const roundCount = Math.min(Math.max(Number(body.roundCount) || 3, 3), 6);
  const child = childId ? await getChild(childId, user.id) : null;

  // 1) 建游戏记录
  const game = await createGame({
    userId: user.id,
    childId,
    gameType,
    config: { gameType, roundCount, childId },
  });

  try {
    // 偏好物角色化：取覆写参数 / 孩子第一个兴趣，作为「演示角色」，
    //   用它来表演各种表情（如兴趣=小猪佩奇 → 画佩奇形象的表情），提升代入感。
    const characterOverride = body.character?.trim() || '';
    const character = characterOverride || child?.interests?.[0]?.trim() || '';

    // 2) 千问定制出题
    const generated = await generateGame(gameType, child, roundCount, character || undefined);
    const rounds = generated.rounds;
    // 去版权化：受版权 IP（奥特曼/佩奇等）直接生图会被 IPInfringementSuspect 拒绝，
    //   转成描述性形象再喂生图。label 仍用原角色名，保证缓存复用。
    const characterVisual = character ? await describeCharacter(character) : '';

    // 3) 收集去重后的图片需求（同一 label 只解析一次）
    const specMap = new Map<string, ImageSpec>();
    const keyOf = (kind: string, label: string) => `${kind}:${label}`;

    // 出图策略：只为「情境主图」（每题 answer 对应的那张）生图，
    //   选项用 emoji / 文字兜底。一轮最多 roundCount 张图，去重后通常更少，
    //   显著缩短生图时间。
    if (gameType === 'emotion') {
      for (const r of rounds as EmotionRound[]) {
        // 角色不同 → label 不同，避免不同孩子/角色的表情图串缓存
        const label = character ? `${character}-${r.answer}` : r.answer;
        const k = keyOf('emotion', label);
        if (!specMap.has(k)) {
          specMap.set(k, {
            kind: 'emotion',
            label,
            emotion: r.answer,
            prompt: characterVisual
              ? `${characterVisual}，脸上是「${r.answer}」的表情，单个角色居中，表情清晰夸张易懂`
              : `一个卡通小朋友，脸上是「${r.answer}」的表情，单个头像居中，表情清晰夸张易懂`,
          });
        }
      }
    } else {
      // 配对题：只给「目标物」生图，选项保持文字
      for (const r of rounds as MatchRound[]) {
        const k = keyOf('object', r.label);
        if (!specMap.has(k)) {
          specMap.set(k, {
            kind: 'object',
            label: r.label,
            prompt: `一个「${r.label}」，单个物体居中，简洁可爱的教学图标`,
          });
        }
      }
    }

    // 4) 顺序解析图片（图库命中即秒回；节流规避 429）
    const urlMap = new Map<string, string | null>();
    for (const [k, spec] of Array.from(specMap.entries())) {
      const url = await resolveImage(user.id, spec);
      urlMap.set(k, url);
    }

    // 5) 回填图 URL
    if (gameType === 'emotion') {
      for (const r of rounds as EmotionRound[]) {
        const label = character ? `${character}-${r.answer}` : r.answer;
        r.imageUrl = urlMap.get(keyOf('emotion', label)) || undefined;
      }
    } else {
      for (const r of rounds as MatchRound[]) {
        r.imageUrl = urlMap.get(keyOf('object', r.label)) || undefined;
      }
    }

    await setGameRounds({ gameId: game.id, title: generated.title, rounds });

    return NextResponse.json({
      gameId: game.id,
      title: generated.title,
      gameType,
      status: 'READY',
    });
  } catch (err: any) {
    await setGameStatus(game.id, 'FAILED');
    return NextResponse.json(
      { error: err?.message || '出题失败', gameId: game.id },
      { status: 502 }
    );
  }
}
