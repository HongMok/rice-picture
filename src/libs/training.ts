// 培训测评（模块五）后端服务：课程 / 题库 / 测评 / 练习 / 能力画像
import { query, queryOne } from '~/libs/db';
import type {
  AbilityProfile,
  Competency,
  CompetencyScore,
  CourseListItem,
  Domain,
  DomainCoverage,
  KnowledgeItem,
  PracticeEvaluation,
  PracticeMessage,
  PracticeSession,
  QuizAnswer,
  QuizAttempt,
  TrainingCourse,
  TrainingQuestion,
  TrainingQuiz,
  TrainingScenario,
} from '~/data/training-types';
import {
  COMPETENCIES,
  DOMAINS,
} from '~/data/training-types';

// ============ 课程 ============

export async function listCourses(userId: number): Promise<CourseListItem[]> {
  const rows = await query<any>(
    `select c.id, c.title, c.category, c.duration_min, c.cover_url,
            jsonb_array_length(coalesce(c.outline, '[]'::jsonb)) as section_count,
            coalesce(p.progress_pct, 0) as progress_pct,
            (p.completed_at is not null) as completed
       from training_courses c
       left join training_course_progress p
              on p.course_id = c.id and p.user_id = $1
      where c.deleted_at is null and c.status = 'published'
      order by c.category, c.id`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    duration_min: r.duration_min,
    cover_url: r.cover_url,
    section_count: r.section_count,
    progress_pct: r.progress_pct,
    completed: r.completed,
  }));
}

export async function getCourse(id: number): Promise<TrainingCourse | null> {
  return queryOne<TrainingCourse>(
    `select id, title, category, duration_min, cover_url, video_url,
            raw_transcript, raw_segments, outline, key_takeaways,
            source_ref, status, created_at, updated_at
       from training_courses
      where id = $1 and deleted_at is null`,
    [id]
  );
}

export async function updateCourseProgress(
  userId: number,
  courseId: number,
  progressPct: number,
  lastSection: number
): Promise<void> {
  const completed = progressPct >= 100;
  await query(
    `insert into training_course_progress (user_id, course_id, progress_pct, last_section, completed_at)
     values ($1, $2, $3, $4, case when $3 >= 100 then now() else null end)
     on conflict (user_id, course_id) do update
       set progress_pct = greatest(training_course_progress.progress_pct, excluded.progress_pct),
           last_section = greatest(training_course_progress.last_section, excluded.last_section),
           completed_at = case
             when $3 >= 100 and training_course_progress.completed_at is null then now()
             else training_course_progress.completed_at end,
           updated_at = now()`,
    [userId, courseId, Math.min(100, Math.max(0, progressPct)), lastSection]
  );
  void completed;
}

// ============ 题库 & 测评 ============

export async function listQuizzes(): Promise<TrainingQuiz[]> {
  const rows = await query<any>(
    `select id, title, category, description, question_ids, duration_min,
            pass_score, is_builtin,
            jsonb_array_length(question_ids) as question_count
       from training_quizzes
      where deleted_at is null
      order by is_builtin desc, id`
  );
  return rows.map((r) => ({
    ...r,
    question_ids: Array.isArray(r.question_ids) ? r.question_ids : [],
  }));
}

export async function getQuiz(id: number): Promise<TrainingQuiz | null> {
  const row = await queryOne<any>(
    `select id, title, category, description, question_ids, duration_min, pass_score, is_builtin
       from training_quizzes where id = $1 and deleted_at is null`,
    [id]
  );
  if (!row) return null;
  return {
    ...row,
    question_ids: Array.isArray(row.question_ids) ? row.question_ids : [],
  };
}

export async function getQuestions(ids: number[]): Promise<TrainingQuestion[]> {
  if (!ids.length) return [];
  const rows = await query<TrainingQuestion>(
    `select id, related_course_id, category, difficulty, type, stem, options,
            knowledge_points, source_ref
       from training_questions
      where id = any($1::bigint[]) and deleted_at is null`,
    [ids]
  );
  // 按传入顺序返回
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean) as TrainingQuestion[];
}

/** 判断答案是否正确：所选 key 集合 === 所有 is_correct === true 的 key 集合 */
export function checkAnswer(
  question: TrainingQuestion,
  chosen: string[]
): boolean {
  const correctKeys = question.options
    .filter((o) => o.is_correct)
    .map((o) => o.key)
    .sort()
    .join(',');
  const chosenKeys = [...chosen].sort().join(',');
  return correctKeys === chosenKeys;
}

