import { query, queryOne } from '~/libs/db';

export interface Child {
  id: number;
  created_at: string;
  user_id: number;
  nickname: string;
  age: number | null;
  gender: string | null;
  diagnosis: string | null;
  severity: string | null;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
  total_points: number;
}

export async function createChild(params: {
  userId: number;
  nickname: string;
  age?: number | null;
  gender?: string | null;
  diagnosis?: string | null;
  severity?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  interests?: string[];
}): Promise<Child> {
  const row = await queryOne<Child>(
    `insert into children
       (user_id, nickname, age, gender, diagnosis, severity, strengths, weaknesses, interests)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      params.userId,
      params.nickname,
      params.age ?? null,
      params.gender ?? null,
      params.diagnosis ?? null,
      params.severity ?? null,
      params.strengths ?? [],
      params.weaknesses ?? [],
      params.interests ?? [],
    ]
  );
  return row!;
}

export async function getChild(id: number, userId: number): Promise<Child | null> {
  return queryOne<Child>('select * from children where id = $1 and user_id = $2', [
    id,
    userId,
  ]);
}

export async function updateChild(params: {
  id: number;
  userId: number;
  nickname: string;
  age?: number | null;
  gender?: string | null;
  diagnosis?: string | null;
  severity?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  interests?: string[];
}): Promise<Child | null> {
  return queryOne<Child>(
    `update children set
       nickname = $3, age = $4, gender = $5, diagnosis = $6, severity = $7,
       strengths = $8, weaknesses = $9, interests = $10
     where id = $1 and user_id = $2
     returning *`,
    [
      params.id,
      params.userId,
      params.nickname,
      params.age ?? null,
      params.gender ?? null,
      params.diagnosis ?? null,
      params.severity ?? null,
      params.strengths ?? [],
      params.weaknesses ?? [],
      params.interests ?? [],
    ]
  );
}

export async function listChildren(userId: number, limit = 50): Promise<Child[]> {
  return query<Child>(
    'select * from children where user_id = $1 order by created_at desc limit $2',
    [userId, limit]
  );
}

export async function deleteChild(id: number, userId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    'delete from children where id = $1 and user_id = $2 returning id',
    [id, userId]
  );
  return rows.length > 0;
}
