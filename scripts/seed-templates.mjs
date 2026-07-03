// 预生成模板缩略图并写入 templates 表。
// 顺序生成 + 间隔，规避 DashScope 并发限流(429)。
// 用法: node scripts/seed-templates.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读取 .env.local
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
  console.error('❌ 缺少 DASHSCOPE_API_KEY 或 数据库连接串（POSTGRES_URL / DATABASE_URL）');
  process.exit(1);
}

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(PG);
const pool = new pg.Pool({
  connectionString: PG,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

// 风格后缀（与 src/data/taxonomy.ts 保持一致）
const STYLE = {
  warm: '温暖柔和的手绘儿童插画风格，蜡笔与水彩质感，暖色调，圆润友好，光线柔和，构图简洁，适合特需儿童；不要出现任何文字、字母或水印；不要霓虹色、不要塑料质感、不要3D渲染。',
  flat: '扁平化矢量插画风格，简洁干净，低饱和柔和配色，粗细均匀的描边，单一主体居中，适合教学图卡；画面内不要任何文字、字母或水印。',
  watercolor: '柔美水彩插画风格，晕染质感，温柔淡雅的色彩，充满童趣，画面温馨；不要任何文字、字母或水印，不要3D渲染。',
  line: '极简黑白线描插画，粗细均匀的黑色描边，纯白背景，单一主体居中，简洁清晰，适合特需儿童视觉教学；画面内不要任何文字、字母或水印。',
};
const NEG = '文字，字母，水印，logo，霓虹色，高饱和，塑料感，3D渲染，恐怖，暴力，多余的手指，畸形';

// 模板定义：图片 与 绘本 各自覆盖 4 个康复课题，每课题 2-3 张，风格分散。
const TEMPLATES = [
  /* ===================== 图片模板 ===================== */
  // 语言沟通
  { kind: 'image', topic: 'language', style: 'flat', title: '水果词汇卡', subtitle: '常见水果认知', brief: '一个红苹果，单一主体，居中', scene: '一个红苹果，单一主体居中，形象清晰易辨认' },
  { kind: 'image', topic: 'language', style: 'line', title: '动物词汇卡', subtitle: '常见动物认知', brief: '一只可爱的小猫，完整身体', scene: '一只可爱的小猫，完整身体居中，形象清晰' },
  { kind: 'image', topic: 'language', style: 'warm', title: '“我想要”表达卡', subtitle: '需求表达', brief: '小朋友伸手指向一杯水，表达想要', scene: '一个小朋友微笑着伸手指向桌上的一杯水，表现“我想要”的请求动作' },
  // 社交交往
  { kind: 'image', topic: 'social', style: 'warm', title: '轮流等待', subtitle: '排队与轮流', brief: '小朋友在滑梯前安静排队等待', scene: '一个小朋友在滑梯前安静地排队等待，双手自然下垂，表情平静耐心，前面还有一个小朋友' },
  { kind: 'image', topic: 'social', style: 'flat', title: '打招呼', subtitle: '主动社交', brief: '两个小朋友微笑挥手打招呼', scene: '两个小朋友面对面微笑挥手打招呼，友好互动' },
  { kind: 'image', topic: 'social', style: 'watercolor', title: '目光对视', subtitle: '眼神接触', brief: '两个小朋友对视微笑交流', scene: '两个小朋友面对面对视微笑，眼神友好交流' },
  // 生活自理
  { kind: 'image', topic: 'selfcare', style: 'flat', title: '刷牙步骤', subtitle: 'PECS 流程卡', brief: '小朋友上下刷牙的动作特写', scene: '一个小朋友站在洗手台前上下刷牙的动作特写，手部动作清晰' },
  { kind: 'image', topic: 'selfcare', style: 'flat', title: '洗手步骤', subtitle: 'PECS 流程卡', brief: '小朋友双手搓洗打泡沫', scene: '一双小朋友的手在洗手台前手心搓手心打泡沫，动作清晰易懂' },
  { kind: 'image', topic: 'selfcare', style: 'warm', title: '自己吃饭', subtitle: '进食自理', brief: '小朋友坐在餐桌前用勺子吃饭', scene: '一个小朋友坐在餐桌前，用勺子从碗里舀饭吃，姿势端正，表情愉快' },
  // 认知与精细动作
  { kind: 'image', topic: 'cognition', style: 'flat', title: '形状认知卡', subtitle: '几何形状', brief: '一个大大的圆形，居中', scene: '一个大大的圆形，居中，边缘清晰，简洁明了' },
  { kind: 'image', topic: 'cognition', style: 'flat', title: '颜色配对卡', subtitle: '颜色认知', brief: '几个不同颜色的气球排成一排', scene: '几个不同颜色的气球排成一排，色彩清晰，适合颜色认知' },
  { kind: 'image', topic: 'cognition', style: 'warm', title: '系扣子', subtitle: '精细动作', brief: '小朋友的手在给衣服系扣子', scene: '一个小朋友的手正在给衣服系上一颗扣子的特写，动作清晰' },

  /* ===================== 绘本模板 ===================== */
  // 语言沟通
  { kind: 'book', topic: 'language', style: 'watercolor', title: '爱说话的小鹦鹉', subtitle: '4页绘本', brief: '小鹦鹉学会用词语表达自己的需要', scene: '一只彩色小鹦鹉站在树枝上开心地张嘴说话，温馨自然的场景', options: { pageCount: 4 } },
  { kind: 'book', topic: 'language', style: 'warm', title: '我会说“谢谢”', subtitle: '4页绘本', brief: '小朋友学会在得到帮助时说谢谢', scene: '一个小朋友接过别人递来的东西，微笑着道谢，温暖的日常场景', options: { pageCount: 4 } },
  // 社交交往
  { kind: 'book', topic: 'social', style: 'watercolor', title: '学会分享玩具', subtitle: '4页绘本', brief: '小熊学会和朋友分享玩具', scene: '一只友好的小熊把玩具递给朋友，温馨分享的场景', options: { pageCount: 4 } },
  { kind: 'book', topic: 'social', style: 'warm', title: '一起做游戏', subtitle: '6页绘本', brief: '两个小动物一起合作玩游戏成为好朋友', scene: '两只可爱的小动物在草地上一起开心地玩游戏，友好合作', options: { pageCount: 6 } },
  // 生活自理
  { kind: 'book', topic: 'selfcare', style: 'watercolor', title: '第一次自己穿衣', subtitle: '4页绘本', brief: '小兔子第一次自己学穿衣服', scene: '一只可爱的小兔子在房间里学习自己穿衣服，温馨的晨间场景', options: { pageCount: 4 } },
  { kind: 'book', topic: 'selfcare', style: 'warm', title: '睡前要刷牙', subtitle: '4页绘本', brief: '小熊养成睡前刷牙的好习惯', scene: '一只小熊在浴室镜子前认真刷牙，温暖的睡前场景', options: { pageCount: 4 } },
  // 认知与精细动作
  { kind: 'book', topic: 'cognition', style: 'watercolor', title: '彩虹的颜色', subtitle: '6页绘本', brief: '小朋友跟着彩虹认识各种颜色', scene: '一个小朋友仰望天空中美丽的彩虹，色彩缤纷的温馨画面', options: { pageCount: 6 } },
  { kind: 'book', topic: 'cognition', style: 'warm', title: '数一数有几个', subtitle: '4页绘本', brief: '小松鼠数松果学会数数', scene: '一只可爱的小松鼠在树下数地上的松果，温馨自然的场景', options: { pageCount: 4 } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 通用重试：网络抖动/限流时退避重试
async function retry(fn, label, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const wait = 2000 * (i + 1);
      process.stdout.write(`(${label}重试${i + 1}/${tries}) `);
      await sleep(wait);
    }
  }
  throw lastErr;
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

// 生成一张图（提交 + 轮询），带重试与节流
async function genImage(prompt) {
  const url = await retry(async () => {
    const taskId = await createTask(prompt);
    return await pollTask(taskId);
  }, '生图');
  await sleep(1200);
  return url;
}

// 用 qwen-plus 写故事并拆页，返回 { title, pages:[{scene,text}] }
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
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
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
  const s = content.indexOf('{');
  const e = content.lastIndexOf('}');
  const parsed = JSON.parse(content.slice(s, e + 1));
  const pages = (parsed.pages || [])
    .map((p) => ({ scene: String(p.scene || '').trim(), text: String(p.text || '').trim() }))
    .filter((p) => p.scene || p.text)
    .slice(0, pageCount);
  return { title: String(parsed.title || brief).slice(0, 60), pages };
}

async function main() {
  console.log('→ 清空旧模板…');
  await pool.query('delete from templates');

  let i = 0;
  for (const t of TEMPLATES) {
    i++;
    const prompt = `${t.scene}。${STYLE[t.style]}`;
    process.stdout.write(`[${i}/${TEMPLATES.length}] ${t.title} … `);
    try {
      const url = await genImage(prompt); // 封面图
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
          t.options || {},
          prompt,
          url,
          i,
        ]
      );
      const templateId = row.rows[0].id;

      // 绘本模板：写故事拆页 + 逐页生图，存 template_pages
      if (t.kind === 'book') {
        const pageCount = t.options?.pageCount || 4;
        process.stdout.write(`写文… `);
        const story = await retry(() => writeStory(t.brief, pageCount), '写文');
        // 用故事标题回填模板标题（更贴合内容）
        await pool.query('update templates set title = $1 where id = $2', [
          story.title || t.title,
          templateId,
        ]);
        let done = 0;
        for (let pi = 0; pi < story.pages.length; pi++) {
          const p = story.pages[pi];
          try {
            const pageUrl = await genImage(`${p.scene}。${STYLE[t.style]}`);
            await pool.query(
              `insert into template_pages (template_id, page_index, text, image_url)
               values ($1,$2,$3,$4)`,
              [templateId, pi, p.text, pageUrl]
            );
            // 首页图兼作封面
            if (pi === 0) {
              await pool.query('update templates set cover_url = $1 where id = $2', [
                pageUrl,
                templateId,
              ]);
            }
            done++;
          } catch {
            /* 单页失败跳过 */
          }
        }
        process.stdout.write(`${done}/${story.pages.length}页 `);
      }
      console.log('✓');
    } catch (e) {
      console.log('✗', e.message);
    }
  }

  const { rows } = await pool.query('select count(*) from templates');
  console.log(`\n✅ 完成，共入库 ${rows[0].count} 个模板`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
