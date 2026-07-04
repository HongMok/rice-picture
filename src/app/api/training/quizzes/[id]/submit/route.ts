import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { submitQuizAttempt } from '~/libs/training';

export const dynamic = 'force-dynamic';

/** 提交测评答案，服务端判分并入库 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const quizId = Number(params.id);
  if (!Number.isFinite(quizId)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    answers?: { question_id: number; chosen: string[]; time_ms?: number }[];
    duration_sec?: number;
  };
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: '缺少答案数据' }, { status: 400 });
  }

  try {
    const attempt = await submitQuizAttempt(
      user.id,
      quizId,
      body.answers,
      Number(body.duration_sec) || 0
    );
    return NextResponse.json({ attempt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '提交失败' }, { status: 500 });
  }
}
