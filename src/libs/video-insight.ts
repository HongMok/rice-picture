// AI 洞察对话 —— 针对已生成的课堂视频分析报告做追问，不重新看视频（仿 src/libs/qwen.ts 的纯文本调用）
import type { Child } from '~/libs/children';
import type { VideoReport } from '~/data/video-types';
import { childProfile } from '~/libs/video-analyze';

const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen-plus';

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

/** 提取可能被包裹在 ```json ``` 里的 JSON（同 qwen.ts / video-analyze.ts） */
function extractJson(content: string): any {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

export interface InsightTurn {
  role: 'user' | 'ai';
  text: string;
}

export interface InsightResult {
  answer: string;
  followups: string[];
}

const SYSTEM_PROMPT = [
  '你是一位资深的特需儿童康复教研专家，正在和家长/康复老师讨论一份已生成的课堂视频分析报告。',
  '你只依据下面提供的这份报告 JSON 和孩子个案信息来回答，不要编造报告之外没有的画面细节；',
  '如果用户问的内容报告里没有覆盖，就诚实说明报告未记录、无法判断，并给出基于已有信息的合理建议。',
  '回答要专业但通俗易懂，面向家长/一线康复老师，语言简洁，不说空话，尽量具体可执行。',
  '每次回答后，再给出 2 个衔接上下文、层层深入的追问方向（followups），引导用户继续探讨这份报告。',
  '严格输出 JSON，不要输出任何多余文字或 markdown 代码块：',
  '{"answer":"你的回答（可以分点，但用纯文本，不要markdown符号）","followups":["追问1","追问2"]}',
].join('\n');

export async function askInsight(
  report: VideoReport,
  child: Child | null,
  history: InsightTurn[],
  question: string
): Promise<InsightResult> {
  const context = [
    `【报告】${JSON.stringify(report)}`,
    `【孩子个案】${childProfile(child)}`,
  ].join('\n\n');

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: context },
    ...history.map((h) => ({
      role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text,
    })),
    { role: 'user', content: question },
  ];

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `AI 洞察请求失败 (HTTP ${res.status})`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型未返回内容');

  let parsed: any;
  try {
    parsed = extractJson(content);
  } catch {
    throw new Error('模型返回的不是有效 JSON');
  }

  const answer = String(parsed?.answer || '').trim();
  const followups = Array.isArray(parsed?.followups)
    ? parsed.followups.map((f: any) => String(f).trim()).filter(Boolean).slice(0, 2)
    : [];

  if (!answer) throw new Error('模型未产出有效回答');
  return { answer, followups };
}
