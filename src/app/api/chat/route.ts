import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { chatComplete, ChatTimeoutError, CHAT_MODELS, type ChatMessage, type ChatModelKey } from '~/libs/chat';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VALID_MODELS = new Set(CHAT_MODELS.map((m) => m.key));

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { messages?: ChatMessage[]; model?: ChatModelKey };
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

  try {
    const reply = await chatComplete(messages, model);
    return NextResponse.json({ reply });
  } catch (err: any) {
    if (err instanceof ChatTimeoutError) {
      return NextResponse.json({ error: '请求超时，请重试' }, { status: 504 });
    }
    return NextResponse.json(
      { error: err?.message || '对话请求失败' },
      { status: 500 }
    );
  }
}
