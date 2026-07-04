import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  appendPracticeMessage,
  getPracticeSession,
  getScenario,
} from '~/libs/training';
import { qwenChat } from '~/libs/qwen';
import type { QwenChatMessage } from '~/libs/qwen';

export const dynamic = 'force-dynamic';

/** 获取一次练习会话（含消息） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  const session = await getPracticeSession(user.id, id);
  if (!session) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  const scenario = await getScenario(session.scenario_id);
  return NextResponse.json({ session, scenario });
}

/** 发送一条用户消息，AI 以场景角色身份回复 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const sessionId = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const text = String(body.content || '').trim();
  if (!text) return NextResponse.json({ error: '消息不能为空' }, { status: 400 });

  const session = await getPracticeSession(user.id, sessionId);
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  if (session.status === 'completed') {
    return NextResponse.json({ error: '会话已结束' }, { status: 400 });
  }
  const scenario = await getScenario(session.scenario_id);
  if (!scenario) return NextResponse.json({ error: '场景已被删除' }, { status: 404 });

  // 先把用户消息落库
  const now = Date.now();
  await appendPracticeMessage(user.id, sessionId, {
    role: 'user',
    content: text,
    ts: now,
  });

  // 构造 system prompt：让 AI 沉浸扮演角色
  const persona = scenario.role_persona;
  const systemLines = [
    '你正在参与一次康复师的岗位训练——角色扮演对话。',
    `你要扮演的角色是：${persona?.who || '训练对象'}。`,
    persona?.background && `角色背景：${persona.background}`,
    persona?.tone && `说话语气：${persona.tone}`,
    '重要：不要跳出角色！不要提示自己是 AI、不要用第三人称叙述、不要给康复师"标准答案"。',
    '每次只回复 1-3 句话，像真人对话一样自然。可以带情绪、可以追问、可以有反对意见。',
    '当康复师的回答已经足够好或者对话进行到自然收尾时，你可以主动说"（对话到这里）"作为结束。',
  ].filter(Boolean);

  const history: QwenChatMessage[] = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  history.push({ role: 'user', content: text });

  const messages: QwenChatMessage[] = [
    { role: 'system', content: systemLines.join('\n') },
    ...history,
  ];

  let aiText = '';
  try {
    aiText = await qwenChat(messages, { model: 'qwen-plus', temperature: 0.8 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'AI 回复失败' }, { status: 500 });
  }

  const reply = aiText.trim();
  await appendPracticeMessage(user.id, sessionId, {
    role: 'assistant',
    content: reply,
    ts: Date.now(),
  });

  return NextResponse.json({ reply });
}
