import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getAnalysis } from '~/libs/videos';
import { getChild } from '~/libs/children';
import { askInsight, type InsightTurn } from '~/libs/video-insight';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  let body: { question?: string; history?: InsightTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const question = String(body.question || '').trim();
  if (!question) return NextResponse.json({ error: '请输入问题' }, { status: 400 });
  const history: InsightTurn[] = Array.isArray(body.history)
    ? body.history
        .map((h: any): InsightTurn => ({
          role: h?.role === 'ai' ? 'ai' : 'user',
          text: String(h?.text || '').trim(),
        }))
        .filter((h) => h.text)
        .slice(-12) // 只带最近若干轮，控制 token
    : [];

  const row = await getAnalysis(id, user.id);
  if (!row) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  if (row.status !== 'DONE' || !row.report) {
    return NextResponse.json({ error: '这份报告还没生成完成' }, { status: 400 });
  }

  const child = row.child_id ? await getChild(row.child_id, user.id) : null;

  try {
    const result = await askInsight(row.report, child, history, question);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'AI 洞察失败' }, { status: 502 });
  }
}
