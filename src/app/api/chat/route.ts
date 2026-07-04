import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  chatComplete,
  ChatTimeoutError,
  CHAT_MODELS,
  type ChatMessage,
  type ChatModelKey,
  type ChatChildContext,
} from '~/libs/chat';
import {
  createChatSession,
  updateChatSessionMessages,
  getChatSession,
  softDeleteChatSession,
} from '~/libs/chat-sessions';
import { getChild } from '~/libs/children';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VALID_MODELS = new Set(CHAT_MODELS.map((m) => m.key));

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    messages?: ChatMessage[];
    model?: ChatModelKey;
    sessionId?: number;
    childId?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: '缺少对话内容' }, { status: 400 });
  }

  const model = body.model && VALID_MODELS.has(body.model) ? body.model : 'qwen-plus';

  // === 先入库（用户发出时就落一条 session） ===
  // 首轮：创建 session，childId 会被锁定进 chat_sessions.child_id
  // 后续：从已有 session 读回 child_id（不再采用前端传过来的 childId，会话锁定后就不可改）
  let sessionId = body.sessionId;
  let createdThisTurn = false;
  let resolvedChildId: number | null = null;
  try {
    if (sessionId && Number.isFinite(sessionId)) {
      const existing = await getChatSession({ id: sessionId, userId: user.id });
      if (existing) {
        resolvedChildId = existing.child_id ?? null;
        await updateChatSessionMessages({ id: sessionId, userId: user.id, messages });
      } else {
        // 前端传的 sessionId 不存在（用户被清库或跨设备）：当作新会话，接受本次 childId
        resolvedChildId = body.childId ?? null;
        const s = await createChatSession({
          userId: user.id,
          messages,
          childId: resolvedChildId,
        });
        sessionId = s.id;
        createdThisTurn = true;
      }
    } else {
      resolvedChildId = body.childId ?? null;
      const s = await createChatSession({
        userId: user.id,
        messages,
        childId: resolvedChildId,
      });
      sessionId = s.id;
      createdThisTurn = true;
    }
  } catch (err) {
    console.warn('[chat] pre-persist session failed', err);
    sessionId = undefined;
    resolvedChildId = body.childId ?? null; // 入库失败时也尽量把本轮 child 上下文传给 AI
  }

  // === 拉个案上下文（如有） ===
  let childCtx: ChatChildContext | null = null;
  if (resolvedChildId) {
    try {
      const child = await getChild(resolvedChildId, user.id);
      if (child) {
        childCtx = {
          nickname: child.nickname,
          age: child.age,
          gender: child.gender,
          diagnosis: child.diagnosis,
          severity: child.severity,
          strengths: child.strengths,
          weaknesses: child.weaknesses,
          interests: child.interests,
        };
      }
    } catch (err) {
      console.warn('[chat] load child ctx failed', err);
    }
  }

  // === 调用 AI ===
  let reply: string;
  try {
    reply = await chatComplete(messages, model, childCtx);
  } catch (err: any) {
    if (createdThisTurn && sessionId) {
      try {
        await softDeleteChatSession({ id: sessionId, userId: user.id });
      } catch {}
    }
    if (err instanceof ChatTimeoutError) {
      return NextResponse.json({ error: '请求超时，请重试' }, { status: 504 });
    }
    return NextResponse.json(
      { error: err?.message || '对话请求失败' },
      { status: 500 }
    );
  }

  // === 补写 assistant 回复 ===
  const fullMessages: ChatMessage[] = [...messages, { role: 'assistant', content: reply }];
  if (sessionId) {
    try {
      await updateChatSessionMessages({ id: sessionId, userId: user.id, messages: fullMessages });
    } catch (err) {
      console.warn('[chat] update session with reply failed', err);
    }
  }

  return NextResponse.json({ reply, sessionId, childId: resolvedChildId });
}
