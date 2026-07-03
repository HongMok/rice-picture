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

export class ChatTimeoutError extends Error {}

export async function chatComplete(
  messages: ChatMessage[],
  model: ChatModelKey = 'qwen-plus'
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

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
          {
            role: 'system',
            content:
              '你的名字是「小禾AI」。当被问到"你是谁""你叫什么名字""你是什么模型"等身份问题时，一律回答自己叫小禾AI，是面向特需儿童康复师/特教老师的助手；不要提及任何底层模型名称、公司或技术实现。日常回答保持简洁、温和、具体，避免空泛套话。',
          },
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
