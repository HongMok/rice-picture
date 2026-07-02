// 阿里百炼 通义千问（OpenAI 兼容接口）—— 写故事并拆页
const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen-plus';

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

export interface StoryOptions {
  ageGroup?: string; // 读者年龄
  genre?: string; // 故事类型
  theme?: string; // 故事主题
  character?: string; // 角色
  perspective?: string; // 叙事视角
  pageCount: number; // 页数
}

export interface StoryPage {
  scene: string; // 画面描述（英文/中文均可，喂给生图）
  text: string; // 该页故事正文（中文，面向孩子）
}

export interface Story {
  title: string;
  pages: StoryPage[];
}

function buildMessages(brief: string, opts: StoryOptions) {
  const system = [
    '你是一位擅长为特需儿童（如自闭症谱系、发育迟缓儿童）创作绘本的专业作者。',
    '你的故事语言简单、具体、正面、可预期，句子短，避免比喻和抽象概念，适合作为社交故事或行为引导。',
    '你必须严格输出 JSON，不要输出任何多余文字或 markdown 代码块。',
  ].join('');

  const constraints = [
    `请把用户的故事想法扩写成一个完整的绘本，正好 ${opts.pageCount} 页（每页一幅画）。`,
    opts.ageGroup && `读者年龄：${opts.ageGroup}。`,
    opts.genre && `故事类型：${opts.genre}。`,
    opts.theme && `核心主题：${opts.theme}。`,
    opts.character && `主要角色设定：${opts.character}。`,
    opts.perspective && `叙事视角：${opts.perspective}。`,
    '每页包含两个字段：',
    '- text：该页故事正文，1~2 句简短中文，面向孩子朗读；',
    '- scene：该页对应的画面描述，用于 AI 绘画，描述清楚人物、动作、场景、情绪，画面里不要出现任何文字。',
    '全书角色形象、画风要保持一致（在每个 scene 里重复描述主角的外貌特征以保持一致性）。',
    '输出 JSON 结构：{"title": "绘本标题", "pages": [{"text": "...", "scene": "..."}, ...]}。',
    `pages 数组长度必须正好是 ${opts.pageCount}。`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: `故事想法：${brief}\n\n${constraints}` },
  ];
}

/** 提取可能被包裹在 ```json ``` 里的 JSON */
function extractJson(content: string): any {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

export async function writeStory(
  brief: string,
  opts: StoryOptions
): Promise<Story> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(brief, opts),
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `写故事失败 (HTTP ${res.status})`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型未返回内容');

  let parsed: any;
  try {
    parsed = extractJson(content);
  } catch {
    throw new Error('模型返回的不是有效 JSON');
  }

  const pages: StoryPage[] = Array.isArray(parsed.pages)
    ? parsed.pages
        .map((p: any) => ({
          scene: String(p.scene || '').trim(),
          text: String(p.text || '').trim(),
        }))
        .filter((p: StoryPage) => p.scene || p.text)
    : [];

  if (pages.length === 0) throw new Error('模型未生成有效页面');

  return {
    title: String(parsed.title || brief).trim().slice(0, 60),
    pages: pages.slice(0, opts.pageCount),
  };
}
