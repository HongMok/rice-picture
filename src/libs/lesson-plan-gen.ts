// 教案 AI 生成引擎：对话文本 + 结构化参数 → DTT 教案初稿（四层结构）
import { DEFAULT_MASTERY, genLocalId, type LessonPlanSkeleton } from '~/data/lesson-plan-types';

const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen-plus';
const TIMEOUT_MS = 60_000;

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

export class GenerationTimeoutError extends Error {}

export interface GenerateInput {
  chatPrompt?: string; // ≤2000 字
  knowledgePoint?: string; // ≤500 字
  hasMaterialAttachment: boolean;
  targetSkill: string;
  phaseLabel?: string;
  ownedAids?: string[]; // ≤20 项
  lessonMinutes?: number; // 5-120
}

function buildMessages(input: GenerateInput) {
  const system = [
    '你是一位特需儿童 ABA/DTT（回合式教学）教案设计专家。',
    '你要根据老师提供的信息生成一份结构化 DTT 教案初稿，语言简单、具体、可操作。',
    '你必须严格输出 JSON，不要输出任何多余文字或 markdown 代码块。',
  ].join('');

  const lines = [
    `目标能力：${input.targetSkill}`,
    input.phaseLabel && `阶段：${input.phaseLabel}`,
    input.ownedAids?.length && `持有教具：${input.ownedAids.join('、')}`,
    input.lessonMinutes && `预计单节课时长：${input.lessonMinutes} 分钟`,
    input.knowledgePoint && `指定知识点：${input.knowledgePoint}`,
    input.chatPrompt && `老师描述的需求：${input.chatPrompt}`,
    input.hasMaterialAttachment && '老师上传了教材附件作为参考依据。',
  ].filter(Boolean);

  const schema = [
    '输出 JSON 结构：',
    '{',
    '  "title": "教案标题",',
    '  "ltoDescription": "长期目标终点行为描述",',
    '  "phaseLabel": "阶段名称，如 3D&3D 不完全相同物品配对",',
    '  "stoDescription": "当前短期目标：可测量的具体行为描述",',
    '  "materials": "教学教材描述，至少 4 个范例",',
    '  "strategy": "教学策略：提示层级 + 纠错方式",',
    '  "reinforcer": "强化物描述",',
    '  "reinforceRatio": "强化比率，如 1:1 或 VR2",',
    '  "antecedentPresentation": "A前因：如何呈现刺激",',
    '  "antecedentInstruction": "A前因：指令文本",',
    '  "behaviorCorrect": "B行为：正确反应描述",',
    '  "behaviorIncorrect": "B行为：错误/无反应描述",',
    '  "consequenceOnCorrect": "C后果：正确后的表扬与强化",',
    '  "consequenceOnIncorrect": "C后果：错误后的纠正程序",',
    '  "goalChecklist": ["目标清单项1", "目标清单项2"]',
    '}',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: `${lines.join('\n')}\n\n${schema}` },
  ];
}

function extractJson(content: string): any {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

export async function generateLessonPlan(input: GenerateInput): Promise<LessonPlanSkeleton> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let data: any;
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(input),
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `生成失败 (HTTP ${res.status})`);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new GenerationTimeoutError('教案生成超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型未返回内容');

  let parsed: any;
  try {
    parsed = extractJson(content);
  } catch {
    throw new Error('模型返回的不是有效 JSON');
  }

  return mapToSkeleton(parsed, input);
}

function mapToSkeleton(parsed: any, input: GenerateInput): LessonPlanSkeleton {
  const title = String(parsed.title || input.targetSkill || '新教案').trim().slice(0, 60);

  return {
    type: 'ABA-DTT',
    title,
    duration: {
      lessonMinutes: input.lessonMinutes || 30,
      trialWindowSec: 3,
    },
    goalHierarchy: {
      lto: {
        description: String(parsed.ltoDescription || '').trim(),
        mastery: DEFAULT_MASTERY,
        phases: [
          {
            id: genLocalId('phase'),
            order: 1,
            label: String(parsed.phaseLabel || input.phaseLabel || '阶段 1').trim(),
            stos: [
              {
                id: genLocalId('sto'),
                description: String(parsed.stoDescription || '').trim(),
                status: 'not-started',
              },
            ],
          },
        ],
      },
    },
    teachingSetup: {
      materials: String(parsed.materials || '').trim(),
      scenario: '机构',
      scenarioOptions: ['机构', '居家'],
      strategy: String(parsed.strategy || '').trim(),
      reinforcement: {
        reinforcer: String(parsed.reinforcer || '').trim(),
        ratio: String(parsed.reinforceRatio || '1:1').trim(),
        useToken: false,
      },
    },
    abcProcedure: {
      antecedent: {
        presentation: String(parsed.antecedentPresentation || '').trim(),
        instruction: String(parsed.antecedentInstruction || '').trim(),
      },
      behavior: {
        correct: String(parsed.behaviorCorrect || '').trim(),
        incorrect: String(parsed.behaviorIncorrect || '').trim(),
        responseWindowSec: 3,
      },
      consequence: {
        onCorrect: String(parsed.consequenceOnCorrect || '').trim(),
        onIncorrect: String(parsed.consequenceOnIncorrect || '').trim(),
        noFeedbackAfterCorrection: true,
        noFeedbackText: '纠正后不给反馈或强化物',
      },
    },
    goalChecklist: Array.isArray(parsed.goalChecklist)
      ? parsed.goalChecklist.slice(0, 20).map((name: any) => ({
          id: genLocalId('goal'),
          name: String(name).trim(),
        }))
      : [],
  };
}
