// 把 transcripts.json 里的课程用 qwen 结构化后入库到 training_courses。
// 也顺便生成每门课 5-8 道选择题入库到 training_questions。
// 用法:
//   1) 先跑 python3 scripts/training/extract-transcripts.py > scripts/training/transcripts.json
//   2) 再跑 node scripts/training/import-courses.mjs
//
// 可选参数:
//   --only "ABA是什么"   只处理某一门（模糊匹配 title）
//   --skip-outline       跳过结构化，只做题库
//   --skip-questions     跳过题库，只做结构化

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读 .env.local
try {
  const envLocal = readFileSync(join(__dirname, '..', '..', '.env.local'), 'utf8');
  for (const line of envLocal.split('\n')) {
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
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
if (!DASHSCOPE_KEY) {
  console.error('❌ 缺少 DASHSCOPE_API_KEY（.env.local）');
  process.exit(1);
}

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(connectionString);
const pool = new pg.Pool({
  connectionString,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

// -----------------------------
// CLI 参数
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const skipOutline = argv.includes('--skip-outline');
const skipQuestions = argv.includes('--skip-questions');

// -----------------------------
// qwen chat 调用

const QWEN_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

async function qwenChatJson({ messages, model = 'qwen-max', temperature = 0.4, maxTokens = 4000 }) {
  const res = await fetch(`${QWEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型无返回');
  const finish = data?.choices?.[0]?.finish_reason;
  if (finish === 'length') {
    throw new Error(`响应被截断（finish_reason=length，长度 ${content.length}）请缩短输出或加大 max_tokens`);
  }
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  const slice = s >= 0 && e > s ? raw.slice(s, e + 1) : raw;
  try {
    return JSON.parse(slice);
  } catch (err) {
    // Debug: 打印失败位置附近的内容
    console.error('  ⚠ JSON 解析失败，内容长度=', slice.length, 'finish=', finish);
    throw err;
  }
}

// -----------------------------
// 提示词

function outlinePrompt(course) {
  const example = {
    outline: [
      {
        title: '什么是 ABA',
        start_sec: 0,
        summary:
          'ABA 全称 Applied Behavior Analysis，中文是应用行为分析。它是一门研究人类行为的科学，不是一门课程，也不是一种药物。ABA 常被用于提高特需儿童的认知、语言、社交和生活自理能力。',
        key_points: ['ABA 是一门行为科学', 'ABA 用于增加正向行为、减少问题行为'],
      },
      {
        title: '应用行为分析的三个关键词',
        start_sec: 90,
        summary:
          'ABA 三个关键词：应用、行为、分析。"应用"意味着研究要有社会意义；"行为"指的是可观察、可测量的外显行为，不包括内在情绪；"分析"指通过对行为数据的记录和分析，找到行为与环境之间的关系。',
        key_points: ['应用 = 社会意义', '行为 = 可观察可测量', '分析 = 数据驱动'],
      },
      {
        title: 'ABA 教学的目标',
        start_sec: 180,
        summary:
          '在康复干预中，ABA 主要用于两个目标：一是增加想要的行为（如刷牙、说要、和同伴互动）；二是减少不想要的问题行为（如自伤、攻击）。这两个目标通过对环境刺激和后果的精细安排来实现。',
        key_points: ['增加正向行为', '减少问题行为', '通过环境安排达成目标'],
      },
    ],
    key_takeaways: [
      '理解 ABA 是行为科学而非药物',
      '掌握 ABA 三个关键词的含义',
      '识别 ABA 教学的两个核心目标',
      '区分外显行为与内在心理活动',
      '认识 ABA 在康复中的应用场景',
    ],
  };

  return [
    {
      role: 'system',
      content: [
        '你是康复师培训课程编辑。任务：把语音转写稿改写成结构化学习稿。',
        '原稿有 AI 转写错字（如"aba"实为 ABA、"d滴T"实为 DTT），请纠错。',
        '',
        '规则：',
        '1. outline 数组长度 3-6 章。短课至少切 3 章。',
        '2. 每章的 summary 是 80-160 汉字的书面语，去掉口语词（呃嗯就是说）。',
        '3. 每章的 key_points 是字符串数组，2-4 条，每条 <20 字。',
        '4. key_takeaways 是字符串数组，5-6 条，动词开头。放在顶层，不放在 outline 里。',
        '5. 只输出 JSON 对象，不要 markdown。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: '示例：给一门"ABA 是什么"的课改写学习稿。',
    },
    {
      role: 'assistant',
      content: JSON.stringify(example),
    },
    {
      role: 'user',
      content: [
        '很好。用同样的结构和风格，为下面这门课改写学习稿：',
        '',
        `【课程标题】${course.title}`,
        `【课程分类】${course.category}`,
        '',
        '【逐字稿】',
        course.transcript,
      ].join('\n'),
    },
  ];
}

/** 结构化结果的宽容归一化 —— 修正常见的 AI 输出偏差 */
function normalizeOutline(raw) {
  const outline = [];
  const outlineRaw = Array.isArray(raw?.outline) ? raw.outline : [];
  for (const s of outlineRaw) {
    if (!s || typeof s !== 'object') continue;
    const kp = s.key_points;
    let key_points = [];
    if (Array.isArray(kp)) {
      key_points = kp.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6);
    } else if (typeof kp === 'string' && kp.trim()) {
      // AI 有时返回逗号/顿号分隔的字符串
      key_points = kp
        .split(/[,;；、\n]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    outline.push({
      title: String(s.title || '').trim().slice(0, 40),
      start_sec: Number(s.start_sec) || 0,
      summary: String(s.summary || '').trim(),
      key_points,
    });
  }

  let key_takeaways = [];
  if (Array.isArray(raw?.key_takeaways)) {
    key_takeaways = raw.key_takeaways.filter((x) => typeof x === 'string' && x.trim()).slice(0, 10);
  } else if (typeof raw?.key_takeaways === 'string') {
    key_takeaways = raw.key_takeaways
      .split(/[,;；、\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return { outline: outline.filter((s) => s.title && s.summary), key_takeaways };
}

function questionsPrompt(course, outline) {
  const outlineText = outline
    .map((s, i) => `${i + 1}. ${s.title}: ${(s.summary || '').slice(0, 200)}`)
    .join('\n');
  const kpHint = course.knowledge_tags?.length
    ? `【本课知识点标签建议】${course.knowledge_tags.join('、')}`
    : '';

  // 完整示例题（帮助模型理解结构）
  const example = {
    questions: [
      {
        type: 'single',
        difficulty: 'easy',
        stem: '关于 ABA，下列哪个说法是正确的？',
        options: [
          { key: 'A', text: 'ABA 是一门课程', is_correct: false, explain: '错，ABA 是一门科学与方法' },
          { key: 'B', text: 'ABA 是应用行为分析', is_correct: true, explain: 'ABA 全称 Applied Behavior Analysis' },
          { key: 'C', text: 'ABA 主要研究情绪', is_correct: false, explain: 'ABA 只研究可观察的外显行为' },
          { key: 'D', text: 'ABA 是一种药物', is_correct: false, explain: '错，ABA 是行为科学' },
        ],
        knowledge_points: ['ABA 定义'],
      },
      {
        type: 'judge',
        difficulty: 'easy',
        stem: 'ABA 研究的是可以被观察和测量的行为。',
        options: [
          { key: 'A', text: '正确', is_correct: true, explain: '内在的想法和情绪不在研究范围内' },
          { key: 'B', text: '错误', is_correct: false, explain: '与定义不符' },
        ],
        knowledge_points: ['ABA 定义'],
      },
    ],
  };

  return [
    {
      role: 'system',
      content: [
        '你是康复师培训测评的出题专家。为课程出 5 道选择题。',
        '',
        '规则：',
        '- 单选(single)题目有 4 个选项 A/B/C/D，正好 1 个正确。',
        '- 判断(judge)题目只有 2 个选项 A.正确 / B.错误。',
        '- 5 道题 = 3 道 single + 2 道 judge。',
        '- 难度分布：2 道 easy + 2 道 medium + 1 道 hard。',
        '- 每个选项的 explain 简短（< 30 字）。',
        '- 只输出 JSON 对象，不要 markdown 代码块。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: '示例课程"ABA 是什么"应该出这样的题：',
    },
    {
      role: 'assistant',
      content: JSON.stringify(example),
    },
    {
      role: 'user',
      content: [
        '很好。现在按同样的结构，为下面这门课出 5 题：',
        '',
        `【课程】${course.title}（${course.category}）`,
        kpHint,
        '',
        '【章节】',
        outlineText,
      ].join('\n'),
    },
  ];
}

// -----------------------------
// 主流程

async function upsertCourse(course, outline, keyTakeaways) {
  const durationMin = course.segments?.length
    ? Math.round(course.segments[course.segments.length - 1].end_time / 1000 / 60)
    : null;

  const existing = await pool.query(
    'select id from training_courses where title = $1 and deleted_at is null',
    [course.title]
  );
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `update training_courses set
         category = $2,
         duration_min = $3,
         raw_transcript = $4,
         raw_segments = $5::jsonb,
         outline = $6::jsonb,
         key_takeaways = $7::jsonb,
         source_ref = $8,
         status = 'published',
         updated_at = now()
       where id = $1`,
      [
        id,
        course.category,
        durationMin,
        course.transcript,
        JSON.stringify(course.segments || null),
        JSON.stringify(outline),
        JSON.stringify(keyTakeaways),
        course.source_ref,
      ]
    );
    return id;
  }
  const inserted = await pool.query(
    `insert into training_courses
       (title, category, duration_min, raw_transcript, raw_segments,
        outline, key_takeaways, source_ref, status)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,'published')
     returning id`,
    [
      course.title,
      course.category,
      durationMin,
      course.transcript,
      JSON.stringify(course.segments || null),
      JSON.stringify(outline),
      JSON.stringify(keyTakeaways),
      course.source_ref,
    ]
  );
  return inserted.rows[0].id;
}

async function replaceCourseQuestions(courseId, category, questions) {
  // 先软删旧题
  await pool.query(
    `update training_questions set deleted_at = now()
       where related_course_id = $1 and deleted_at is null`,
    [courseId]
  );
  let inserted = 0;
  let skipped = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') { skipped++; continue; }
    if (!q.stem) { skipped++; console.log('    skip: no stem', JSON.stringify(q).slice(0, 100)); continue; }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      skipped++;
      console.log('    skip: bad options', JSON.stringify(q.options).slice(0, 100));
      continue;
    }
    // 确保选项字段完整
    const opts = q.options.map((o, i) => ({
      key: String(o.key || String.fromCharCode(65 + i)),
      text: String(o.text || o.content || ''),
      is_correct: !!o.is_correct,
      explain: String(o.explain || o.explanation || ''),
    }));
    // 至少要有一个正确答案
    if (!opts.some((o) => o.is_correct)) {
      skipped++;
      console.log('    skip: no correct answer');
      continue;
    }
    await pool.query(
      `insert into training_questions
        (related_course_id, category, difficulty, type, stem, options,
         knowledge_points, source_ref, status)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,'published')`,
      [
        courseId,
        category,
        q.difficulty || 'medium',
        q.type || 'single',
        q.stem,
        JSON.stringify(opts),
        JSON.stringify(q.knowledge_points || []),
        null,
      ]
    );
    inserted++;
  }
  return { inserted, skipped };
}

async function processCourse(course) {
  console.log(`\n=== ${course.title} (${course.category}) ===`);
  console.log(`  逐字稿 ${course.transcript.length} 字, segments ${course.segments?.length ?? 0}`);

  let outline = [];
  let keyTakeaways = [];

  // 结构化
  if (!skipOutline) {
    console.log('  → 调用 qwen-max 结构化…');
    try {
      const r = await qwenChatJson({
        messages: outlinePrompt(course),
        temperature: 0.2,
        maxTokens: 8000,
      });
      const norm = normalizeOutline(r);
      outline = norm.outline;
      keyTakeaways = norm.key_takeaways;
      if (outline.length === 0) {
        console.error('  ⚠ 原始返回 outline 数组长度:', Array.isArray(r?.outline) ? r.outline.length : 'not-array');
        console.error('  ⚠ 原始返回:', JSON.stringify(r).slice(0, 500));
        throw new Error('结构化后 outline 为空');
      }
      if (outline.length < 3) {
        console.error('  ⚠ outline 章节数 =', outline.length, '偏少，原始返回长度:', Array.isArray(r?.outline) ? r.outline.length : '?');
      }
      console.log(`  ✓ 结构化完成: ${outline.length} 章, ${keyTakeaways.length} 条 takeaway`);
    } catch (e) {
      console.error(`  ✗ 结构化失败: ${e.message}`);
      return;
    }
  } else {
    // skip 时先拉旧记录用于出题
    const existing = await pool.query(
      'select outline, key_takeaways from training_courses where title = $1',
      [course.title]
    );
    if (existing.rows[0]) {
      outline = existing.rows[0].outline || [];
      keyTakeaways = existing.rows[0].key_takeaways || [];
    }
  }

  // 入库课程
  const courseId = await upsertCourse(course, outline, keyTakeaways);
  console.log(`  ✓ 入库课程 id=${courseId}`);

  // 出题
  if (!skipQuestions && outline.length > 0) {
    console.log('  → 调用 qwen-max 出题…');
    try {
      const r = await qwenChatJson({
        messages: questionsPrompt(course, outline),
        temperature: 0.3,
        maxTokens: 6000,
      });
      const qs = Array.isArray(r?.questions) ? r.questions : [];
      if (qs.length === 0) {
        console.error('  ⚠ AI 返回 questions 数组为空，返回顶层 keys:', Object.keys(r || {}));
        console.error('  ⚠ 前 400 字:', JSON.stringify(r).slice(0, 400));
      } else {
        // 打第一题看看结构
        console.error('  ℹ 第一题结构:', JSON.stringify(qs[0]).slice(0, 200));
      }
      const { inserted, skipped } = await replaceCourseQuestions(courseId, course.category, qs);
      console.log(`  ✓ 入库题目 ${inserted} 题（跳过 ${skipped} 题）`);
    } catch (e) {
      console.error(`  ✗ 出题失败: ${e.message}`);
    }
  }
}

async function main() {
  const raw = readFileSync(join(__dirname, 'transcripts.json'), 'utf8');
  const { courses } = JSON.parse(raw);
  const target = only ? courses.filter((c) => c.title.includes(only)) : courses;
  console.log(`共 ${target.length} 门课待处理`);

  for (const c of target) {
    await processCourse(c);
  }

  console.log('\n✅ 完成');
  await pool.end();
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
