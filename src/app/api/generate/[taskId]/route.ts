import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { queryImageTask } from '~/libs/dashscope';
import { getWorkByTaskId, updateWorkStatus } from '~/libs/works';
import { hasBlobToken, persistImage } from '~/libs/blob';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { taskId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const taskId = params.taskId;
  const work = await getWorkByTaskId(taskId, user.id);
  if (!work) {
    return NextResponse.json({ error: '作品不存在' }, { status: 404 });
  }

  // 已完成的直接返回缓存结果，不再打 DashScope
  if (work.status === 'SUCCEEDED' && work.output_url) {
    return NextResponse.json({
      status: 'SUCCEEDED',
      imageUrl: work.output_url,
      workId: work.id,
    });
  }

  const result = await queryImageTask(taskId);
  let finalUrl = result.imageUrl;

  // 生成成功且配置了 Blob token 时，把 DashScope 24h 临时链转存为永久 URL。
  // 转存失败不阻塞用户拿到结果，退回原临时链。
  if (result.status === 'SUCCEEDED' && result.imageUrl && hasBlobToken()) {
    try {
      finalUrl = await persistImage(result.imageUrl, work.title || `work-${work.id}`);
    } catch (err) {
      console.warn('[persistImage] work fallback to temp url', err);
    }
  }

  if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
    await updateWorkStatus({
      taskId,
      status: result.status,
      outputUrl: finalUrl,
    });
  } else if (result.status === 'RUNNING' && work.status === 'PENDING') {
    await updateWorkStatus({ taskId, status: 'RUNNING' });
  }

  return NextResponse.json({
    status: result.status,
    imageUrl: finalUrl,
    message: result.message,
    workId: work.id,
  });
}
