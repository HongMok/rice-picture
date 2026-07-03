import { query, queryOne } from '~/libs/db';
import type { LessonPlanSkeleton } from '~/data/lesson-plan-types';

export interface LessonPlanTemplateRow {
  id: number;
  created_at: string;
  user_id: number | null;
  name: string;
  is_builtin: boolean;
  skill: string | null;
  content: LessonPlanSkeleton;
}

export async function listTemplates(userId: number): Promise<{
  builtin: LessonPlanTemplateRow[];
  mine: LessonPlanTemplateRow[];
}> {
  const rows = await query<LessonPlanTemplateRow>(
    `select * from lesson_plan_templates
      where is_builtin = true or user_id = $1
      order by is_builtin desc, id asc`,
    [userId]
  );
  return {
    builtin: rows.filter((r) => r.is_builtin),
    mine: rows.filter((r) => !r.is_builtin),
  };
}

export async function findMyTemplateByName(
  userId: number,
  name: string
): Promise<LessonPlanTemplateRow | null> {
  return queryOne<LessonPlanTemplateRow>(
    `select * from lesson_plan_templates where user_id = $1 and is_builtin = false and name = $2`,
    [userId, name]
  );
}

export async function saveCustomTemplate(
  userId: number,
  name: string,
  content: LessonPlanSkeleton,
  skill?: string
): Promise<LessonPlanTemplateRow> {
  const row = await queryOne<LessonPlanTemplateRow>(
    `insert into lesson_plan_templates (user_id, name, is_builtin, skill, content)
     values ($1, $2, false, $3, $4)
     returning *`,
    [userId, name, skill || null, JSON.stringify(content)]
  );
  return row!;
}

export async function ensureBuiltinTemplatesSeeded(
  templates: { name: string; skill: string; content: LessonPlanSkeleton }[]
): Promise<void> {
  const existing = await query<{ name: string }>(
    `select name from lesson_plan_templates where is_builtin = true`
  );
  const existingNames = new Set(existing.map((r) => r.name));
  for (const t of templates) {
    if (existingNames.has(t.name)) continue;
    await query(
      `insert into lesson_plan_templates (user_id, name, is_builtin, skill, content)
       values (null, $1, true, $2, $3)`,
      [t.name, t.skill, JSON.stringify(t.content)]
    );
  }
}
