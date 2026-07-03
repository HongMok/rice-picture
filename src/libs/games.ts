import { getDb, query, queryOne } from '~/libs/db';
import type { Difficulty, GameRound, GameType } from '~/data/game-types';

export interface Game {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  child_id: number | null;
  game_type: GameType;
  title: string | null;
  status: string; // BUILDING / READY / FAILED
  rounds: GameRound[] | null;
  config: Record<string, any> | null;
  score: number | null;
  stars: number | null;
  difficulty: string | null;
}

export async function createGame(params: {
  userId: number;
  childId: number | null;
  gameType: GameType;
  config: Record<string, any>;
}): Promise<Game> {
  const row = await queryOne<Game>(
    `insert into games (user_id, child_id, game_type, status, config)
     values ($1, $2, $3, 'BUILDING', $4)
     returning *`,
    [params.userId, params.childId, params.gameType, params.config]
  );
  return row!;
}

export async function setGameRounds(params: {
  gameId: number;
  title: string;
  rounds: GameRound[];
}): Promise<void> {
  await query(
    `update games
       set title = $1, rounds = $2, status = 'READY', updated_at = now()
     where id = $3`,
    [params.title, JSON.stringify(params.rounds), params.gameId]
  );
}

export async function setGameStatus(gameId: number, status: string): Promise<void> {
  await query('update games set status = $1, updated_at = now() where id = $2', [
    status,
    gameId,
  ]);
}

export async function getGame(id: number, userId: number): Promise<Game | null> {
  return queryOne<Game>('select * from games where id = $1 and user_id = $2', [
    id,
    userId,
  ]);
}

export async function listGames(userId: number, limit = 50): Promise<Game[]> {
  return query<Game>(
    'select * from games where user_id = $1 order by created_at desc limit $2',
    [userId, limit]
  );
}

/** 个案详情页用：该孩子最近玩过的游戏（含 BUILDING/READY 等），按时间倒序 */
export async function listChildGamesRecent(
  childId: number,
  userId: number,
  limit = 20
): Promise<Game[]> {
  return query<Game>(
    `select * from games
     where child_id = $1 and user_id = $2
     order by created_at desc limit $3`,
    [childId, userId, limit]
  );
}

/** reflex 类游戏结算：写回单局得分，若绑定了孩子则累加该孩子的历史积分。
 *  返回累加后的 total_points（无绑定孩子则为 null）。 */
export async function finishGame(params: {
  gameId: number;
  userId: number;
  score: number;
  stars: number;
  difficulty: Difficulty | null;
}): Promise<{ game: Game; totalPoints: number | null } | null> {
  const client = await getDb().connect();
  try {
    await client.query('begin');

    const gameRes = await client.query<Game>(
      `update games
         set score = $1, stars = $2, difficulty = $3, status = 'READY', updated_at = now()
       where id = $4 and user_id = $5
       returning *`,
      [params.score, params.stars, params.difficulty, params.gameId, params.userId]
    );
    const game = gameRes.rows[0];
    if (!game) {
      await client.query('rollback');
      return null;
    }

    let totalPoints: number | null = null;
    if (game.child_id) {
      const childRes = await client.query<{ total_points: number }>(
        `update children set total_points = total_points + $1
         where id = $2 and user_id = $3
         returning total_points`,
        [params.score, game.child_id, params.userId]
      );
      totalPoints = childRes.rows[0]?.total_points ?? null;
    }

    await client.query('commit');
    return { game, totalPoints };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
