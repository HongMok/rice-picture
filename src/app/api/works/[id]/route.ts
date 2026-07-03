import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getWorkById, softDeleteWork, updateWorkTitle } from '~/libs/works';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的图卡 ID' }, { status: 400 });

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });

  try {
    const work = await updateWorkTitle(id, user.id, title);
    if (!work) return NextResponse.json({ error: '图卡不存在或无权修改' }, { status: 404 });
    return NextResponse.json({ work });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '保存失败，请重试' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: '无效的图卡 ID' }, { status: 400 });

  try {
    const existed = await getWorkById(id, user.id);
    if (!existed) return NextResponse.json({ error: '图卡不存在或无权删除' }, { status: 404 });
    const ok = await softDeleteWork(id, user.id);
    if (!ok) return NextResponse.json({ error: '删除失败，请重试' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '删除失败，请重试' }, { status: 500 });
  }
}
