import { DEFAULT_MASTERY, defaultSkeleton, type LessonPlanSkeleton } from '~/data/lesson-plan-types';

export interface BuiltinTemplate {
  key: string;
  name: string;
  skill: string;
  skeleton: LessonPlanSkeleton;
}

function skeleton(overrides: Partial<LessonPlanSkeleton>): LessonPlanSkeleton {
  return { ...defaultSkeleton(overrides.title || '新教案'), ...overrides };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: 'default-dtt',
    name: '默认 DTT 教案',
    skill: '通用',
    skeleton: skeleton({ title: '默认 DTT 教案' }),
  },
  {
    key: 'pairing',
    name: '配对技能 DTT 模板',
    skill: '配对',
    skeleton: skeleton({
      title: '配对技能 - 不完全相同物品',
      goalHierarchy: {
        lto: {
          description: '独立完成 ≥20 组不完全相同物品/卡片的配对',
          mastery: DEFAULT_MASTERY,
          phases: [
            {
              id: 'phase-pairing-1',
              order: 1,
              label: '3D&3D 不完全相同物品配对',
              stos: [
                {
                  id: 'sto-pairing-1',
                  description: '将目标物与刺激卡中相同类别的物品配对',
                  status: 'not-started',
                },
              ],
            },
          ],
        },
      },
      teachingSetup: {
        materials: '碗（铁碗、塑料碗、瓷碗、橡胶碗），每范例至少 4 个',
        scenario: '机构',
        scenarioOptions: ['机构', '居家'],
        strategy: '提示层级：肢体→手势→口语；纠错方式：无关注重做',
        reinforcement: { reinforcer: '小饼干 / 贴纸', ratio: 'VR2', useToken: false },
      },
      abcProcedure: {
        antecedent: { presentation: '呈现目标物 + 1 个干扰物', instruction: '"放一起"' },
        behavior: { correct: '将目标物放入正确类别', incorrect: '放错或超时无反应', responseWindowSec: 3 },
        consequence: {
          onCorrect: '表扬 + 强化物',
          onIncorrect: '肢体辅助纠正',
          noFeedbackAfterCorrection: true,
          noFeedbackText: '纠正后不给反馈或强化物',
        },
      },
    }),
  },
  {
    key: 'imitation',
    name: '模仿技能 DTT 模板',
    skill: '模仿',
    skeleton: skeleton({
      title: '模仿技能 - 粗大动作模仿',
      goalHierarchy: {
        lto: {
          description: '独立模仿 ≥10 个粗大动作指令',
          mastery: DEFAULT_MASTERY,
          phases: [
            {
              id: 'phase-imitation-1',
              order: 1,
              label: '单步粗大动作模仿',
              stos: [
                {
                  id: 'sto-imitation-1',
                  description: '看到老师做动作后，3 秒内模仿同一动作',
                  status: 'not-started',
                },
              ],
            },
          ],
        },
      },
      teachingSetup: {
        materials: '动作示范卡（拍手、拍腿、举手、点头），每范例至少 4 个',
        scenario: '机构',
        scenarioOptions: ['机构', '居家'],
        strategy: '提示层级：肢体→部分肢体→手势；纠错方式：重复示范',
        reinforcement: { reinforcer: '击掌 + 口头表扬', ratio: '1:1', useToken: false },
      },
      abcProcedure: {
        antecedent: { presentation: '老师做出目标动作', instruction: '"做这个"' },
        behavior: { correct: '3 秒内做出相同动作', incorrect: '动作不同或超时无反应', responseWindowSec: 3 },
        consequence: {
          onCorrect: '表扬 + 强化物',
          onIncorrect: '肢体辅助重做一次',
          noFeedbackAfterCorrection: true,
          noFeedbackText: '纠正后不给反馈或强化物',
        },
      },
    }),
  },
  {
    key: 'naming',
    name: '命名技能 DTT 模板',
    skill: '命名',
    skeleton: skeleton({
      title: '命名技能 - 常见物品命名',
      goalHierarchy: {
        lto: {
          description: '独立命名 ≥20 个常见物品',
          mastery: DEFAULT_MASTERY,
          phases: [
            {
              id: 'phase-naming-1',
              order: 1,
              label: '高频生活物品命名',
              stos: [
                {
                  id: 'sto-naming-1',
                  description: '看到实物/图片后，3 秒内说出正确名称',
                  status: 'not-started',
                },
              ],
            },
          ],
        },
      },
      teachingSetup: {
        materials: '常见物品图卡（苹果、杯子、鞋子、球），每范例至少 4 个',
        scenario: '机构',
        scenarioOptions: ['机构', '居家'],
        strategy: '提示层级：口语全提示→口语部分提示→无提示；纠错方式：示范后重做',
        reinforcement: { reinforcer: '代币 + 表扬', ratio: '1:1', useToken: true },
      },
      abcProcedure: {
        antecedent: { presentation: '呈现物品图卡', instruction: '"这是什么？"' },
        behavior: { correct: '3 秒内说出正确名称', incorrect: '说错或超时无反应', responseWindowSec: 3 },
        consequence: {
          onCorrect: '表扬 + 代币',
          onIncorrect: '口语示范后重做一次',
          noFeedbackAfterCorrection: true,
          noFeedbackText: '纠正后不给反馈或强化物',
        },
      },
    }),
  },
];

export function builtinByKey(key: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.key === key);
}
