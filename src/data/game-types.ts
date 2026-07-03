// 互动游戏共享类型（前后端共用）
// game.rounds（DB jsonb）↔ 出题 JSON ↔ GamePlayer props 都用这里的接口

export type GameType = 'emotion' | 'match' | 'catch-butterfly' | 'whack-a-mole';

/** quiz=现有AI出题四选一；reflex=实时反应/精细动作类，纯前端不经过出题/生图管线 */
export type GameEngine = 'quiz' | 'reflex';

export const GAME_ENGINE: Record<GameType, GameEngine> = {
  emotion: 'quiz',
  match: 'quiz',
  'catch-butterfly': 'reflex',
  'whack-a-mole': 'reflex',
};

export const DIFFICULTIES = ['入门', '简单', '中等', '困难', '专家'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

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
  'catch-butterfly': {
    name: '捉蝴蝶',
    emoji: '🦋',
    subtitle: '专注力与手眼协调训练',
  },
  'whack-a-mole': {
    name: '打地鼠',
    emoji: '🐹',
    subtitle: '精细动作与反应力训练',
  },
};

/** reflex 引擎按难度调节的参数表：数量越多/速度越快/存活越短 = 越难。
 *  hitScore 固定不随难度变，靠"手速要求"天然拉开分差；
 *  theoreticalMax 是该时长内高密度全命中的估算满分，用于结算算星级占比。 */
export interface ReflexDifficultyParams {
  /** 场上同时存在的目标数量 */
  concurrent: number;
  /** 目标存活时长（ms），越短越难 */
  lifetimeMs: number;
  /** 新目标生成间隔（ms），越短越难 */
  spawnIntervalMs: number;
  /** 单次命中得分（各难度一致） */
  hitScore: number;
  /** 该难度理论满分（结算算星级占比用） */
  theoreticalMax: number;
}

export const GAME_DURATION_MS = 120_000; // 固定 2 分钟倒计时

export const REFLEX_DIFFICULTY: Record<Difficulty, ReflexDifficultyParams> = {
  入门: { concurrent: 1, lifetimeMs: 3200, spawnIntervalMs: 1600, hitScore: 10, theoreticalMax: 450 },
  简单: { concurrent: 2, lifetimeMs: 2600, spawnIntervalMs: 1300, hitScore: 10, theoreticalMax: 620 },
  中等: { concurrent: 2, lifetimeMs: 2000, spawnIntervalMs: 1000, hitScore: 10, theoreticalMax: 820 },
  困难: { concurrent: 3, lifetimeMs: 1500, spawnIntervalMs: 800, hitScore: 10, theoreticalMax: 1050 },
  专家: { concurrent: 3, lifetimeMs: 1100, spawnIntervalMs: 600, hitScore: 10, theoreticalMax: 1300 },
};

/** 按最终得分占该难度理论满分的比例定星级 */
export function starsForScore(score: number, difficulty: Difficulty): 1 | 2 | 3 {
  const ratio = score / REFLEX_DIFFICULTY[difficulty].theoreticalMax;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export interface ReflexGameResult {
  score: number;
  stars: 1 | 2 | 3;
  difficulty: Difficulty;
  hits: number;
  misses: number;
}

export const DIAGNOSES = ['自闭症谱系(ASD)', '智力发育迟缓', '注意力缺陷(ADHD)', '发育迟缓', '其他'];
export const SEVERITIES = ['轻度', '中度', '重度'];
export const ABILITY_TAGS = ['情绪识别', '颜色认知', '形状认知', '物品分类', '数量概念', '语言理解', '专注力'];
export const INTEREST_TAGS = ['汽车', '小动物', '恐龙', '水果', '交通工具', '海洋', '太空', '积木', '音乐'];
