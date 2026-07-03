import { query, queryOne } from '~/libs/db';
import type {
  ABCProcedure,
  GoalChecklistItem,
  GoalHierarchy,
  LessonPlan,
  LessonPlanDuration,
  LessonPlanSkeleton,
  LessonPlanSource,
  TeachingSetup,
} from '~/data/lesson-plan-types';

interface LessonPlanRow {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  type: string;
  title: string | null;
  source: LessonPlanSource | null;
  duration: LessonPlanDuration | null;
  goal_hierarchy: GoalHierarchy;
  teaching_setup: TeachingSetup;
  abc_procedure: ABCProcedure;
  goal_checklist: GoalChecklistItem[];
}

function toLessonPlan(row: LessonPlanRow): LessonPlan {
  return {
    id: row.id,
    type: row.type,
    title: row.title || '',
    source: row.source,
    duration: row.duration,
    goalHierarchy: row.goal_hierarchy,
    teachingSetup: row.teaching_setup,
    abcProcedure: row.abc_procedure,
    goalChecklist: row.goal_checklist || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listLessonPlans(userId: number): Promise<LessonPlan[]> {
  const rows = await query<LessonPlanRow>(
    `select * from lesson_plans
      where user_id = $1 and deleted_at is null
      order by updated_at desc, id desc`,
    [userId]
  );
  return rows.map(toLessonPlan);
}

export async function getLessonPlan(id: number, userId: number): Promise<LessonPlan | null> {
  const row = await queryOne<LessonPlanRow>(
    `select * from lesson_plans
      where id = $1 and user_id = $2 and deleted_at is null`,
    [id, userId]
  );
  return row ? toLessonPlan(row) : null;
}

/** 仅确认归属，不取全部字段，用于鉴权检查 */
export async function lessonPlanOwnerId(id: number): Promise<number | null> {
  const row = await queryOne<{ user_id: number }>(
    `select user_id from lesson_plans
      where id = $1 and deleted_at is null`,
    [id]
  );
  return row?.user_id ?? null;
}

export async function createLessonPlan(
  userId: number,
  skeleton: LessonPlanSkeleton,
  source: LessonPlanSource | null
): Promise<LessonPlan> {
  const row = await queryOne<LessonPlanRow>(
    `insert into lesson_plans
       (user_id, type, title, source, duration, goal_hierarchy, teaching_setup, abc_procedure, goal_checklist)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      userId,
      skeleton.type,
      skeleton.title,
      source ? JSON.stringify(source) : null,
      skeleton.duration ? JSON.stringify(skeleton.duration) : null,
      JSON.stringify(skeleton.goalHierarchy),
      JSON.stringify(skeleton.teachingSetup),
      JSON.stringify(skeleton.abcProcedure),
      JSON.stringify(skeleton.goalChecklist),
    ]
  );
  return toLessonPlan(row!);
}

export async function updateLessonPlan(
  id: number,
  userId: number,
  patch: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LessonPlan | null> {
  const row = await queryOne<LessonPlanRow>(
    `update lesson_plans set
       type = $3,
       title = $4,
       source = $5,
       duration = $6,
       goal_hierarchy = $7,
       teaching_setup = $8,
       abc_procedure = $9,
       goal_checklist = $10,
       updated_at = now()
     where id = $1 and user_id = $2
     returning *`,
    [
      id,
      userId,
      patch.type,
      patch.title,
      patch.source ? JSON.stringify(patch.source) : null,
      patch.duration ? JSON.stringify(patch.duration) : null,
      JSON.stringify(patch.goalHierarchy),
      JSON.stringify(patch.teachingSetup),
      JSON.stringify(patch.abcProcedure),
      JSON.stringify(patch.goalChecklist),
    ]
  );
  return row ? toLessonPlan(row) : null;
}

export async function updateLessonPlanTitle(
  id: number,
  userId: number,
  title: string
): Promise<LessonPlan | null> {
  const row = await queryOne<LessonPlanRow>(
    `update lesson_plans set title = $1, updated_at = now()
      where id = $2 and user_id = $3 and deleted_at is null
      returning *`,
    [title, id, userId]
  );
  return row ? toLessonPlan(row) : null;
}

export async function deleteLessonPlan(id: number, userId: number): Promise<boolean> {
  const rows = await query(
    `update lesson_plans set deleted_at = now()
      where id = $1 and user_id = $2 and deleted_at is null
      returning id`,
    [id, userId]
  );
  return rows.length > 0;
}