export async function submitQuizAttempt(
  userId: number,
  quizId: number,
  rawAnswers: { question_id: number; chosen: string[]; time_ms?: number }[],
  durationSec: number
): Promise<QuizAttempt> {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new Error('测评卷不存在');

  const questions = await getQuestions(quiz.question_ids);
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const answers: QuizAnswer[] = rawAnswers.map((a) => {
    const q = qMap.get(a.question_id);
    if (!q) return { ...a, correct: false };
    return { ...a, correct: checkAnswer(q, a.chosen) };
  });

  const correctCount = answers.filter((a) => a.correct).length;
  const score = quiz.question_ids.length > 0
    ? Math.round((correctCount / quiz.question_ids.length) * 100)
    : 0;

  const row = await queryOne<any>(
    `insert into training_quiz_attempts (user_id, quiz_id, answers, score, duration_sec, submitted_at)
     values ($1, $2, $3::jsonb, $4, $5, now())
     returning id, user_id, quiz_id, answers, score, duration_sec, submitted_at, created_at`,
    [userId, quizId, JSON.stringify(answers), score, durationSec]
  );
  return row as QuizAttempt;
}

export async function getAttempt(userId: number, id: number): Promise<QuizAttempt | null> {
  return queryOne<QuizAttempt>(
    `select id, user_id, quiz_id, answers, score, duration_sec, submitted_at, created_at
       from training_quiz_attempts where id = $1 and user_id = $2`,
    [id, userId]
  );
}

/** 我的测评历史：按时间倒序，每条含卷子标题和分数 */
export async function listQuizAttempts(
  userId: number
): Promise<Array<QuizAttempt & { quiz_title: string; quiz_pass_score: number }>> {
  return query<any>(
    `select a.id, a.user_id, a.quiz_id, a.answers, a.score, a.duration_sec,
            a.submitted_at, a.created_at,
            q.title as quiz_title, q.pass_score as quiz_pass_score
       from training_quiz_attempts a
       join training_quizzes q on q.id = a.quiz_id
      where a.user_id = $1
      order by a.created_at desc`,
    [userId]
  );
}

// ============ 情景练习 ============

export async function listScenarios(): Promise<TrainingScenario[]> {
  return query<TrainingScenario>(
    `select id, title, category, related_course_id, role_persona,
            initial_message, evaluation_rubric, success_criteria, is_builtin
       from training_scenarios where deleted_at is null order by is_builtin desc, id`
  );
}

export async function getScenario(id: number): Promise<TrainingScenario | null> {
  return queryOne<TrainingScenario>(
    `select id, title, category, related_course_id, role_persona,
            initial_message, evaluation_rubric, success_criteria, is_builtin
       from training_scenarios where id = $1 and deleted_at is null`,
    [id]
  );
}

export async function createPracticeSession(
  userId: number,
  scenarioId: number
): Promise<PracticeSession> {
  const scenario = await getScenario(scenarioId);
  if (!scenario) throw new Error('练习场景不存在');

  const initial: PracticeMessage[] = scenario.initial_message
    ? [{ role: 'assistant', content: scenario.initial_message, ts: Date.now() }]
    : [];

  const row = await queryOne<any>(
    `insert into training_practice_sessions (user_id, scenario_id, messages, status)
     values ($1, $2, $3::jsonb, 'in_progress')
     returning id, user_id, scenario_id, messages, evaluation, status,
               created_at, updated_at, completed_at`,
    [userId, scenarioId, JSON.stringify(initial)]
  );
  return row as PracticeSession;
}

export async function getPracticeSession(
  userId: number,
  id: number
): Promise<PracticeSession | null> {
  return queryOne<PracticeSession>(
    `select id, user_id, scenario_id, messages, evaluation, status,
            created_at, updated_at, completed_at
       from training_practice_sessions
      where id = $1 and user_id = $2 and deleted_at is null`,
    [id, userId]
  );
}

export async function appendPracticeMessage(
  userId: number,
  sessionId: number,
  message: PracticeMessage
): Promise<void> {
  await query(
    `update training_practice_sessions
        set messages = messages || $3::jsonb, updated_at = now()
      where id = $1 and user_id = $2`,
    [sessionId, userId, JSON.stringify([message])]
  );
}

export async function completePracticeSession(
  userId: number,
  sessionId: number,
  evaluation: PracticeEvaluation
): Promise<void> {
  await query(
    `update training_practice_sessions
        set evaluation = $3::jsonb,
            status = 'completed',
            completed_at = now(),
            updated_at = now()
      where id = $1 and user_id = $2`,
    [sessionId, userId, JSON.stringify(evaluation)]
  );
}

export async function listPracticeSessions(userId: number): Promise<PracticeSession[]> {
  return query<PracticeSession>(
    `select id, user_id, scenario_id, messages, evaluation, status,
            created_at, updated_at, completed_at
       from training_practice_sessions
      where user_id = $1 and deleted_at is null
      order by updated_at desc`,
    [userId]
  );
}

