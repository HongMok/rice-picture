import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { chatComplete, ChatTimeoutError, CHAT_MODELS, type ChatMessage, type ChatModelKey } from '~/libs/chat';
import {
  createChatSession,
  updateChatSessionMessages,
  getChatSession,
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

  let reply: string;
  try {
    reply = await chatComplete(messages, model);
  } catch (err: any) {
    if (err instanceof ChatTimeoutError) {
      return NextResponse.json({ error: '请求超时，请重试' }, { status: 504 });
    }
    return NextResponse.json(
      { error: err?.message || '对话请求失败' },
      { status: 500 }
    );
  }

  // 入库：首轮 → 创建 session；后续轮 → 覆盖 messages
  const fullMessages: ChatMessage[] = [...messages, { role: 'assistant', content: reply }];
  let sessionId = body.sessionId;
  try {
    if (sessionId && Number.isFinite(sessionId)) {
      // 校验 session 存在且属于本人
      const existing = await getChatSession({ id: sessionId, userId: user.id });
      if (existing) {
        await updateChatSessionMessages({
          id: sessionId,
          userId: user.id,
          messages: fullMessages,
        });
      } else {
        const s = await createChatSession({ userId: user.id, messages: fullMessages });
        sessionId = s.id;
      }
    } else {
      const s = await createChatSession({ userId: user.id, messages: fullMessages });
      sessionId = s.id;
    }
  } catch (err) {
    // 入库失败不阻塞用户拿到回复，仅记录到控制台
    console.warn('[chat] persist session failed', err);
  }

  return NextResponse.json({ reply, sessionId });
}
