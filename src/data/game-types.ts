// 互动游戏共享类型（前后端共用）
// game.rounds（DB jsonb）↔ 出题 JSON ↔ GamePlayer props 都用这里的接口

export type GameType = 'emotion' | 'match';

/** 情绪识别：看情境句，从表情选项里选出对应情绪 */
export interface EmotionRound {
  /** 情境句：如「弟弟得到了最喜欢的小汽车」 */
  cap: string;
  /** 正确情绪键：开心/难过/生气/害怕 */
  answer: string;
  /** 4 个情绪选项（含 answer，顺序即展示顺序） */
  options: string[];
  /** 情境主图 URL（Blob 永久地址）；缺省时前端用 emoji 兜底 */
  imageUrl?: string;
}

/** 认知配对：看目标物，从选项里找同类/同色 */
export interface MatchRound {
  /** 提示句：如「这是一个水果，找出另一个水果」 */
  cap: string;
  /** 目标物标签：如「苹果」 */
  label: string;
  /** 正确选项标签：如「香蕉」 */
  answer: string;
  /** 4 个选项标签（含 answer） */
  options: string[];
  /** 分类维度：category（同类）| color（同色） */
  category: string;
  /** 目标物主图 URL */
  imageUrl?: string;
  /** 各选项对应图 URL，与 options 同序 */
  optionImages?: (string | null)[];
}

export type GameRound = EmotionRound | MatchRound;

export interface GameConfig {
  childId?: number;
  gameType: GameType;
  roundCount?: number;
}

export interface GameData {
  id: number;
  gameType: GameType;
  title: string;
  status: 'BUILDING' | 'READY' | 'FAILED';
  rounds: GameRound[];
}

/** 4 种基础情绪 → emoji 兜底 */
export const EMOTION_EMOJI: Record<string, string> = {
  开心: '😊',
  难过: '😢',
  生气: '😠',
  害怕: '😨',
};

export const BASE_EMOTIONS = Object.keys(EMOTION_EMOJI);

export const GAME_META: Record<
  GameType,
  { name: string; emoji: string; subtitle: string }
> = {
  emotion: {
    name: '这是什么心情？',
    emoji: '😊',
    subtitle: '看看情境，猜猜他现在的心情',
  },
  match: {
    name: '找一样的',
    emoji: '🍎',
    subtitle: '看看上面的东西，从下面找出同一类的',
  },
};

export const DIAGNOSES = ['自闭症谱系(ASD)', '智力发育迟缓', '注意力缺陷(ADHD)', '发育迟缓', '其他'];
export const SEVERITIES = ['轻度', '中度', '重度'];
export const ABILITY_TAGS = ['情绪识别', '颜色认知', '形状认知', '物品分类', '数量概念', '语言理解', '专注力'];
export const INTEREST_TAGS = ['汽车', '小动物', '恐龙', '水果', '交通工具', '海洋', '太空', '积木', '音乐'];
