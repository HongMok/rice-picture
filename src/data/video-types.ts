// 课堂视频分析共享类型（前后端共用）
// video_analyses.report（DB jsonb）↔ 模型输出 JSON ↔ ReportView props 同构

export type VideoStatus = 'ANALYZING' | 'DONE' | 'FAILED';

/** 时间轴片段：某个时刻孩子或老师的一个关键行为 */
export interface TimelineSeg {
  /** 时间戳 mm:ss */
  time: string;
  /** 主体：孩子 or 老师 */
  role: 'child' | 'teacher';
  /** 行为标签：如「专注」「正向强化」「离座」「指令遵从」 */
  tag: string;
  /** 具体描述 */
  desc: string;
}

/** 量化统计项：如 专注时长占比 65% */
export interface StatItem {
  label: string;
  value: number;
  unit?: string;
}

/** 能力/教学维度评分：1~5 分 + 依据（雷达图 + 评分条共用） */
export interface DimensionScore {
  /** 维度名：如「专注力」「指令清晰度」 */
  name: string;
  /** 评分 1~5 */
  score: number;
  /** 评分依据（一句，基于视频观察） */
  note: string;
  /** 同龄典型发展水平参考分（1~5，模型按年龄估计，仅供参考） */
  peer?: number;
}

/**
 * 老师某维度里的一个具体片段（一个维度可有多个）。
 * - 问题片段：时间戳 + 问题表现(observation) + 正确示范(demo)
 * - 亮点片段：时间戳 + 亮点表现(observation) + 进阶示范(demo，可选)
 */
export interface TeacherSegment {
  /** 时间戳 mm:ss */
  time: string;
  /** 片段性质：problem 问题 | highlight 亮点 */
  type: 'problem' | 'highlight';
  /** 课堂里的具体表现（问题表现 / 亮点表现） */
  observation: string;
  /** problem→正确示范；highlight→进阶示范（可选，highlight 时可空） */
  demo?: string;
}

/** 老师教学评分卡：评分 + 一句总评 + 多个片段（问题/亮点） */
export interface TeacherDimension extends DimensionScore {
  /** 该维度多个具体片段 */
  segments?: TeacherSegment[];
}

/** ABC 行为事件（前因-行为-后果）。既可记问题行为，也可记关键正向回合。 */
export interface AbcEvent {
  /** 时间戳 mm:ss */
  time: string;
  /** 前因 Antecedent：发生了什么、老师给了什么指令/情境 */
  antecedent: string;
  /** 行为 Behavior：孩子做了什么 */
  behavior: string;
  /** 后果 Consequence：随后发生了什么 / 老师如何回应 */
  consequence: string;
  /** 行为性质：problem 问题行为 | positive 正向行为 */
  kind: 'problem' | 'positive';
  /** 对老师处理的点评（可空） */
  comment?: string;
}

/** 回合式教学（DTT）统计 */
export interface DttStats {
  totalTrials: number; // 回合尝试总数
  independentCorrect: number; // 独立正确
  promptedCorrect: number; // 提示下正确
  incorrect: number; // 错误/无反应
  /** 独立正确率（0~100，可由模型给或前端算） */
  independentRate: number;
  /** 提示层级分布：口语/手势/肢体 各多少次 */
  promptLevels: { verbal: number; gesture: number; physical: number };
}

/** AI 分析产出的结构化报告 */
export interface VideoReport {
  summary: string; // 整体概述
  childSummary: string; // 学生总结（学生 tab 顶部）
  teacherSummary: string; // 老师总结（老师 tab 顶部）
  /** 孩子能力雷达评分（专注力/指令遵从/沟通表达/社交互动/情绪调节/精细动作…） */
  childRadar: DimensionScore[];
  /** 老师教学评分卡（指令清晰度/强化及时性/提示适当性/节奏把控/回应一致性） */
  teacherScores: TeacherDimension[];
  teacherBehavior: string[]; // 老师教学表现要点
  /** 给老师的下一步教学建议（区别于 suggestions，那是给孩子的训练建议） */
  teacherNextSteps: string[];
  /** 回合式教学统计（无法判断则各项为 0） */
  dtt: DttStats;
  /** 是否观察到问题行为（用于 ABC 模块空态文案） */
  hasProblemBehavior: boolean;
  /** ABC 行为事件（前因-行为-后果）；无问题行为时可为空 */
  abcEvents: AbcEvent[];
  timeline: TimelineSeg[]; // 关键片段时间轴（孩子/老师）
  stats: StatItem[]; // 量化统计（关键指标卡）
  /** 进步亮点 */
  highlights: string[];
  /** 需关注 / 预警信号 */
  concerns: string[];
  suggestions: string[]; // 训练建议（结合个案）
  /** 下节课可直接用的 SMART 训练目标 */
  nextGoals: string[];
}

/** 一次历史分析的能力得分快照（按 child_id 关联，用于趋势图） */
export interface HistoryPoint {
  id: number;
  date: string; // YYYY-MM-DD
  /** 维度名 → 得分（1~5） */
  scores: Record<string, number>;
}

/** 前端拿到的一条分析记录 */
export interface VideoAnalysis {
  id: number;
  title: string | null;
  videoUrl: string;
  status: VideoStatus;
  report: VideoReport | null;
  error?: string | null;
  createdAt?: string;
  /** 关联的孩子个案 id；未关联时为 null */
  childId?: number | null;
  /** 同一个孩子的历次能力得分（含本次，按时间升序），无个案或仅一次时可为空/单点 */
  history?: HistoryPoint[];
}
