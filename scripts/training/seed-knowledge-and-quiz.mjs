// Seed 培训测评 · 知识点条目 (KI-05 ~ KI-09) + 「增强物应用测评」20 题卷子
// 内容依据 resources/class/评测系统内容参考与维度设计.md 第三节条目 5-9 + 第五节示例题
// 用法：node scripts/training/seed-knowledge-and-quiz.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读 .env.local
try {
  const env = readFileSync(join(__dirname, '..', '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
if (!connectionString) {
  console.error('❌ 缺少 POSTGRES_URL');
  process.exit(1);
}
const needSsl = /sslmode=require|neon\.tech|vercel/i.test(connectionString);
// bigint (OID 20) 默认返回字符串——转成 number 与运行时一致
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
const pool = new pg.Pool({
  connectionString,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

// ============ 知识点条目 KI-05 ~ KI-09 ============

const KNOWLEDGE_ITEMS = [
  {
    code: 'KI-05',
    domain: 'D2',
    title: 'ABC 行为分析模式',
    summary:
      'A（前事 Antecedent）→ B（行为 Behavior）→ C（结果 Consequence）。ABA 通过改变 C 来改变 B；行为的未来发生频率取决于 C。同一行为在不同 C 下会导致不同后果。',
    key_points: [
      'A = 前事，行为发生前的环境刺激',
      'B = 行为，可观察可测量',
      'C = 结果，决定行为未来频率',
      '改变 C 来改变 B',
    ],
    common_mistakes: [
      '把前事和结果混淆',
      '忽视同一行为不同 C 导致不同后果',
      '把状态或情绪当行为',
    ],
    question_angles: ['给情境标注 ABC', '预测行为频率变化', '判断 C 对 B 的影响'],
    source_videos: ['分析行为的ABC模式'],
    sort: 5,
  },
  {
    code: 'KI-06',
    domain: 'D3',
    title: '强化与惩罚的四象限',
    summary:
      '两步判断：① 行为未来频率增加是强化，减少是惩罚；② 加入刺激是"正"，移除刺激是"负"。四象限：正强化 / 负强化 / 正惩罚 / 负惩罚。"正""负"仅指刺激的加或减，与好坏无关。',
    key_points: [
      '强化：未来行为频率增加',
      '惩罚：未来行为频率减少',
      '正 = 加入刺激；负 = 移除刺激',
      '与好坏无关，只看方向',
    ],
    common_mistakes: [
      '把"负"误解为坏事',
      '把"正"误解为好事',
      '只看当下不看未来频率',
      '把负强化和惩罚混淆',
    ],
    question_angles: ['四象限判定', '扔垃圾/迟到扣钱案例归类', '给情境判断象限'],
    source_videos: ['什么是强化和惩罚'],
    sort: 6,
  },
  {
    code: 'KI-07',
    domain: 'D3',
    title: '增强物的分类',
    summary:
      '按起源分：非条件（原级，与生俱来，如水/空气/食物）/ 条件（后天配对习得，如金钱/赞美）。按类型分：食物、有形物品、社会性、活动、感官。特殊需要儿童常偏好感官类（发光/旋转/声音玩具）。',
    key_points: [
      '非条件增强物：与生俱来',
      '条件增强物：后天配对习得',
      '类型：食物/物品/社会/活动/感官',
      '因人而异',
    ],
    common_mistakes: [
      '条件和非条件混淆',
      '忽视"因人而异"，套用统一清单',
      '把感官类忽略掉',
    ],
    question_angles: ['分类配对', '给例子判类型', '为特需儿童选增强物'],
    source_videos: ['第5讲 增强物的分类'],
    sort: 7,
  },
  {
    code: 'KI-08',
    domain: 'D4',
    title: '偏好物评估的五种方法',
    summary:
      '① 间接评估（问家长/照顾者/孩子）② 自由操作观察 ③ 单一刺激评估 ④ 配对刺激评估（两两呈现）⑤ 多种刺激评估（含替代/不替代）。后三种为回合式；配对刺激最常用。操作要点：目标物不能固定在同一位置；两个都拿要提示"只能选一个"；无选择等 5 秒、连续 3 次无反应则结束。',
    key_points: [
      '5 种方法：间接/自由操作/单一/配对/多种刺激',
      '配对刺激最常用',
      '目标物位置要变化',
      '两个都拿要提示只选一个',
      '无反应 3 次结束',
    ],
    common_mistakes: [
      '目标物固定同一位置',
      '两个都拿时没提示',
      '不设置无反应超时',
      '把间接询问当唯一方法',
    ],
    question_angles: ['方法识别', '操作规范判断', '从低到高侵入性排序'],
    source_videos: ['第6讲 偏好物评估'],
    sort: 8,
  },
  {
    code: 'KI-09',
    domain: 'D4',
    title: '有效使用增强 + 饱足的识别与规避',
    summary:
      '使用准则：零秒延宕给予、高质量、多样化、失去动机前转换、因人而异且与年龄匹配、后效社会性注意与叙述性赞美（夸具体行为，非泛泛"你真棒"）、逐渐延宕、科学使用增强计划表。饱足识别：拿走不看/不伸手选/拿了不玩。规避五法：转换、保留、减量、探索、推销。',
    key_points: [
      '零秒延宕给予增强',
      '叙述性赞美（夸具体行为）',
      '多样化避免饱足',
      '饱足信号：不看/不选/不玩',
      '规避五法：转/保/减/探/推',
    ],
    common_mistakes: [
      '延迟给增强强化了等待中的问题行为',
      '单一增强物导致饱足',
      '赞美泛泛"你真棒"',
      '增强物与年龄不匹配',
    ],
    question_angles: ['准则多选', '饱足信号识别', '规避方法匹配', '案例分析'],
    source_videos: ['第8讲 如何有效地使用增强'],
    sort: 9,
  },
];

// ============ 20 题「增强物应用测评」（覆盖 KI-05 ~ KI-09）============
// 每题字段：type/level/comps/diff/is_key/stem/options[{key,text,is_correct,explain}]/kp_codes/source

const QUESTIONS = [
  // === KI-05 · ABC 行为分析模式（4 题）===
  {
    type: 'single',
    level: 'L1',
    comps: ['C1'],
    diff: 'entry',
    stem: 'ABA 中 ABC 模式的 A、B、C 分别代表什么？',
    options: [
      { key: 'A', text: '答案 / 行为 / 后果', is_correct: false, explain: 'A 不是 answer' },
      { key: 'B', text: '前事 / 行为 / 结果', is_correct: true, explain: 'Antecedent / Behavior / Consequence' },
      { key: 'C', text: '态度 / 行为 / 表扬', is_correct: false, explain: '概念错位' },
      { key: 'D', text: '前事 / 行为 / 表扬', is_correct: false, explain: 'C 是结果，不是仅表扬' },
    ],
    kp_codes: ['KI-05'],
    source: '分析行为的ABC模式',
  },
  {
    type: 'case',
    level: 'L4',
    comps: ['C1', 'C3'],
    diff: 'advanced',
    stem:
      '情境：下雨了（前），小明打开雨伞（中），结果没被淋湿（后）。请判断小明"下雨打伞"这一行为未来发生的频率会怎样？',
    options: [
      { key: 'A', text: '频率减少', is_correct: false, explain: '这是负强化，频率会增加' },
      { key: 'B', text: '频率不变', is_correct: false, explain: '有明确后效，会变化' },
      {
        key: 'C',
        text: '频率增加（负强化：移除"被淋湿"的厌恶刺激）',
        is_correct: true,
        explain: '移除厌恶刺激使行为频率增加，属负强化',
      },
      { key: 'D', text: '频率增加（正强化）', is_correct: false, explain: '是移除刺激不是加入' },
    ],
    kp_codes: ['KI-05', 'KI-06'],
    source: '分析行为的ABC模式',
  },
  {
    type: 'judge',
    level: 'L2',
    comps: ['C1'],
    diff: 'entry',
    stem: 'ABA 主要通过改变行为发生前的环境（A）来改变行为（B）。',
    options: [
      { key: 'A', text: '正确', is_correct: false, explain: '主要通过改变结果 C 来改变 B' },
      { key: 'B', text: '错误', is_correct: true, explain: '通过改变 C 而非 A 来改变 B' },
    ],
    kp_codes: ['KI-05'],
    source: '分析行为的ABC模式',
  },
  {
    type: 'single',
    level: 'L3',
    comps: ['C3'],
    diff: 'advanced',
    stem:
      '孩子在超市大声哭闹，妈妈立刻买了糖果。之后孩子在超市大声哭闹的频率显著上升。从 ABC 角度看，最需要调整的是哪一环？',
    options: [
      { key: 'A', text: 'A（改变前事，比如不带孩子去超市）', is_correct: false, explain: '回避不是根本解法' },
      {
        key: 'B',
        text: 'C（改变结果，不用购买行为奖励哭闹）',
        is_correct: true,
        explain: '结果决定行为未来频率，改变 C 才是关键',
      },
      { key: 'C', text: 'B（禁止孩子哭闹）', is_correct: false, explain: '哭闹本身不可禁止，要看结果处理' },
      { key: 'D', text: '无法通过 ABC 分析', is_correct: false, explain: '典型 ABC 情境' },
    ],
    kp_codes: ['KI-05'],
    source: '分析行为的ABC模式',
  },

  // === KI-06 · 强化与惩罚四象限（5 题）===
  {
    type: 'single',
    level: 'L3',
    comps: ['C1'],
    diff: 'advanced',
    stem: '你早上迟到被扣工资 50 元后，之后每天准点打卡。"迟到"这一行为经历了哪种后效？',
    options: [
      { key: 'A', text: '正强化', is_correct: false, explain: '强化会增加频率，此处减少' },
      { key: 'B', text: '负强化', is_correct: false, explain: '负强化也是增加频率' },
      {
        key: 'C',
        text: '正惩罚',
        is_correct: true,
        explain: '未来迟到频率减少（惩罚）+ 加入了扣钱这个刺激（正）',
      },
      { key: 'D', text: '负惩罚', is_correct: false, explain: '负惩罚是移除喜欢的刺激' },
    ],
    kp_codes: ['KI-06'],
    source: '什么是强化和惩罚',
    is_key: false,
  },
  {
    type: 'multi',
    level: 'L2',
    comps: ['C1'],
    diff: 'entry',
    stem: '下列哪些属于"负强化"？（漏选或多选均不得分）',
    options: [
      {
        key: 'A',
        text: '扔掉发臭垃圾后异味消失，之后更勤扔垃圾',
        is_correct: true,
        explain: '移除厌恶刺激→行为增加，负强化',
      },
      {
        key: 'B',
        text: '回答问题后获得贴纸，之后更爱回答',
        is_correct: false,
        explain: '加入刺激→行为增加，正强化',
      },
      {
        key: 'C',
        text: '孩子说"等一等"后老师停下要求，之后更愿意说等一等',
        is_correct: true,
        explain: '移除要求→行为增加，负强化',
      },
      {
        key: 'D',
        text: '看电视被妈妈关掉电视，之后不再躺着看',
        is_correct: false,
        explain: '移除刺激→行为减少，负惩罚',
      },
    ],
    kp_codes: ['KI-06'],
    source: '什么是强化和惩罚',
  },
  {
    type: 'judge',
    level: 'L2',
    comps: ['C1'],
    diff: 'entry',
    stem: '"负强化"里的"负"就是坏事、不好的意思。',
    options: [
      {
        key: 'A',
        text: '正确',
        is_correct: false,
        explain: '常见迷思。"正/负"只表示加入或移除刺激，与好坏无关',
      },
      { key: 'B', text: '错误', is_correct: true, explain: '正负 = 加/减刺激，不是价值判断' },
    ],
    kp_codes: ['KI-06'],
    source: '什么是强化和惩罚',
  },
  {
    type: 'single',
    level: 'L4',
    comps: ['C1', 'C3'],
    diff: 'advanced',
    stem: '一个孩子上课时如果乖乖坐着写作业 30 分钟，妈妈会撤销之前罚他做的家务。这属于哪种后效？',
    options: [
      { key: 'A', text: '正强化', is_correct: false, explain: '不是加入刺激' },
      {
        key: 'B',
        text: '负强化',
        is_correct: true,
        explain: '移除厌恶刺激（家务）→ 增加"乖乖坐着写作业"的频率',
      },
      { key: 'C', text: '正惩罚', is_correct: false, explain: '不是减少行为' },
      { key: 'D', text: '负惩罚', is_correct: false, explain: '不是减少行为' },
    ],
    kp_codes: ['KI-06'],
    source: '什么是强化和惩罚',
  },
  {
    type: 'single',
    level: 'L1',
    comps: ['C1'],
    diff: 'entry',
    stem: '判断某个后效属于"强化"还是"惩罚"的核心依据是？',
    options: [
      { key: 'A', text: '这件事孩子喜不喜欢', is_correct: false, explain: '主观判断不可靠' },
      { key: 'B', text: '给的是好东西还是坏东西', is_correct: false, explain: '概念混淆' },
      {
        key: 'C',
        text: '目标行为未来发生的频率是增加还是减少',
        is_correct: true,
        explain: '这是 ABA 的严格定义',
      },
      { key: 'D', text: '施加的力度大小', is_correct: false, explain: '与定义无关' },
    ],
    kp_codes: ['KI-06'],
    source: '什么是强化和惩罚',
  },

  // === KI-07 · 增强物分类（3 题）===
  {
    type: 'single',
    level: 'L2',
    comps: ['C1'],
    diff: 'entry',
    stem: '"金钱"作为增强物属于哪一类？',
    options: [
      { key: 'A', text: '非条件（原级）增强物', is_correct: false, explain: '非条件是与生俱来的，如水食物' },
      {
        key: 'B',
        text: '条件（次级）增强物',
        is_correct: true,
        explain: '金钱本身没有价值，通过后天配对习得增强作用',
      },
      { key: 'C', text: '感官类原级增强物', is_correct: false, explain: '类别归属错误' },
      { key: 'D', text: '既非条件也非次级', is_correct: false, explain: '必然属于其一' },
    ],
    kp_codes: ['KI-07'],
    source: '第5讲 增强物的分类',
  },
  {
    type: 'multi',
    level: 'L3',
    comps: ['C2', 'C3'],
    diff: 'advanced',
    stem: '为一位喜欢摆弄发光玩具的自闭症孩子挑增强物，下列哪些**通常**是不错的候选？（漏选或多选均不得分）',
    options: [
      { key: 'A', text: '带 LED 灯的旋转陀螺', is_correct: true, explain: '感官类增强物是特需儿童常见偏好' },
      { key: 'B', text: '会发出声光的音乐盒', is_correct: true, explain: '感官刺激类型匹配' },
      {
        key: 'C',
        text: '不管孩子偏好、直接用糖果',
        is_correct: false,
        explain: '违背"因人而异"原则；食物不一定适合',
      },
      {
        key: 'D',
        text: '与孩子年龄不匹配的婴儿摇铃',
        is_correct: false,
        explain: '违背"与年龄匹配"原则',
      },
    ],
    kp_codes: ['KI-07', 'KI-09'],
    source: '第5讲 增强物的分类',
  },
  {
    type: 'judge',
    level: 'L2',
    comps: ['C1'],
    diff: 'entry',
    stem: '同一件东西对所有孩子都会有相同的强化效果。',
    options: [
      { key: 'A', text: '正确', is_correct: false, explain: '增强物因人而异' },
      { key: 'B', text: '错误', is_correct: true, explain: '这是增强物使用的基本原则' },
    ],
    kp_codes: ['KI-07', 'KI-09'],
    source: '第5讲 增强物的分类',
  },

  // === KI-08 · 偏好物评估（4 题）===
  {
    type: 'order',
    level: 'L3',
    comps: ['C2'],
    diff: 'advanced',
    stem:
      '把下列偏好物评估方法，按"结构化/侵入性从低到高"排序，正确顺序是？（提示：间接询问 / 自由操作观察 / 单一刺激评估 / 配对刺激评估）',
    options: [
      {
        key: 'A',
        text: '间接询问 → 自由操作观察 → 单一刺激评估 → 配对刺激评估',
        is_correct: true,
        explain: '结构化程度递增顺序',
      },
      { key: 'B', text: '自由操作观察 → 间接询问 → 配对刺激评估 → 单一刺激评估', is_correct: false, explain: '顺序错' },
      { key: 'C', text: '配对刺激评估 → 单一刺激评估 → 自由操作观察 → 间接询问', is_correct: false, explain: '方向反了' },
      { key: 'D', text: '单一刺激评估 → 配对刺激评估 → 间接询问 → 自由操作观察', is_correct: false, explain: '顺序错' },
    ],
    kp_codes: ['KI-08'],
    source: '第6讲 偏好物评估',
  },
  {
    type: 'single',
    level: 'L3',
    comps: ['C2'],
    diff: 'advanced',
    stem: '做配对刺激评估时，若孩子同时伸手去拿两个物品，正确的操作是？',
    options: [
      { key: 'A', text: '直接把两个都给他', is_correct: false, explain: '会使评估结果失效' },
      {
        key: 'B',
        text: '提示他"只能选一个"，让他重新选择',
        is_correct: true,
        explain: '配对刺激评估要求单选',
      },
      { key: 'C', text: '把两个都拿走', is_correct: false, explain: '过度剥夺不利于评估' },
      { key: 'D', text: '按孩子先碰到的那个记录', is_correct: false, explain: '操作要求是必须清晰单选' },
    ],
    kp_codes: ['KI-08'],
    source: '第6讲 偏好物评估',
  },
  {
    type: 'single',
    level: 'L2',
    comps: ['C2'],
    diff: 'entry',
    stem: '做偏好物评估时，如果孩子连续多次无反应，应该怎样处理？',
    options: [
      { key: 'A', text: '一直等下去', is_correct: false, explain: '会拉长评估浪费时间' },
      { key: 'B', text: '立即换新的目标物', is_correct: false, explain: '缺失结束标准' },
      {
        key: 'C',
        text: '连续 3 次无反应则结束本次评估',
        is_correct: true,
        explain: '每次无反应等 5 秒；连续 3 次结束是标准操作',
      },
      { key: 'D', text: '强制让孩子拿一个', is_correct: false, explain: '违反评估原则' },
    ],
    kp_codes: ['KI-08'],
    source: '第6讲 偏好物评估',
  },
  {
    type: 'judge',
    level: 'L3',
    comps: ['C2'],
    diff: 'advanced',
    stem: '为了让配对刺激评估更公平，两个目标物在桌上的摆放位置应该固定不变。',
    options: [
      {
        key: 'A',
        text: '正确',
        is_correct: false,
        explain: '常见错误。目标物应随机变换位置，避免孩子只依赖位置线索',
      },
      { key: 'B', text: '错误', is_correct: true, explain: '位置要交换，避免位置偏差' },
    ],
    kp_codes: ['KI-08'],
    source: '第6讲 偏好物评估',
  },

  // === KI-09 · 有效使用增强 + 饱足（4 题）===
  {
    type: 'case',
    level: 'L4',
    comps: ['C2', 'C3'],
    diff: 'advanced',
    stem:
      '上课 10 分钟后，孩子对老师递来的玩具"看都不看、数到 3 就推开"。这最可能说明什么？',
    options: [
      { key: 'A', text: '孩子在闹脾气', is_correct: false, explain: '不是最直接的解释' },
      {
        key: 'B',
        text: '增强物已经出现饱足',
        is_correct: true,
        explain: '"拿走不看、不选、不玩"都是典型饱足信号',
      },
      { key: 'C', text: '孩子讨厌老师', is_correct: false, explain: '不能从单一行为推断' },
      { key: 'D', text: '玩具坏了', is_correct: false, explain: '过度推断' },
    ],
    kp_codes: ['KI-09'],
    source: '第8讲 如何有效地使用增强',
  },
  {
    type: 'multi',
    level: 'L3',
    comps: ['C2', 'C3'],
    diff: 'advanced',
    stem: '识别到孩子对当前增强物饱足后，下列哪些做法是正确的规避方式？（漏选或多选均不得分）',
    options: [
      { key: 'A', text: '换一个新的增强物（转换）', is_correct: true, explain: '规避五法之一' },
      { key: 'B', text: '暂时把这个物品收起来一段时间（保留）', is_correct: true, explain: '规避五法之一' },
      { key: 'C', text: '减少每次给的量或时间（减量）', is_correct: true, explain: '规避五法之一' },
      { key: 'D', text: '继续用相同的物品，无视孩子反应', is_correct: false, explain: '会导致强化失效' },
    ],
    kp_codes: ['KI-09'],
    source: '第8讲 如何有效地使用增强',
  },
  {
    type: 'single',
    level: 'L3',
    comps: ['C2', 'C5'],
    diff: 'advanced',
    stem: '下列哪种赞美方式更符合 ABA 的"叙述性赞美"原则？',
    options: [
      { key: 'A', text: '"你真棒！"', is_correct: false, explain: '泛泛表扬，不具体' },
      { key: 'B', text: '"太厉害了！"', is_correct: false, explain: '同样泛泛' },
      {
        key: 'C',
        text: '"你刚才自己把书本收好放回架子上，做得好！"',
        is_correct: true,
        explain: '具体描述行为的赞美是叙述性赞美',
      },
      { key: 'D', text: '"给你一颗糖"', is_correct: false, explain: '这是实物增强，不是赞美' },
    ],
    kp_codes: ['KI-09'],
    source: '第8讲 如何有效地使用增强',
  },
  {
    type: 'judge',
    level: 'L5',
    comps: ['C4', 'C6'],
    diff: 'expert',
    stem:
      '康复师上课记录数据时说："这一回合我记不清孩子是对是错，就先按正确记上，回头再说。" 该做法是否恰当？',
    options: [
      {
        key: 'A',
        text: '恰当，不影响大局',
        is_correct: false,
        explain: '编造数据严重违反职业伦理',
      },
      {
        key: 'B',
        text: '不恰当，应"宁可漏记也不编造数据"',
        is_correct: true,
        explain: '数据真实性是康复师职业操守的底线',
      },
    ],
    kp_codes: ['KI-09'],
    source: '第8讲 如何有效地使用增强 / 第19讲 纠正程序',
    is_key: true,
  },
];

// ============ 主流程 ============

async function upsertKnowledgeItem(item) {
  await pool.query(
    `insert into training_knowledge_items
      (code, domain, title, summary, key_points, common_mistakes, question_angles, source_videos, sort)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9)
     on conflict (code) do update set
       domain = excluded.domain,
       title = excluded.title,
       summary = excluded.summary,
       key_points = excluded.key_points,
       common_mistakes = excluded.common_mistakes,
       question_angles = excluded.question_angles,
       source_videos = excluded.source_videos,
       sort = excluded.sort,
       updated_at = now()`,
    [
      item.code,
      item.domain,
      item.title,
      item.summary,
      JSON.stringify(item.key_points),
      JSON.stringify(item.common_mistakes),
      JSON.stringify(item.question_angles),
      JSON.stringify(item.source_videos),
      item.sort,
    ]
  );
}

async function insertQuestion(q) {
  const row = await pool.query(
    `insert into training_questions
       (related_course_id, category, cognitive_level, competencies, difficulty,
        type, stem, options, knowledge_points, knowledge_item_codes,
        is_key_item, source_video, status)
     values (NULL,$1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,'published')
     returning id`,
    [
      q.category,
      q.level,
      JSON.stringify(q.comps),
      q.diff,
      q.type,
      q.stem,
      JSON.stringify(q.options),
      JSON.stringify([]),
      JSON.stringify(q.kp_codes),
      !!q.is_key,
      q.source,
    ]
  );
  return row.rows[0].id;
}

async function upsertQuiz(title, description, questionIds, isBuiltin) {
  // 用 title 作为幂等 key
  const existing = await pool.query(
    'select id from training_quizzes where title = $1 and deleted_at is null',
    [title]
  );
  if (existing.rows[0]) {
    await pool.query(
      `update training_quizzes set
         description = $2,
         question_ids = $3::jsonb,
         is_builtin = $4,
         category = 'D4',
         duration_min = 25,
         pass_score = 60,
         updated_at = now()
       where id = $1`,
      [existing.rows[0].id, description, JSON.stringify(questionIds), isBuiltin]
    );
    return existing.rows[0].id;
  }
  const r = await pool.query(
    `insert into training_quizzes
       (title, category, description, question_ids, duration_min, pass_score, is_builtin)
     values ($1,'D4',$2,$3::jsonb,25,60,$4)
     returning id`,
    [title, description, JSON.stringify(questionIds), isBuiltin]
  );
  return r.rows[0].id;
}

// 由 kp_codes 派生题目的 category
function deriveCategory(kpCodes) {
  const map = { 'KI-05': 'D2', 'KI-06': 'D3', 'KI-07': 'D3', 'KI-08': 'D4', 'KI-09': 'D4' };
  return map[kpCodes[0]] || 'D4';
}

async function main() {
  console.log('→ 清理旧的 seed 数据（training_questions where source_video 匹配）…');
  await pool.query(
    `delete from training_questions
      where source_video is not null
        and related_course_id is null`
  );

  console.log('→ 写入 5 条知识点条目…');
  for (const item of KNOWLEDGE_ITEMS) {
    await upsertKnowledgeItem(item);
    console.log(`  ✓ ${item.code} ${item.title}`);
  }

  console.log(`→ 写入 ${QUESTIONS.length} 道题…`);
  const questionIds = [];
  for (const q of QUESTIONS) {
    q.category = deriveCategory(q.kp_codes);
    const id = await insertQuestion(q);
    questionIds.push(id);
  }
  console.log(`  ✓ 入库 ${questionIds.length} 题`);

  console.log('→ 组卷「增强物应用测评」…');
  const quizId = await upsertQuiz(
    '增强物应用测评',
    'ABA 强化基础 · 增强物挑选与使用 · 饱足识别。覆盖知识点 KI-05 ~ KI-09。20 题，约 25 分钟。',
    questionIds,
    true
  );
  console.log(`  ✓ 测评卷 id=${quizId}`);

  console.log('\n✅ 完成');
  await pool.end();
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
