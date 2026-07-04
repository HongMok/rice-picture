// Seed 培训测评 · 2 个情景练习 + 3 门课程
// 用法：node scripts/training/seed-scenarios-and-courses.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
const pool = new pg.Pool({
  connectionString,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

// ============ 2 个情景练习 ============

const SCENARIOS = [
  {
    title: '与刚拿到诊断的家长首次沟通',
    category: 'D12',
    role_persona: {
      who: '孩子妈妈',
      tone: '焦虑、抗拒、不时打断',
      background:
        '这位妈妈的 3 岁儿子今天刚被三甲医院评估为孤独症谱系（ASD 轻度）。她今天第一次到你机构面谈。她已经在网上查了很多资料，情绪很不稳定：一会儿哭、一会儿质疑，反复问"是不是我们养育方式出了问题？""是不是长大就会好？""你们能保证他能上普通小学吗？"。你的目标：让她愿意继续沟通、初步理解 ABA 干预是什么、约定下一次评估时间。',
    },
    initial_message:
      '（妈妈坐下，握着一张诊断报告，声音有些颤）"老师你好……我们今天来主要是想问一下……他是不是……真的没救了？我在网上看到有人说这个病一辈子都好不了……你能告诉我实话吗？"',
    evaluation_rubric: {
      dimensions: [
        {
          key: 'empathy',
          name: '共情建立',
          weight: 0.35,
          criteria: '是否先接纳情绪再传递信息；是否使用共情语言（"我理解…"）而非说教；是否避免立刻抛专业术语',
        },
        {
          key: 'accuracy',
          name: '专业准确',
          weight: 0.3,
          criteria: '关于 ASD 的说法是否循证（如不承诺"治愈"、不否认干预效果）；是否提及早期干预的重要性；用词是否谨慎不夸大',
        },
        {
          key: 'clarity',
          name: '表达清晰',
          weight: 0.2,
          criteria: '是否用家长听得懂的语言解释 ABA；是否避免"回合式教学""正强化"等未经解释的术语',
        },
        {
          key: 'action',
          name: '行动落地',
          weight: 0.15,
          criteria: '是否引导到具体的下一步（如约评估、留资料、加联系方式）；是否给家长可执行的回家小任务',
        },
      ],
    },
    success_criteria: {
      max_rounds: 10,
      must_hit_points: [
        '共情表达（接纳情绪）',
        '不承诺治愈但传递希望',
        '解释 ABA 的通俗说法',
        '约定下次会面/评估',
      ],
    },
    is_builtin: true,
  },
  {
    title: 'DTT 纠正程序 · 督导抽查',
    category: 'D5',
    role_persona: {
      who: '你的机构督导（BCBA）',
      tone: '严格、直接、擅长追问细节',
      background:
        `督导正在抽查你上课的规范性。她给你一个具体情境："孩子学习拍手指令。你说"拍手"，孩子看向窗外没有反应超过 3 秒。你接下来一步一步该怎么做？"。她会不断追问细节（如"如果孩子在提示下做对了，你会怎么记数据？""如果他自我纠正了怎么办？"）。你的目标：完整、准确、按规范地口述纠正程序，回答督导的追问。`,
    },
    initial_message:
      `（督导敲你观察窗）"暂停一下，我要和你复盘一个环节。孩子学习拍手指令，你说完"拍手"指令，孩子看向窗外——没反应，超过 3 秒了。现在请你告诉我，接下来你会怎么做？一步一步说。"`,
    evaluation_rubric: {
      dimensions: [
        {
          key: 'procedure',
          name: '纠正程序完整性',
          weight: 0.4,
          criteria: '是否覆盖：重新呈现 A → 给最高级别提示 → 不给赞美/增强 → 记录数据 → 进入下一回合',
        },
        {
          key: 'dataEthics',
          name: '数据伦理',
          weight: 0.25,
          criteria: '是否明确"提示下正确不算独立正确"；是否强调"宁可漏记也不编造"；是否知道自我纠正也记为错误',
        },
        {
          key: 'commonMistakes',
          name: '规避常见错误',
          weight: 0.2,
          criteria: '是否明确不带情绪、不说"你做错了"、不在纠正后给赞美、先获取注意力再纠正',
        },
        {
          key: 'clarity',
          name: '表达清晰有条理',
          weight: 0.15,
          criteria: '步骤是否有序；术语是否准确',
        },
      ],
    },
    success_criteria: {
      max_rounds: 8,
      must_hit_points: [
        '重新呈现 A',
        '最高级别提示',
        '不给赞美/增强',
        '记录数据（含伦理）',
      ],
    },
    is_builtin: true,
  },
];

// ============ 3 门课程 ============

const COURSES = [
  {
    title: 'ABA 是什么？',
    category: 'D2',
    duration_min: 7,
    source_ref: 'xlsx#row:52',
    // 用 xlsx 里的完整逐字稿（原样），outline/key_takeaways 手工摘要
    raw_transcript_placeholder: true,
    outline: [
      {
        title: 'ABA 的核心用途',
        start_sec: 0,
        summary:
          'ABA（应用行为分析）在干预中主要用于四个方向：提高孩子的认知能力、发展语言与沟通（如有效提要求）、改善社交行为（如与同伴互动的频率）、教授生活自理（刷牙、穿衣、如厕）。总的来说，用 ABA 做两件事：增加想要的正向行为，减少不想要的问题行为。',
        key_points: [
          '提高认知能力',
          '发展语言与沟通',
          '改善社交行为',
          '教授生活自理',
          '增加正向行为、减少问题行为',
        ],
        domain: 'D2',
        knowledge_item_codes: [],
      },
      {
        title: 'ABA 的定义：一门行为的科学',
        start_sec: 90,
        summary:
          'ABA 全称 Applied Behavior Analysis，中文是"应用行为分析"。它是一门行为的科学。这里有两个关键字：第一，ABA 是一门科学、一个学科、一种方法，不是一门课程（很多家长误以为 ABA 是"课程表上的一节课"）。作为科学，它会持续发展和进步。第二，ABA 研究的是"人类的行为"，这是其所有研究的核心。',
        key_points: [
          'ABA = Applied Behavior Analysis',
          '关键字 1：是科学 / 学科 / 方法，不是一门课',
          '关键字 2：研究人类行为',
        ],
        domain: 'D2',
        knowledge_item_codes: [],
      },
      {
        title: '拆解 ABA：应用 / 行为 / 分析',
        start_sec: 220,
        summary:
          '拆成三个部分理解：\n① 应用（Applied）：所有干预和研究都必须能应用于社会生活，研究的行为必须具有社会意义。\n② 行为（Behavior）：ABA 里的"行为"特指那些外显、可以被观察或测量的行为。想法、情绪感知等内在活动暂不在研究范围。\n③ 分析（Analysis）：通过对行为数据的分析，发现行为与环境之间的关系，然后反向利用这些关系去改变行为。',
        key_points: [
          '应用 = 具有社会意义',
          '行为 = 外显、可观察、可测量',
          '分析 = 用数据发现行为与环境的关系',
        ],
        domain: 'D2',
        knowledge_item_codes: [],
      },
      {
        title: '关于 ABA 的常见迷思',
        start_sec: 340,
        summary:
          '几个必须澄清的迷思：\n① "ABA 就是桌面 DTT / 反复看卡片" —— 错。DTT 只是 ABA 众多教学方法之一，ABA 是一门学科。\n② "ABA 是心理辅导" —— 错。ABA 是行为科学，聚焦可观察可测量的行为。\n③ "ABA 能解释孤独症成因、能治愈所有问题" —— 错。ABA 提供的是切实可行的方法，给孩子真正的学习机会，不是"包治百病"。',
        key_points: [
          'ABA ≠ DTT',
          'ABA ≠ 心理辅导',
          'ABA 不承诺治愈，提供有效学习方法',
        ],
        domain: 'D2',
        knowledge_item_codes: [],
      },
    ],
    key_takeaways: [
      '记住 ABA 的英文全称与中文翻译',
      '理解 ABA 是科学而非课程',
      '掌握应用、行为、分析三个关键词',
      '区分外显行为与内在心理活动',
      '识别关于 ABA 的常见迷思',
    ],
  },
  {
    title: '什么是强化和惩罚',
    category: 'D3',
    duration_min: 6,
    source_ref: 'xlsx#row:54',
    raw_transcript_placeholder: true,
    outline: [
      {
        title: '两个基础定义',
        start_sec: 0,
        summary:
          '强化：一个行为发生后紧跟着一个结果 C，这个 C 使得该行为在未来发生的频率增加 —— 我们就说这个行为被强化了。\n惩罚：一个行为发生后紧跟着一个结果 C，这个 C 使得该行为在未来发生的频率减少 —— 我们就说这个行为被惩罚了。\n关键：判断的唯一依据是"行为的未来频率变化"，不是当下感觉。',
        key_points: [
          '强化 = 未来行为频率增加',
          '惩罚 = 未来行为频率减少',
          '判断依据：未来频率变化',
        ],
        domain: 'D3',
        knowledge_item_codes: ['KI-06'],
      },
      {
        title: '正强化的例子',
        start_sec: 80,
        summary:
          '例子：老师问"说出一种红色的水果"（A），小明回答"苹果"（B），老师说"答对了"并奖励贴纸（C）。这个 C 会让小明未来回答问题的频率增加 —— 这就是强化。因为老师加入了一个刺激（贴纸），所以是"正强化"。',
        key_points: ['正强化 = 加入刺激使行为增加', '例：贴纸奖励回答问题'],
        domain: 'D3',
        knowledge_item_codes: ['KI-06'],
      },
      {
        title: '负强化的例子',
        start_sec: 160,
        summary:
          '例子：垃圾桶发出恶臭（A），你把垃圾拿去丢掉（B），恶臭消失（C）。为了避免以后再闻到恶臭，你以后会更勤快地扔垃圾 —— 未来"扔垃圾"的频率增加。这也是强化。因为移除了一个厌恶刺激（恶臭），所以是"负强化"。\n注意："负"不是"坏"的意思，仅指"移除刺激"。',
        key_points: [
          '负强化 = 移除厌恶刺激使行为增加',
          '"负"= 减，不是"坏"',
          '例：扔垃圾避免恶臭',
        ],
        domain: 'D3',
        knowledge_item_codes: ['KI-06'],
      },
      {
        title: '四象限判断法',
        start_sec: 250,
        summary:
          '两步判断法：\n第一步：行为未来频率是增加还是减少？\n  · 增加 → 强化\n  · 减少 → 惩罚\n第二步：C 是加入了刺激还是移除了刺激？\n  · 加入 → 正\n  · 移除 → 负\n\n四象限：\n· 正强化：加入喜欢的刺激，行为增加（回答问题→给贴纸）\n· 负强化：移除厌恶的刺激，行为增加（扔垃圾→恶臭消失）\n· 正惩罚：加入厌恶的刺激，行为减少（迟到→扣工资）\n· 负惩罚：移除喜欢的刺激，行为减少（哭闹→拿走玩具）',
        key_points: [
          '第一步：判断未来频率方向',
          '第二步：判断加入还是移除',
          '"正/负"与好坏无关',
        ],
        domain: 'D3',
        knowledge_item_codes: ['KI-06'],
      },
    ],
    key_takeaways: [
      '区分强化和惩罚（看未来频率）',
      '区分正和负（看加入还是移除）',
      '识别四种后效：正强化/负强化/正惩罚/负惩罚',
      '避免把"负"误解为"坏"',
      '用四象限分析真实生活的行为案例',
    ],
  },
  {
    title: '偏好物评估',
    category: 'D4',
    duration_min: 20,
    source_ref: 'xlsx#row:90',
    raw_transcript_placeholder: true,
    outline: [
      {
        title: '为什么要做偏好物评估',
        start_sec: 0,
        summary:
          '在使用增强物之前，先要知道孩子"到底喜欢什么"。同一件东西对不同孩子的强化效果差异很大。偏好物评估就是一套系统识别孩子偏好的方法，避免"想当然"地用糖果或表扬去做强化。',
        key_points: [
          '增强物因人而异',
          '在用增强物之前先做评估',
          '避免用"想当然"的强化物',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
      {
        title: '方法一：间接评估（询问）',
        start_sec: 80,
        summary:
          '通过询问孩子身边的成人（父母、阿姨、老师）来了解孩子喜欢什么。如果孩子本身有回答能力，也可以直接询问孩子。优点：省时；缺点：信息可能有偏差、可能过时。适合作为"起点"，配合其他方法使用。',
        key_points: [
          '询问父母/照顾者/老师',
          '也可直接问有能力的孩子',
          '省时但可能有偏差',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
      {
        title: '方法二：自由操作观察',
        start_sec: 200,
        summary:
          '把孩子放在一个有多种玩具/物品的开放环境里，不给任何指令，观察孩子自发去接触哪些物品、玩了多久。这种方式最接近真实偏好，但需要较长观察时间。',
        key_points: [
          '开放环境、不给指令',
          '看孩子自发接触什么、玩多久',
          '最接近真实偏好',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
      {
        title: '方法三：单一刺激评估',
        start_sec: 380,
        summary:
          '每次只呈现一个目标物给孩子，观察他会不会伸手取用、玩多久。用来判断某个具体物品"孩子到底喜不喜欢"。属于回合式操作。',
        key_points: [
          '每次只呈现一个目标物',
          '看是否取用、玩多久',
          '回合式操作',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
      {
        title: '方法四：配对刺激评估（最常用）',
        start_sec: 560,
        summary:
          '同时呈现两个目标物，让孩子二选一。所有目标物两两配对，最终统计每个物品的"被选中率"。这是临床最常用的方法。\n操作规范：\n· 物品位置每回合随机变换，避免"位置线索"\n· 如果孩子同时伸手拿两个，要提示"只能选一个"重新选\n· 无反应等 5 秒；连续 3 次无反应则结束',
        key_points: [
          '两两呈现让孩子选一个',
          '位置要随机变换',
          '两个都拿要提示单选',
          '无反应 3 次结束',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
      {
        title: '方法五：多种刺激评估',
        start_sec: 750,
        summary:
          '一次同时呈现 5-7 个目标物，让孩子选择。分两种：\n· 替代式（with replacement）：选走的物品会补回去继续参与后续回合\n· 不替代式（without replacement）：选走的物品移除，直到全部选完\n效率比配对法高，但对"排序偏好"的精确度略低。',
        key_points: [
          '同时呈现 5-7 个物品',
          '替代 vs 不替代两种方式',
          '效率高、精确度略低',
        ],
        domain: 'D4',
        knowledge_item_codes: ['KI-08'],
      },
    ],
    key_takeaways: [
      '识别 5 种偏好物评估方法',
      '按侵入性/结构化程度排序 5 种方法',
      '掌握配对刺激评估的操作规范',
      '知道无反应超时的处理（5 秒 × 3 次）',
      '选择合适的评估方法组合使用',
    ],
  },
];

// ============ xlsx 逐字稿抽取（保留 raw_transcript 完整备份）============

async function loadTranscriptsFromXlsx() {
  // 直接用 python 预跑好的 transcripts.json 作为来源（如果存在）
  try {
    const raw = readFileSync(join(__dirname, 'transcripts.json'), 'utf8');
    const d = JSON.parse(raw);
    const map = new Map();
    for (const c of d.courses) map.set(c.title, c);
    return map;
  } catch {
    return null;
  }
}

// ============ upsert 逻辑 ============

async function upsertScenario(s) {
  const existing = await pool.query(
    'select id from training_scenarios where title = $1 and deleted_at is null',
    [s.title]
  );
  if (existing.rows[0]) {
    await pool.query(
      `update training_scenarios set
         category=$2, role_persona=$3::jsonb, initial_message=$4,
         evaluation_rubric=$5::jsonb, success_criteria=$6::jsonb,
         is_builtin=$7, updated_at=now()
       where id=$1`,
      [
        existing.rows[0].id,
        s.category,
        JSON.stringify(s.role_persona),
        s.initial_message,
        JSON.stringify(s.evaluation_rubric),
        JSON.stringify(s.success_criteria),
        s.is_builtin,
      ]
    );
    return existing.rows[0].id;
  }
  const r = await pool.query(
    `insert into training_scenarios
      (title, category, role_persona, initial_message, evaluation_rubric,
       success_criteria, is_builtin)
     values ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7)
     returning id`,
    [
      s.title,
      s.category,
      JSON.stringify(s.role_persona),
      s.initial_message,
      JSON.stringify(s.evaluation_rubric),
      JSON.stringify(s.success_criteria),
      s.is_builtin,
    ]
  );
  return r.rows[0].id;
}

async function upsertCourse(c, transcriptMap) {
  const transcriptData = transcriptMap?.get(c.title);
  const rawTranscript = transcriptData?.transcript || null;
  const rawSegments = transcriptData?.segments || null;

  const existing = await pool.query(
    'select id from training_courses where title = $1 and deleted_at is null',
    [c.title]
  );
  if (existing.rows[0]) {
    await pool.query(
      `update training_courses set
         category=$2, duration_min=$3, raw_transcript=$4, raw_segments=$5::jsonb,
         outline=$6::jsonb, key_takeaways=$7::jsonb, source_ref=$8,
         status='published', updated_at=now()
       where id=$1`,
      [
        existing.rows[0].id,
        c.category,
        c.duration_min,
        rawTranscript,
        JSON.stringify(rawSegments),
        JSON.stringify(c.outline),
        JSON.stringify(c.key_takeaways),
        c.source_ref,
      ]
    );
    return existing.rows[0].id;
  }
  const r = await pool.query(
    `insert into training_courses
      (title, category, duration_min, raw_transcript, raw_segments,
       outline, key_takeaways, source_ref, status)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,'published')
     returning id`,
    [
      c.title,
      c.category,
      c.duration_min,
      rawTranscript,
      JSON.stringify(rawSegments),
      JSON.stringify(c.outline),
      JSON.stringify(c.key_takeaways),
      c.source_ref,
    ]
  );
  return r.rows[0].id;
}

async function main() {
  const transcriptMap = await loadTranscriptsFromXlsx();
  if (!transcriptMap) {
    console.warn('⚠ 未找到 scripts/training/transcripts.json，将只入结构化内容不含原始稿');
  }

  console.log('→ 写入 2 个情景练习…');
  for (const s of SCENARIOS) {
    const id = await upsertScenario(s);
    console.log(`  ✓ scenario id=${id}: ${s.title}`);
  }

  console.log('\n→ 写入 3 门课程…');
  for (const c of COURSES) {
    const id = await upsertCourse(c, transcriptMap);
    console.log(`  ✓ course id=${id}: ${c.title}`);
  }

  console.log('\n✅ 完成');
  await pool.end();
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
