// 培训测评（模块五）· 五维评测框架
// 依据 resources/class/评测系统内容参考与维度设计.md

// ============ 维度 1 · 内容领域 D1-D12 ============

export type Domain =
  | 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6'
  | 'D7' | 'D8' | 'D9' | 'D10' | 'D11' | 'D12';

export interface DomainDef {
  key: Domain;
  name: string;         // 全称，如 "ABA 基础理论"
  short: string;        // 短名，如 "ABA"
  weight: 'high' | 'mid' | 'low';   // 题量权重
}

export const DOMAINS: DomainDef[] = [
  { key: 'D1',  name: '循证实践（EBP）',           short: '循证',      weight: 'mid'  },
  { key: 'D2',  name: 'ABA 基础理论',              short: 'ABA',       weight: 'high' },
  { key: 'D3',  name: '强化与惩罚',                short: '强化惩罚',  weight: 'high' },
  { key: 'D4',  name: '增强物与动机管理',          short: '增强物',    weight: 'high' },
  { key: 'D5',  name: 'DTT 回合式教学',            short: 'DTT',       weight: 'high' },
  { key: 'D6',  name: '提示与提示褪除',            short: '提示',      weight: 'high' },
  { key: 'D7',  name: 'NDBI 自然发展行为干预',      short: 'NDBI',      weight: 'mid'  },
  { key: 'D8',  name: '关系建立与教学控制',        short: '关系建立',  weight: 'mid'  },
  { key: 'D9',  name: '语言行为与技能教学',        short: '语言行为',  weight: 'mid'  },
  { key: 'D10', name: '感觉统合与 OT',             short: '感统OT',    weight: 'mid'  },
  { key: 'D11', name: '儿童发展与常见疾病',        short: '儿童发展',  weight: 'low'  },
  { key: 'D12', name: '职业素养与软技能',          short: '职业素养',  weight: 'mid'  },
];

export function domainName(key: string): string {
  return DOMAINS.find((d) => d.key === key)?.name || key;
}
export function domainShort(key: string): string {
  return DOMAINS.find((d) => d.key === key)?.short || key;
}

// ============ 维度 2 · 认知层级 L1-L5（布鲁姆改良）============

export type CognitiveLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface LevelDef {
  key: CognitiveLevel;
  name: string;    // "记忆" "理解" "应用" "分析" "评价"
  hint: string;
  target: number;  // 目标占比（组卷参考）
}

export const COGNITIVE_LEVELS: LevelDef[] = [
  { key: 'L1', name: '记忆', hint: '术语、定义、代码',     target: 0.15 },
  { key: 'L2', name: '理解', hint: '概念区分、原理',       target: 0.25 },
  { key: 'L3', name: '应用', hint: '情境中选方法/判断',    target: 0.30 },
  { key: 'L4', name: '分析', hint: '案例拆解、诊断错误',   target: 0.20 },
  { key: 'L5', name: '评价', hint: '方案优劣、伦理判断',   target: 0.10 },
];

export function levelName(key: string): string {
  return COGNITIVE_LEVELS.find((l) => l.key === key)?.name || key;
}

// ============ 维度 3 · 题型 ============

export type QuestionType = 'single' | 'multi' | 'judge' | 'order' | 'case';

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: '单选',
  multi: '多选',
  judge: '判断',
  order: '排序',
  case: '案例',
};

// ============ 维度 4 · 岗位能力 C1-C6（能力画像雷达）============

export type Competency = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';

export interface CompetencyDef {
  key: Competency;
  name: string;
  hint: string;
  is_critical?: boolean;    // C4 伦理是关键项
}

export const COMPETENCIES: CompetencyDef[] = [
  { key: 'C1', name: '理论知识',       hint: '概念与原理，D1-D3、D7' },
  { key: 'C2', name: '实操技能',       hint: '教学执行，D4-D6、D9、D10' },
  { key: 'C3', name: '临床决策',       hint: '选方法、调整策略，跨领域' },
  { key: 'C4', name: '职业伦理',       hint: 'D12、D5(数据)。关键项', is_critical: true },
  { key: 'C5', name: '沟通协作',       hint: '家长沟通/反馈/家校一致，D12' },
  { key: 'C6', name: '数据记录与分析', hint: '记录规范与真实性，D5、D2' },
];

export function competencyName(key: string): string {
  return COMPETENCIES.find((c) => c.key === key)?.name || key;
}

// ============ 维度 5 · 难度 / 岗位阶段 ============

export type DifficultyStage = 'entry' | 'advanced' | 'expert';

export const DIFFICULTY_LABEL: Record<DifficultyStage, string> = {
  entry: '入职',
  advanced: '进阶',
  expert: '熟练',
};

