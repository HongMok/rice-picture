// 追加式新增模板：从 JSON 文件读新模板，逐个生成入库，不删除已有模板。
// 图片模板生成单张封面；绘本模板用 qwen 写文拆页 + 逐页生图存 template_pages。
// 已存在同名(title)模板会跳过。
//
// 用法:
//   node scripts/add-templates.mjs <模板JSON文件路径>
//   环境变量 POSTGRES_URL / DASHSCOPE_API_KEY（默认读 .env.local；线上用 vercel env pull 后传入）
//
// JSON 文件格式（数组）：
// [
//   { "kind":"image", "topic":"language", "style":"flat",
//     "title":"数字卡", "subtitle":"数字认知",
//     "brief":"数字1到5", "scene":"数字1到5排成一排，色彩清晰" },
//   { "kind":"book", "topic":"social", "style":"watercolor",
//     "title":"学会道歉", "subtitle":"4页绘本",
//     "brief":"小狐狸不小心弄坏朋友的东西，学会说对不起",
//     "scene":"一只小狐狸对朋友道歉，温馨场景", "pageCount":4 }
// ]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读 .env.local（若环境变量未直接提供）
try {
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const KEY = process.env.DASHSCOPE_API_KEY;
const PG =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
if (!KEY || !PG) {
  console.error('❌ 缺少 DASHSCOPE_API_KEY 或 数据库连接串');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('❌ 用法: node scripts/add-templates.mjs <模板JSON文件>');
  process.exit(1);
}

let items;
try {
  items = JSON.parse(readFileSync(resolve(file), 'utf8'));
  if (!Array.isArray(items)) throw new Error('JSON 顶层必须是数组');
} catch (e) {
  console.error('❌ 读取模板 JSON 失败:', e.message);
  process.exit(1);
}

// 风格后缀（与 src/data/taxonomy.ts 一致）
const STYLE = {
  warm: '温暖柔和的手绘儿童插画风格，蜡笔与水彩质感，暖色调，圆润友好，光线柔和，构图简洁，适合特需儿童；不要出现任何文字、字母或水印；不要霓虹色、不要塑料质感、不要3D渲染。',
  flat: '扁平化矢量插画风格，简洁干净，低饱和柔和配色，粗细均匀的描边，单一主体居中，适合教学图卡；画面内不要任何文字、字母或水印。',
  watercolor: '柔美水彩插画风格，晕染质感，温柔淡雅的色彩，充满童趣，画面温馨；不要任何文字、字母或水印，不要3D渲染。',
  line: '极简黑白线描插画，粗细均匀的黑色描边，纯白背景，单一主体居中，简洁清晰，适合特需儿童视觉教学；画面内不要任何文字、字母或水印。',
};
const NEG = '文字，字母，水印，logo，霓虹色，高饱和，塑料感，3D渲染，恐怖，暴力，多余的手指，畸形';
const VALID_TOPIC = ['language', 'social', 'selfcare', 'cognition'];
const VALID_KIND = ['image', 'book'];

// 校验
for (const [i, t] of items.entries()) {
  const err = [];
  if (!VALID_KIND.includes(t.kind)) err.push(`kind 必须是 image/book`);
  if (!VALID_TOPIC.includes(t.topic)) err.push(`topic 必须是 ${VALID_TOPIC.join('/')}`);
  if (!STYLE[t.style]) err.push(`style 必须是 ${Object.keys(STYLE).join('/')}`);
  if (!t.title) err.push('缺 title');
  if (!t.brief) err.push('缺 brief');
  if (!t.scene) err.push('缺 scene');
  if (err.length) {
    console.error(`❌ 第 ${i + 1} 条「${t.title || '?'}」: ${err.join('；')}`);
    process.exit(1);
  }
}

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(PG);
const pool = new pg.Pool({
  connectionString: PG,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, label, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      process.stdout.write(`(${label}重试${i + 1}) `);
      await sleep(2000 * (i + 1));
    }
  }
  throw last;
}

