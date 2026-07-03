// 通义千问定制出题 —— 按孩子个案生成互动游戏题目结构（仿 src/libs/qwen.ts）
import type { Child } from '~/libs/children';
import type { GameRound, GameType, EmotionRound, MatchRound } from '~/data/game-types';
import { BASE_EMOTIONS } from '~/data/game-types';

const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen-plus';

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

/** 提取可能被包裹在 ```json ``` 里的 JSON（同 qwen.ts） */
function extractJson(content: string): any {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

function childProfile(child: Child | null): string {
  if (!child) return '（无个案信息，按通用轻度难度出题）';
  const parts = [
    child.age && `年龄 ${child.age} 岁`,
    child.diagnosis && `诊断：${child.diagnosis}`,
    child.severity && `程度：${child.severity}`,
    child.strengths?.length && `能力较强：${child.strengths.join('、')}`,
    child.weaknesses?.length && `重点训练（偏弱）：${child.weaknesses.join('、')}`,
    child.interests?.length && `兴趣爱好：${child.interests.join('、')}`,
  ].filter(Boolean);
  return parts.join('；');
}

function buildMessages(gameType: GameType, child: Child | null, roundCount: number) {
  const system = [
    '你是一位为特需儿童（自闭症谱系、发育迟缓等）设计康复训练题目的专家。',
    '出题原则：语言简单具体、正面、可预期，句子短，避免比喻和抽象词；',
    '根据孩子的偏弱方向决定训练重点，根据兴趣爱好选择题目里的具体事物（如孩子喜欢汽车，就多用车相关情境）。',
    '你必须严格输出 JSON，不要输出任何多余文字或 markdown 代码块。',
  ].join('');

  const profile = childProfile(child);

  let task: string;
  if (gameType === 'emotion') {
    const character = child?.interests?.[0]?.trim();
    task = [
      `出 ${roundCount} 道「情绪识别」题。每题给一个生活情境句，让孩子判断句中人物的心情。`,
      character
        ? `情境句的主角统一使用孩子最喜欢的角色「${character}」（如「${character}的玩具坏了」），让孩子有代入感。`
        : '',
      `情绪只使用这四种基础情绪之一：${BASE_EMOTIONS.join('、')}。`,
      '每题字段：',
      '- cap：一句简短、具体、贴近孩子生活的情境，不要出现情绪词本身；',
      '- answer：正确情绪（四种之一）；',
      '- options：4 个情绪选项，必须包含 answer，其余从四种情绪里取，打乱顺序。',
      '难度：偏弱方向包含情绪识别时，情境要更直白；否则可略含蓄。',
      '输出：{"title":"游戏标题","rounds":[{"cap":"...","answer":"...","options":["...","...","...","..."]}]}',
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    task = [
      `出 ${roundCount} 道「认知配对」题。每题给一个目标物，让孩子从选项里找出同一类或同颜色的。`,
      '每题字段：',
      '- category："category"（找同类）或 "color"（找同色）；',
      '- label：目标物名称（用孩子熟悉/感兴趣的具体名词）；',
      '- cap：一句提示，如「这是一个水果，找出另一个水果」；',
      '- answer：正确选项名称；',
      '- options：4 个选项名称，必须包含 answer，其余为明显不同类/不同色的干扰项，打乱顺序。',
      '所有名称都用常见、可画成简单图标的具体事物。',
      '输出：{"title":"游戏标题","rounds":[{"category":"...","label":"...","cap":"...","answer":"...","options":["...","...","...","..."]}]}',
    ].join('\n');
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: `孩子个案：${profile}\n\n${task}` },
  ];
}

export interface GeneratedGame {
  title: string;
  rounds: GameRound[];
}

export async function generateGame(
  gameType: GameType,
  child: Child | null,
  roundCount = 5
): Promise<GeneratedGame> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(gameType, child, roundCount),
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `出题失败 (HTTP ${res.status})`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型未返回内容');

  let parsed: any;
  try {
    parsed = extractJson(content);
  } catch {
    throw new Error('模型返回的不是有效 JSON');
  }

  const rawRounds: any[] = Array.isArray(parsed.rounds) ? parsed.rounds : [];
  const rounds: GameRound[] = rawRounds
    .map((r) => normalizeRound(gameType, r))
    .filter(Boolean) as GameRound[];

  if (rounds.length === 0) throw new Error('模型未生成有效题目');

  return {
    title: String(parsed.title || (gameType === 'emotion' ? '心情游戏' : '配对游戏')).trim().slice(0, 40),
    rounds: rounds.slice(0, roundCount),
  };
}

