import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { chatComplete, ChatTimeoutError, CHAT_MODELS, type ChatMessage, type ChatModelKey } from '~/libs/chat';
import {
  createChatSession,
  updateChatSessionMessages,
  getChatSession,
  softDeleteChatSession,
} from '~/libs/chat-sessions';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VALID_MODELS = new Set(CHAT_MODELS.map((m) => m.key));

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { messages?: ChatMessage[]; model?: ChatModelKey; sessionId?: number };
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

  // === 先入库（用户发出时就落一条 session）===
  // 首轮：创建 session，只带当前 user messages（无 assistant reply）
  // 后续：先把新用户消息写进已有 session
  // 这样侧栏在 AI 还没回复时就能看到条目。
  let sessionId = body.sessionId;
  let createdThisTurn = false;
  try {
    if (sessionId && Number.isFinite(sessionId)) {
      const existing = await getChatSession({ id: sessionId, userId: user.id });
      if (existing) {
        await updateChatSessionMessages({ id: sessionId, userId: user.id, messages });
      } else {
        const s = await createChatSession({ userId: user.id, messages });
        sessionId = s.id;
        createdThisTurn = true;
      }
    } else {
      const s = await createChatSession({ userId: user.id, messages });
      sessionId = s.id;
      createdThisTurn = true;
    }
  } catch (err) {
    console.warn('[chat] pre-persist session failed', err);
    sessionId = undefined;
  }

  // === 调用 AI ===
  let reply: string;
  try {
    reply = await chatComplete(messages, model);
  } catch (err: any) {
    // AI 调用失败：如果本轮刚创建的空对话，回滚软删；已有对话保留（user 消息值得留下）
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

  return NextResponse.json({ reply, sessionId });
}
