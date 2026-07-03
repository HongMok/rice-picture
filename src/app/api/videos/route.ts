import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getChild } from '~/libs/children';
import { analyzeVideo } from '~/libs/video-analyze';
import { createAnalysis, setReport, setStatus, listAnalyses } from '~/libs/videos';
import { OSS_RE } from '~/libs/oss-upload';

export const runtime = 'nodejs';
// VL thinking 模型看视频较慢，给足时长（Vercel 需 Pro 才支持到 300s，Hobby 上限 60s）
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const rows = await listAnalyses(user.id);
  const analyses = rows.map((r) => ({
    id: r.id,
    title: r.title,
    videoUrl: r.video_url,
    status: r.status,
    report: r.report,
    error: r.error,
    createdAt: r.created_at,
    childId: r.child_id,
  }));
  return NextResponse.json({ analyses });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { videoUrl?: string; childId?: number; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const videoUrl = String(body.videoUrl || '').trim();
  // 校验视频地址来自我们的 OSS 桶（防 SSRF，同时确保是用户真实上传的文件）
  if (!OSS_RE.test(videoUrl)) {
    return NextResponse.json({ error: '视频地址不合法，请重新上传' }, { status: 400 });
  }

  const childId = Number.isFinite(body.childId) ? Number(body.childId) : null;
  const child = childId ? await getChild(childId, user.id) : null;
  const title =
    (body.title && String(body.title).trim().slice(0, 60)) ||
    (child ? `${child.nickname}的课堂分析` : '课堂视频分析');

  // 建记录（ANALYZING），即使后续请求超时，前端仍可靠轮询这条记录
  const row = await createAnalysis({
    userId: user.id,
    childId,
    title,
    videoUrl,
  });

  try {
    const report = await analyzeVideo(videoUrl, child);
    await setReport(row.id, report);
    return NextResponse.json({ id: row.id, status: 'DONE' });
  } catch (err: any) {
    await setStatus(row.id, 'FAILED', err?.message || '视频分析失败');
    return NextResponse.json(
      { id: row.id, error: err?.message || '视频分析失败' },
      { status: 502 }
    );
  }
}