// ============ 知识点条目 ============

export async function listKnowledgeItems(): Promise<KnowledgeItem[]> {
  return query<KnowledgeItem>(
    `select id, code, domain, title, summary, key_points, common_mistakes,
            question_angles, source_videos, sort
       from training_knowledge_items where deleted_at is null
       order by sort, code`
  );
}

// ============ 能力画像（实时聚合，按 C1-C6） ============

/**
 * 从用户所有历史答题（最新一次每卷）里，按每题命中的 C1-C6 汇总正确率。
 * 综合分：全部题的正确率 × 100（更直观），C4 关键项如答错则打上 critical_failed 标记。
 */
export async function computeProfile(userId: number): Promise<AbilityProfile> {
  // 每题的正确/命中能力
  const rows = await query<any>(
    `with latest as (
       select distinct on (a.quiz_id) a.id, a.answers, a.created_at
         from training_quiz_attempts a
        where a.user_id = $1
        order by a.quiz_id, a.created_at desc
     ),
     unpacked as (
       select (elem->>'question_id')::bigint as qid,
              (elem->>'correct')::boolean   as correct
         from latest, jsonb_array_elements(latest.answers) elem
     )
     select u.qid, u.correct,
            q.competencies, q.category as domain, q.is_key_item, q.cognitive_level
       from unpacked u
       join training_questions q on q.id = u.qid`,
    [userId]
  );

  // C1-C6 聚合
  const compMap = new Map<Competency, { total: number; ok: number; failedCritical: boolean }>();
  for (const c of COMPETENCIES) compMap.set(c.key, { total: 0, ok: 0, failedCritical: false });

  // D1-D12 聚合
  const domMap = new Map<Domain, { total: number; ok: number }>();
  for (const d of DOMAINS) domMap.set(d.key, { total: 0, ok: 0 });

  for (const r of rows) {
    const comps: Competency[] = Array.isArray(r.competencies) ? r.competencies : [];
    for (const c of comps) {
      const m = compMap.get(c);
      if (!m) continue;
      m.total += 1;
      if (r.correct) m.ok += 1;
      else if (r.is_key_item && c === 'C4') m.failedCritical = true;
    }
    const d = domMap.get(r.domain as Domain);
    if (d) {
      d.total += 1;
      if (r.correct) d.ok += 1;
    }
  }

  const competencies: CompetencyScore[] = COMPETENCIES.map((c) => {
    const m = compMap.get(c.key)!;
    const score = m.total > 0 ? Math.round((m.ok / m.total) * 100) : 0;
    return {
      key: c.key,
      name: c.name,
      score,
      question_total: m.total,
      question_ok: m.ok,
      is_critical: !!c.is_critical,
      critical_failed: m.failedCritical,
    };
  });

  // 领域覆盖（这里 total_available = 该领域库里的题目数）
  const availRows = await query<any>(
    `select category as domain, count(*)::int as total
       from training_questions
      where deleted_at is null and status = 'published'
      group by category`
  );
  const availMap = new Map(availRows.map((r) => [r.domain, r.total]));

  const domains: DomainCoverage[] = DOMAINS.map((d) => {
    const m = domMap.get(d.key)!;
    return {
      key: d.key,
      name: d.name,
      weight: d.weight,
      answered: m.total,
      total_available: (availMap.get(d.key) as number) || 0,
      accuracy: m.total > 0 ? Math.round((m.ok / m.total) * 100) : 0,
    };
  });

  const totalOk = rows.filter((r: any) => r.correct).length;
  const overall = rows.length > 0 ? Math.round((totalOk / rows.length) * 100) : 0;

  const activeCompsSorted = [...competencies]
    .filter((c) => c.question_total > 0)
    .sort((a, b) => b.score - a.score);
  const strengths = activeCompsSorted.filter((c) => c.score >= 70).slice(0, 2);
  const weaknesses = [...activeCompsSorted].reverse().slice(0, 2);

  // 推荐：找弱项对应课程
  const recs: AbilityProfile['recommendations'] = [];
  for (const w of weaknesses) {
    if (w.score >= 70) continue;
    const c = await queryOne<any>(
      `select c.id, c.title
         from training_courses c
         left join training_course_progress p
                on p.course_id = c.id and p.user_id = $1
        where c.deleted_at is null and c.status = 'published'
          and (p.completed_at is null)
        order by c.id
        limit 1`,
      [userId]
    );
    if (c) {
      recs.push({
        kind: 'course',
        id: c.id,
        title: c.title,
        reason: `${w.name}目前 ${w.score} 分，从课程库补起`,
      });
    }
  }

  return {
    overall,
    competencies,
    domains,
    strengths,
    weaknesses,
    recommendations: recs,
  };
}
