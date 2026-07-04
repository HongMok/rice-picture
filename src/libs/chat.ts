// AI 对话页后端调用：通义千问（OpenAI 兼容接口），非流式，60 秒超时
const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export const CHAT_MODELS = [
  { key: 'qwen-plus', label: '通义千问 Plus' },
  { key: 'qwen-max', label: '通义千问 Max' },
] as const;

export type ChatModelKey = (typeof CHAT_MODELS)[number]['key'];

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 一个被聊到的孩子档案（用于拼 system prompt 的额外上下文） */
export interface ChatChildContext {
  nickname: string;
  age?: number | null;
  gender?: string | null;
  diagnosis?: string | null;
  severity?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  interests?: string[];
}

const BASE_SYSTEM_PROMPT =
  '你的名字是「小禾AI」。当被问到"你是谁""你叫什么名字""你是什么模型"等身份问题时，一律回答自己叫小禾AI，是面向特需儿童康复师/特教老师的助手；不要提及任何底层模型名称、公司或技术实现。日常回答保持简洁、温和、具体，避免空泛套话。';

function buildChildContextBlock(child: ChatChildContext): string {
  const parts: string[] = [];
  parts.push(`昵称：${child.nickname}`);
  if (child.age != null) parts.push(`年龄：${child.age}`);
  if (child.gender) parts.push(`性别：${child.gender}`);
  if (child.diagnosis) parts.push(`诊断：${child.diagnosis}`);
  if (child.severity) parts.push(`程度：${child.severity}`);
  if (child.strengths && child.strengths.length)
    parts.push(`能力侧重：${child.strengths.join('、')}`);
  if (child.weaknesses && child.weaknesses.length)
    parts.push(`偏弱方向：${child.weaknesses.join('、')}`);
  if (child.interests && child.interests.length)
    parts.push(`兴趣：${child.interests.join('、')}`);
  return (
    '\n\n[个案上下文] 老师本次对话正在讨论以下这个孩子。回答请围绕该个案的年龄、诊断和能力，给出可执行的建议；避免泛泛而谈。\n' +
    parts.map((p) => '- ' + p).join('\n')
  );
}

export class ChatTimeoutError extends Error {}

export async function chatComplete(
  messages: ChatMessage[],
  model: ChatModelKey = 'qwen-plus',
  child?: ChatChildContext | null
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  const systemContent = child
    ? BASE_SYSTEM_PROMPT + buildChildContextBlock(child)
    : BASE_SYSTEM_PROMPT;

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `对话请求失败 (HTTP ${res.status})`);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('模型未返回内容');
    return String(content).trim();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ChatTimeoutError('对话请求超时');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