async function createTask(prompt) {
  const r = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.1-t2i-turbo',
        input: { prompt: prompt.slice(0, 500), negative_prompt: NEG },
        parameters: { size: '1280*960', n: 1 },
      }),
    }
  );
  const d = await r.json();
  if (!r.ok || !d.output?.task_id) throw new Error(d.message || `HTTP ${r.status}`);
  return d.output.task_id;
}

async function pollTask(taskId) {
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const r = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const d = await r.json();
    const st = d.output?.task_status;
    if (st === 'SUCCEEDED') return d.output.results?.[0]?.url;
    if (st === 'FAILED') throw new Error(d.output?.message || 'FAILED');
  }
  throw new Error('轮询超时');
}

async function genImage(prompt) {
  const url = await retry(async () => {
    const taskId = await createTask(prompt);
    return await pollTask(taskId);
  }, '生图');
  await sleep(1200);
  return url;
}

async function writeStory(brief, pageCount) {
  const system =
    '你是擅长为特需儿童创作绘本的作者。语言简单、具体、正面，句子短。必须严格输出 JSON，不要多余文字或代码块。';
  const user = [
    `请把这个故事想法扩写成一个完整绘本，正好 ${pageCount} 页：${brief}`,
    '每页含 text（1~2 句简短中文正文）与 scene（该页画面描述，用于绘画，含人物动作场景情绪，画面里不要文字）。',
    '全书角色形象保持一致（在每个 scene 里重复描述主角外貌）。',
    `输出：{"title":"标题","pages":[{"text":"...","scene":"..."}]}，pages 长度正好 ${pageCount}。`,
  ].join('\n');
  const r = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `写文失败 HTTP ${r.status}`);
  const content = d?.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1));
  const pages = (parsed.pages || [])
    .map((p) => ({ scene: String(p.scene || '').trim(), text: String(p.text || '').trim() }))
    .filter((p) => p.scene || p.text)
    .slice(0, pageCount);
  return { title: String(parsed.title || brief).slice(0, 60), pages };
}

async function main() {
  // 下一个 sort 值（接在已有之后）
  const { rows: sr } = await pool.query('select coalesce(max(sort),0) as m from templates');
  let sort = Number(sr[0].m);

  let added = 0,
    skipped = 0;
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${t.title} … `);

    // 去重：同 title 已存在则跳过
    const { rows: ex } = await pool.query('select id from templates where title = $1', [
      t.title,
    ]);
    if (ex.length) {
      console.log('已存在，跳过');
      skipped++;
      continue;
    }

    try {
      sort++;
      const prompt = `${t.scene}。${STYLE[t.style]}`;
      const cover = await genImage(prompt);
      const row = await pool.query(
        `insert into templates (kind, topic, style_key, title, subtitle, brief, options, prompt, cover_url, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [
          t.kind,
          t.topic,
          t.style,
          t.title,
          t.subtitle || null,
          t.brief,
          t.kind === 'book' ? { pageCount: t.pageCount || 4 } : {},
          prompt,
          cover,
          sort,
        ]
      );
      const templateId = row.rows[0].id;

      if (t.kind === 'book') {
        const pageCount = t.pageCount || 4;
        process.stdout.write('写文… ');
        const story = await retry(() => writeStory(t.brief, pageCount), '写文');
        await pool.query('update templates set title = $1 where id = $2', [
          story.title || t.title,
          templateId,
        ]);
        let done = 0;
        for (let pi = 0; pi < story.pages.length; pi++) {
          const p = story.pages[pi];
          try {
            const url = await genImage(`${p.scene}。${STYLE[t.style]}`);
            await pool.query(
              `insert into template_pages (template_id, page_index, text, image_url)
               values ($1,$2,$3,$4)`,
              [templateId, pi, p.text, url]
            );
            if (pi === 0)
              await pool.query('update templates set cover_url = $1 where id = $2', [
                url,
                templateId,
              ]);
            done++;
          } catch {}
        }
        process.stdout.write(`${done}/${story.pages.length}页 `);
      }
      console.log('✓');
      added++;
    } catch (e) {
      console.log('✗', e.message);
    }
  }

  console.log(`\n✅ 完成：新增 ${added} 个，跳过 ${skipped} 个（已存在）`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
