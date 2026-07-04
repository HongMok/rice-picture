import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getQuiz, getQuestions } from '~/libs/training';
import type { TrainingQuestion } from '~/data/training-types';

export const dynamic = 'force-dynamic';

/** 拉取一份卷子 + 所有题目（题干 + 选项文本，不含 is_correct/explain，防作弊） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const quiz = await getQuiz(id);
  if (!quiz) return NextResponse.json({ error: '测评卷不存在' }, { status: 404 });

  const questions = await getQuestions(quiz.question_ids);
  const sanitized = questions.map((q) => ({
    id: q.id,
    related_course_id: q.related_course_id,
    category: q.category,
    difficulty: q.difficulty,
    type: q.type,
    stem: q.stem,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
    knowledge_points: q.knowledge_points,
  })) as Array<Partial<TrainingQuestion>>;

  return NextResponse.json({ quiz, questions: sanitized });
}
