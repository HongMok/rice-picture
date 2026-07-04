import { query, queryOne } from '~/libs/db';
import {
  defaultSkeleton,
  type ABCProcedure,
  type GoalChecklistItem,
  type GoalHierarchy,
  type LessonPlan,
  type LessonPlanDuration,
  type LessonPlanSkeleton,
  type LessonPlanSource,
  type LessonPlanStatus,
  type TeachingSetup,
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
  status: string | null;
  generation_error: string | null;
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
    status: (row.status as LessonPlanStatus) || 'READY',
    generationError: row.generation_error,
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
  source: LessonPlanSource | null,
  status: LessonPlanStatus = 'READY'
): Promise<LessonPlan> {
  const row = await queryOne<LessonPlanRow>(
    `insert into lesson_plans
       (user_id, type, title, source, duration, goal_hierarchy, teaching_setup, abc_procedure, goal_checklist, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      status,
    ]
  );
  return toLessonPlan(row!);
}

/** 创建"生成中"的空壳教案。前端点生成后立即拿 id 跳详情页，AI 由后台异步跑。 */
export async function createDraftLessonPlan(
  userId: number,
  title: string,
  source: LessonPlanSource | null
): Promise<LessonPlan> {
  const skeleton = defaultSkeleton(title || '正在生成…');
  return createLessonPlan(userId, skeleton, source, 'GENERATING');
}

/** 生成成功：把 AI 起草的 skeleton 写回，status → READY */
export async function finalizeDraftLessonPlan(
  id: number,
  userId: number,
  skeleton: LessonPlanSkeleton,
  source: LessonPlanSource | null
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
       status = 'READY',
       generation_error = null,
       updated_at = now()
     where id = $1 and user_id = $2 and deleted_at is null
     returning *`,
    [
      id,
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
  return row ? toLessonPlan(row) : null;
}

/** 生成失败：留下错误信息，前端展示"重试"入口 */
export async function markLessonPlanGenerationFailed(
  id: number,
  userId: number,
  message: string
): Promise<LessonPlan | null> {
  const row = await queryOne<LessonPlanRow>(
    `update lesson_plans set
       status = 'FAILED',
       generation_error = $3,
       updated_at = now()
     where id = $1 and user_id = $2 and deleted_at is null
     returning *`,
    [id, userId, message.slice(0, 500)]
  );
  return row ? toLessonPlan(row) : null;
}

/** 重置为"生成中"（用户点重试时用） */
export async function resetLessonPlanToGenerating(
  id: number,
  userId: number
): Promise<LessonPlan | null> {
  const row = await queryOne<LessonPlanRow>(
    `update lesson_plans set
       status = 'GENERATING',
       generation_error = null,
       updated_at = now()
     where id = $1 and user_id = $2 and deleted_at is null
     returning *`,
    [id, userId]
  );
  return row ? toLessonPlan(row) : null;
}

export async function updateLessonPlan(
  id: number,
  userId: number,
  patch: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'generationError'>
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