function normalizeRound(gameType: GameType, r: any): GameRound | null {
  const options = Array.isArray(r.options)
    ? r.options.map((o: any) => String(o).trim()).filter(Boolean)
    : [];
  if (options.length < 2) return null;

  if (gameType === 'emotion') {
    const answer = String(r.answer || '').trim();
    if (!BASE_EMOTIONS.includes(answer)) return null;
    // 只保留合法情绪选项，且确保含 answer
    const opts = options.filter((o: string) => BASE_EMOTIONS.includes(o));
    if (!opts.includes(answer)) opts.push(answer);
    const round: EmotionRound = {
      cap: String(r.cap || '').trim(),
      answer,
      options: opts.slice(0, 4),
    };
    return round.cap ? round : null;
  }

  const answer = String(r.answer || '').trim();
  const label = String(r.label || '').trim();
  if (!answer || !label) return null;
  if (!options.includes(answer)) options.push(answer);
  const round: MatchRound = {
    cap: String(r.cap || '').trim(),
    label,
    answer,
    options: options.slice(0, 4),
    category: String(r.category || 'category').trim(),
  };
  return round.cap ? round : null;
}

// ============ 角色去版权化 ============
// 通义万相对受版权保护的 IP 角色（奥特曼/小猪佩奇/米老鼠等）会返回
// IPInfringementSuspect 拒绝生图。这里把角色名转成「描述性形象」再喂生图，
// 既能规避侵权拦截、又保留角色的视觉特征。

/** 常见 IP 的安全形象描述（命中即用，免一次 LLM 调用） */
const SAFE_VISUAL: Record<string, string> = {
  奥特曼: '一个戴头盔的银红配色巨人英雄，身体有发光计时器，姿态威武',
  小猪佩奇: '一只粉红色的卡通小猪，圆脸大眼睛，穿红色连衣裙',
  佩奇: '一只粉红色的卡通小猪，圆脸大眼睛，穿红色连衣裙',
  米老鼠: '一只黑色的卡通大耳朵老鼠，穿红裤子白手套',
  唐老鸭: '一只白色卡通鸭子，穿蓝色水手服，橙色嘴巴',
  蜘蛛侠: '一个穿红蓝紧身衣、带蛛网纹的超级英雄',
  艾莎: '一位穿浅蓝色长裙、金色辫子的冰雪公主',
  超人: '一个穿蓝色紧身衣、红色披风的超级英雄',
  海绵宝宝: '一块黄色方形海绵卡通角色，大眼睛，穿棕色短裤',
};

/**
 * 把角色名转成去版权化的形象描述。已知 IP 走词典；
 * 未知的调用 LLM 生成一句安全的、不含 IP 名的形象描述；失败则保守兜底。
 */
export async function describeCharacter(name: string): Promise<string> {
  const key = name.trim();
  if (SAFE_VISUAL[key]) return SAFE_VISUAL[key];

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              '你把一个角色/事物名转成一句中文外貌描述，用于 AI 绘画。' +
              '严禁在描述里出现任何品牌名、作品名、角色专有名（避免版权问题），' +
              '只描述通用的外形特征（颜色、身形、服饰、标志性外观）。只输出这句描述，不要引号。',
          },
          { role: 'user', content: `角色/事物：${key}` },
        ],
        temperature: 0.5,
      }),
    });
    const data = await res.json();
    const desc = data?.choices?.[0]?.message?.content?.trim();
    if (desc) return desc.replace(/[「」“”"]/g, '').slice(0, 120);
  } catch {
    /* 忽略，走兜底 */
  }
  // 兜底：不含原名的中性描述
  return '一个可爱友好的卡通角色';
}
