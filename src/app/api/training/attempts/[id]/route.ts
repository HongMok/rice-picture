import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getAttempt, getQuiz, getQuestions } from '~/libs/training';

export const dynamic = 'force-dynamic';

/** 获取一次答题记录 + 卷子元信息 + 完整题目（含答案解析，用于回顾） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const attempt = await getAttempt(user.id, id);
  if (!attempt) return NextResponse.json({ error: '记录不存在' }, { status: 404 });

  const quiz = await getQuiz(attempt.quiz_id);
  if (!quiz) return NextResponse.json({ error: '测评卷已被删除' }, { status: 404 });

  const questions = await getQuestions(quiz.question_ids);
  return NextResponse.json({ attempt, quiz, questions });
}
