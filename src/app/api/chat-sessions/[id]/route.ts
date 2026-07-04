import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  getChatSession,
  renameChatSession,
  softDeleteChatSession,
} from '~/libs/chat-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const session = await getChatSession({ id, userId: user.id });
  if (!session) {
    return NextResponse.json({ error: '对话不存在' }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
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
  if (!title) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }
  if (title.length > 60) {
    return NextResponse.json({ error: '标题最多 60 字' }, { status: 400 });
  }

  await renameChatSession({ id, userId: user.id, title });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  await softDeleteChatSession({ id, userId: user.id });
  return NextResponse.json({ ok: true });
}
