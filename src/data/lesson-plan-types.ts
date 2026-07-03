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

export interface TeachingSetup {
  materials: string; // 提示："每范例至少 4 个"
  scenario: string; // 默认含 "机构"/"居家"
  scenarioOptions: string[];
  strategy: string;
  reinforcement: ReinforcementPlan;
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
}

export interface GoalChecklistItem {
  id: string;
  name: string;
  stoId?: string;
  introducedDate?: string;
  masteredDate?: string;
  imageUrl?: string; // 目标图卡（可选，可由 AI 生成或从图库挑选）
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
      scenario: '机构',
      scenarioOptions: ['机构', '居家'],
      strategy: '',
      reinforcement: { reinforcer: '', ratio: '1:1', useToken: false },
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
    },
    goalChecklist: [],
  };
}
