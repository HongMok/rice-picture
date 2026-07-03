import { query, queryOne } from '~/libs/db';

export interface Work {
  id: number;
  created_at: string;
  user_id: number;
  template_id: string;
  title: string | null;
  input_text: string | null;
  prompt: string | null;
  status: string;
  task_id: string | null;
  output_url: string | null;
}

export async function createWork(params: {
  userId: number;
  templateId: string;
  title: string;
  inputText: string;
  prompt: string;
  taskId: string;
}): Promise<Work> {
  const row = await queryOne<Work>(
    `insert into works (user_id, template_id, title, input_text, prompt, task_id, status)
     values ($1, $2, $3, $4, $5, $6, 'PENDING')
     returning *`,
    [
      params.userId,
      params.templateId,
      params.title,
      params.inputText,
      params.prompt,
      params.taskId,
    ]
  );
  return row!;
}

export async function updateWorkStatus(params: {
  taskId: string;
  status: string;
  outputUrl?: string;
}): Promise<void> {
  await query(
    `update works set status = $1, output_url = coalesce($2, output_url), updated_at = now()
     where task_id = $3`,
    [params.status, params.outputUrl ?? null, params.taskId]
  );
}

export async function getWorkByTaskId(
  taskId: string,
  userId: number
): Promise<Work | null> {
  return queryOne<Work>(
    'select * from works where task_id = $1 and user_id = $2',
    [taskId, userId]
  );
}

export async function getWorkById(
  id: number,
  userId: number
): Promise<Work | null> {
  return queryOne<Work>(
    `select * from works
      where id = $1 and user_id = $2 and deleted_at is null`,
    [id, userId]
  );
}

export async function listWorks(userId: number, limit = 50): Promise<Work[]> {
  return query<Work>(
    `select * from works
      where user_id = $1 and deleted_at is null
      order by created_at desc
      limit $2`,
    [userId, limit]
  );
}

export async function updateWorkTitle(
  id: number,
  userId: number,
  title: string
): Promise<Work | null> {
  return queryOne<Work>(
    `update works set title = $1, updated_at = now()
      where id = $2 and user_id = $3 and deleted_at is null
      returning *`,
    [title, id, userId]
  );
}

export async function softDeleteWork(
  id: number,
  userId: number
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `update works set deleted_at = now()
      where id = $1 and user_id = $2 and deleted_at is null
      returning id`,
    [id, userId]
  );
  return !!row;
}
