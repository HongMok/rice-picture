import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getChatSession, softDeleteChatSession } from '~/libs/chat-sessions';

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
