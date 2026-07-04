// 教案 AI 生成引擎：对话文本 + 结构化参数 → DTT 教案初稿
import {
  DEFAULT_MASTERY,
  defaultSessionFlow,
  genLocalId,
  type LessonPlanSkeleton,
  type SessionFlowStep,
} from '~/data/lesson-plan-types';

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

  const totalMin = input.lessonMinutes || 30;
  const schema = [
    '请严格按以下 JSON 结构输出，语言用白话，具体到老师照着念都能上：',
    '{',
    '  "title": "教案标题（不超过 30 字）",',
    '  "goalDescription": "一句可测量的目标行为，例：孩子在 3 秒内独立将杯子和杯子配对，连续 3 节课 ≥80%",',
    '  "materials": "教学材料，用顿号分隔至少 4 个具体范例，例：铁碗、塑料碗、瓷碗、橡胶碗",',
    '  "strategy": "策略：提示层级 → 纠错方式，白话表达",',
    '  "reinforcer": "强化物描述，具体到给什么",',
    '  "reinforceRatio": "强化比率，如 1:1 或 VR2",',
    `  "sessionFlow": [四段一节课流程，minutes 加起来接近 ${totalMin}]，格式 [{"name":"段名","minutes":数字,"note":"要做什么"}]，四段建议：暖场·建立关注 / 主教·DTT 回合 / 泛化练习 / 结束仪式,`,
    '  "antecedentPresentation": "主教环节 · A 前因：怎么摆刺激物",',
    '  "antecedentInstruction": "A 指令原话，用引号，例：\\"找一样的\\"",',
    '  "behaviorCorrect": "B 正确反应的具体样子",',
    '  "behaviorIncorrect": "B 错误 / 无反应的具体样子",',
    '  "consequenceOnCorrect": "C 正确后：表扬词 + 强化物给法",',
    '  "consequenceOnIncorrect": "C 错误后：纠正程序步骤，用 → 分隔",',
    '  "fallbackOnEmotional": "孩子情绪失控时怎么办（1-2 句）",',
    '  "fallbackOnRefuse": "孩子拒绝配合时怎么办（1-2 句）",',
    '  "fallbackOnTimeout": "多次超时或连错怎么办（1-2 句）",',
    '  "familyDoAtHome": "家长在家可以做的一句建议",',
    '  "familyAvoid": "家长不建议做的一句提醒",',
    '  "goalChecklist": ["具体教学项1", "具体教学项2"]  // 4-8 项，跟 materials 呼应',
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

function mapSessionFlow(parsed: any): SessionFlowStep[] {
  if (!Array.isArray(parsed?.sessionFlow) || parsed.sessionFlow.length === 0) {
    return defaultSessionFlow();
  }
  return parsed.sessionFlow.slice(0, 8).map((s: any) => ({
    id: genLocalId('flow'),
    name: String(s?.name || '').trim() || '流程段',
    minutes: Number(s?.minutes) || 5,
    note: String(s?.note || '').trim(),
  }));
}

function mapToSkeleton(parsed: any, input: GenerateInput): LessonPlanSkeleton {
  const title = String(parsed.title || input.targetSkill || '新教案').trim().slice(0, 60);
  // 目标描述：新框架统一为 goalDescription；兼容老字段 ltoDescription/stoDescription
  const goalDesc = String(
    parsed.goalDescription || parsed.stoDescription || parsed.ltoDescription || ''
  ).trim();
  const ownedAids = (input.ownedAids || []).slice(0, 20);

  return {
    type: 'ABA-DTT',
    title,
    duration: {
      lessonMinutes: input.lessonMinutes || 30,
      trialWindowSec: 3,
    },
    goalHierarchy: {
      lto: {
        description: goalDesc,
        mastery: DEFAULT_MASTERY,
        phases: [
          {
            id: genLocalId('phase'),
            order: 1,
            label: input.phaseLabel?.trim() || '当前目标',
            stos: [
              {
                id: genLocalId('sto'),
                description: goalDesc,
                status: 'not-started',
              },
            ],
          },
        ],
      },
    },
    teachingSetup: {
      materials: String(parsed.materials || '').trim(),
      aids: ownedAids,
      scenario: '机构',
      scenarioOptions: ['机构', '居家', '学校', '户外'],
      strategy: String(parsed.strategy || '').trim(),
      reinforcement: {
        reinforcer: String(parsed.reinforcer || '').trim(),
        ratio: String(parsed.reinforceRatio || '1:1').trim(),
        useToken: false,
      },
      sessionFlow: mapSessionFlow(parsed),
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
      fallback: {
        onEmotional: String(parsed.fallbackOnEmotional || '').trim(),
        onRefuse: String(parsed.fallbackOnRefuse || '').trim(),
        onTimeout: String(parsed.fallbackOnTimeout || '').trim(),
      },
      familyExtension: {
        doAtHome: String(parsed.familyDoAtHome || '').trim(),
        avoid: String(parsed.familyAvoid || '').trim(),
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
