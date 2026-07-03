import { query, queryOne } from '~/libs/db';
import type { GameRound, GameType } from '~/data/game-types';

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