// 兼容旧的 easy/medium/hard 命名（不再使用，但库里可能残留）
export type Difficulty = DifficultyStage | 'easy' | 'medium' | 'hard';

// ============ 知识点条目（出题依据）============

export interface KnowledgeItem {
  id: number;
  code: string;                    // "KI-05"
  domain: Domain;
  title: string;
  summary: string;
  key_points: string[];
  common_mistakes: string[];       // 易错点（干扰项来源）
  question_angles: string[];       // 可命题角度
  source_videos: string[];         // 相关培训视频
  sort: number;
}

// ============ 课程 ============

export interface CourseOutlineItem {
  title: string;
  start_sec?: number;
  summary: string;
  key_points: string[];
  domain?: Domain;                 // 该章节挂哪个领域
  knowledge_item_codes?: string[];
  illust_url?: string;
}

export interface CourseTranscriptSegment {
  text: string;
  begin_time: number;
  end_time: number;
  sentence_id?: number;
}

export interface TrainingCourse {
  id: number;
  title: string;
  category: Domain;                // 用 D1-D12
  duration_min: number | null;
  cover_url: string | null;
  video_url: string | null;
  raw_transcript: string | null;
  raw_segments: CourseTranscriptSegment[] | null;
  outline: CourseOutlineItem[] | null;
  key_takeaways: string[] | null;
  source_ref: string | null;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface CourseListItem {
  id: number;
  title: string;
  category: Domain;
  duration_min: number | null;
  cover_url: string | null;
  section_count: number;
  progress_pct?: number;
  completed?: boolean;
}

// ============ 题库 ============

export interface QuestionOption {
  key: string;
  text: string;
  is_correct: boolean;
  explain?: string;
}

export interface TrainingQuestion {
  id: number;
  related_course_id: number | null;
  category: Domain;                        // 领域
  cognitive_level: CognitiveLevel | null;  // L1-L5
  competencies: Competency[];              // 命中的岗位能力
  difficulty: DifficultyStage;             // 入职/进阶/熟练
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  knowledge_points: string[];              // 兼容老字段：标签
  knowledge_item_codes: string[];          // 命中的知识点条目 code
  is_key_item: boolean;                    // 关键项/一票否决
  source_ref: string | null;
  source_video: string | null;
}

// ============ 测评卷 ============

export interface TrainingQuiz {
  id: number;
  title: string;
  category: Domain | null;
  description: string | null;
  question_ids: number[];
  duration_min: number | null;
  pass_score: number;
  is_builtin: boolean;
  question_count?: number;
}

export interface QuizAnswer {
  question_id: number;
  chosen: string[];
  correct: boolean;
  time_ms?: number;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  user_id: number;
  answers: QuizAnswer[];
  score: number | null;
  duration_sec: number | null;
  submitted_at: string | null;
  created_at: string;
}

// ============ 情景练习 ============

export interface RubricDimension {
  key: string;
  name: string;
  weight: number;
  criteria: string;
}

export interface TrainingScenario {
  id: number;
  title: string;
  category: Domain;
  related_course_id: number | null;
  role_persona: {
    who: string;
    tone: string;
    background: string;
  } | null;
  initial_message: string | null;
  evaluation_rubric: {
    dimensions: RubricDimension[];
  } | null;
  success_criteria: {
    max_rounds?: number;
    must_hit_points?: string[];
  } | null;
  is_builtin: boolean;
}

export interface PracticeMessage {
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

export interface PracticeEvaluation {
  dimensions: Record<string, { score: number; note: string }>;
  overall: number;
  highlights: string[];
  improvements: string[];
}

export interface PracticeSession {
  id: number;
  user_id: number;
  scenario_id: number;
  messages: PracticeMessage[];
  evaluation: PracticeEvaluation | null;
  status: 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ============ 能力画像 ============

/** 岗位能力雷达图（C1-C6 六维） */
export interface CompetencyScore {
  key: Competency;
  name: string;
  score: number;              // 0-100
  question_total: number;     // 该能力下总题数
  question_ok: number;        // 答对数
  is_critical: boolean;
  critical_failed: boolean;   // 关键项答错
}

/** 领域覆盖热力（按 12 领域） */
export interface DomainCoverage {
  key: Domain;
  name: string;
  weight: DomainDef['weight'];
  answered: number;
  total_available: number;
  accuracy: number;           // 0-100
}

export interface AbilityProfile {
  overall: number;                          // 综合分
  competencies: CompetencyScore[];          // C1-C6 雷达
  domains: DomainCoverage[];                // D1-D12 覆盖
  strengths: CompetencyScore[];
  weaknesses: CompetencyScore[];
  recommendations: {
    kind: 'course' | 'quiz' | 'practice';
    id: number;
    title: string;
    reason: string;
  }[];
}
