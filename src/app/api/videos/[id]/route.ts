import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  getAnalysis,
  listChildAnalyses,
  renameAnalysis,
  softDeleteAnalysis,
} from '~/libs/videos';
import type { HistoryPoint } from '~/data/video-types';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const row = await getAnalysis(id, user.id);
  if (!row) return NextResponse.json({ error: '记录不存在' }, { status: 404 });

  // 关联了孩子个案时，拉该孩子历次分析的能力得分，供趋势图
  let history: HistoryPoint[] = [];
  if (row.child_id) {
    const rows = await listChildAnalyses(row.child_id, user.id);
    history = rows
      .filter((r) => Array.isArray(r.report?.childRadar))
      .map((r) => ({
        id: r.id,
        date: String(r.created_at).slice(0, 10),
        scores: Object.fromEntries(
          (r.report!.childRadar || []).map((d) => [d.name, d.score])
        ),
      }));
  }

  return NextResponse.json({
    analysis: {
      id: row.id,
      title: row.title,
      videoUrl: row.video_url,
      status: row.status,
      report: row.report,
      error: row.error,
      createdAt: row.created_at,
      history,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const title = (body.title || '').trim();
  if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  if (title.length > 60) return NextResponse.json({ error: '标题最多 60 字' }, { status: 400 });

  await renameAnalysis({ id, userId: user.id, title });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  await softDeleteAnalysis({ id, userId: user.id });
  return NextResponse.json({ ok: true });
}
