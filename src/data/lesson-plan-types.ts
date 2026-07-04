// 教案（ABA/DTT）四层结构类型定义，对应 sql/init.sql 的 lesson_plans 表分列存储

export interface MasteryThreshold {
  minAccuracy: number; // 0-100
  sessions: number;
}

export interface MasteryCriteria {
  raw: string; // 展示用原文，如 "80%×3, 90%×2"
  thresholds: MasteryThreshold[];
  requireConsecutive: boolean;
}

export const DEFAULT_MASTERY: MasteryCriteria = {
  raw: '80%×3, 90%×2',
  thresholds: [
    { minAccuracy: 80, sessions: 3 },
    { minAccuracy: 90, sessions: 2 },
  ],
  requireConsecutive: true,
};

export type STOStatus = 'not-started' | 'in-progress' | 'mastered';

export interface ShortTermObjective {
  id: string;
  description: string; // 必填：可测量行为
  startDate?: string;
  passDate?: string;
  status: STOStatus;
}

export interface Phase {
  id: string;
  order: number;
  label: string;
  startDate?: string;
  passDate?: string;
  stos: ShortTermObjective[];
}

export interface LongTermObjective {
  description: string; // 终点行为
  mastery: MasteryCriteria;
  phases: Phase[];
}

export interface GoalHierarchy {
  lto: LongTermObjective;
}

export interface ReinforcementPlan {
  reinforcer: string;
  ratio: string;
  useToken: boolean;
}

export interface SessionFlowStep {
  id: string;
  name: string; // 时段名："暖场 / 建立关注"
  minutes: number; // 建议时长
  note: string; // 要做什么（自由文本）
}

export interface TeachingSetup {
  materials: string; // 教学材料（举例的物品，如"铁碗、塑料碗..."）
  aids?: string[]; // 手头教具（chip 列表，跟 materials 分开）
  scenario: string; // 默认含 "机构"/"居家"
  scenarioOptions: string[];
  strategy: string;
  reinforcement: ReinforcementPlan;
  sessionFlow?: SessionFlowStep[]; // 一节课的流程时间轴
}

export interface FallbackPlan {
  onEmotional: string; // 孩子情绪失控怎么办
  onRefuse: string; // 拒绝配合怎么办
  onTimeout: string; // 超时/连错怎么办
}

export interface FamilyExtension {
  doAtHome: string; // 家长在家可以做什么
  avoid: string; // 不建议做的事
}

export interface ABCProcedure {
  antecedent: {
    presentation: string;
    instruction: string;
  };
  behavior: {
    correct: string;
    incorrect: string;
    responseWindowSec: number; // 默认 3
  };
  consequence: {
    onCorrect: string;
    onIncorrect: string;
    noFeedbackAfterCorrection: boolean;
    noFeedbackText: string; // "纠正后不给反馈或强化物"，可编辑
  };
  fallback?: FallbackPlan; // 预案（新增）
  familyExtension?: FamilyExtension; // 家庭延伸（新增）
}

export interface GoalChecklistItem {
  id: string;
  name: string;
  stoId?: string;
  introducedDate?: string;
  masteredDate?: string;
  imageUrl?: string; // 目标图卡（可选，可由 AI 生成或从图库挑选）
  imageTaskId?: string; // 生图任务进行中标记（SUCCEEDED/FAILED 后由后端清除）
}

export interface LessonPlanSource {
  kind: 'textbook' | 'upload' | 'manual' | 'knowledge-point';
  ref: string;
  chapter?: string;
}

export interface LessonPlanDuration {
  lessonMinutes?: number; // 5-120
  trialWindowSec?: number;
}

export interface LessonPlan {
  id: number;
  type: string; // 'ABA-DTT'
  title: string;
  source: LessonPlanSource | null;
  duration: LessonPlanDuration | null;
  goalHierarchy: GoalHierarchy;
  teachingSetup: TeachingSetup;
  abcProcedure: ABCProcedure;
  goalChecklist: GoalChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export type LessonPlanSkeleton = Omit<
  LessonPlan,
  'id' | 'createdAt' | 'updatedAt' | 'source'
>;

let idSeq = 0;
export function genLocalId(prefix: string): string {
  idSeq += 1;
  return `${prefix}${Date.now()}${idSeq}`;
}

export function emptySTO(): ShortTermObjective {
  return {
    id: genLocalId('sto'),
    description: '',
    status: 'not-started',
  };
}

export function emptyPhase(order: number): Phase {
  return {
    id: genLocalId('phase'),
    order,
    label: `阶段 ${order}`,
    stos: [emptySTO()],
  };
}

export function defaultSessionFlow(): SessionFlowStep[] {
  return [
    { id: genLocalId('flow'), name: '暖场 · 建立关注', minutes: 3, note: '' },
    { id: genLocalId('flow'), name: '主教 · DTT 回合', minutes: 20, note: '' },
    { id: genLocalId('flow'), name: '泛化练习', minutes: 5, note: '' },
    { id: genLocalId('flow'), name: '结束仪式', minutes: 2, note: '' },
  ];
}

export function defaultSkeleton(title: string): LessonPlanSkeleton {
  return {
    type: 'ABA-DTT',
    title,
    duration: { lessonMinutes: 30, trialWindowSec: 3 },
    goalHierarchy: {
      lto: {
        description: '',
        mastery: DEFAULT_MASTERY,
        phases: [emptyPhase(1)],
      },
    },
    teachingSetup: {
      materials: '',
      aids: [],
      scenario: '机构',
      scenarioOptions: ['机构', '居家', '学校', '户外'],
      strategy: '',
      reinforcement: { reinforcer: '', ratio: '1:1', useToken: false },
      sessionFlow: defaultSessionFlow(),
    },
    abcProcedure: {
      antecedent: { presentation: '', instruction: '' },
      behavior: { correct: '', incorrect: '', responseWindowSec: 3 },
      consequence: {
        onCorrect: '',
        onIncorrect: '',
        noFeedbackAfterCorrection: true,
        noFeedbackText: '纠正后不给反馈或强化物',
      },
      fallback: { onEmotional: '', onRefuse: '', onTimeout: '' },
      familyExtension: { doAtHome: '', avoid: '' },
    },
    goalChecklist: [],
  };
}
