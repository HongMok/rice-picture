// 一次性脚本：为已有 templates 表补齐 system_prompt 字段。
// - 只覆盖 system_prompt IS NULL 或空串的记录（幂等，多次运行安全）
// - 按 (kind, topic) 二级分类映射到一份「专家级」画面/叙事约束
//
// 用法：
//   node scripts/backfill-template-system-prompt.mjs [--force]
//   --force：即使已有值也覆盖
//
// 依赖：POSTGRES_URL / DATABASE_URL / POSTGRES_PRISMA_URL（默认读 .env.local）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PG =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;
if (!PG) {
  console.error('❌ 缺少数据库连接串');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');

// —— 专家级 system_prompt 库 ——
// 关键点：面向特需儿童康复；构图/主体/负面词；不同课题(topic)+载体(kind)有微调。
const COMMON =
  '面向特需儿童教学使用；画面主体清晰居中，背景简洁纯净，颜色柔和不刺眼；情绪正向友好，角色表情容易辨识；画面不出现任何文字、字母、数字、水印、logo；不使用高饱和霓虹色、不出现暴力恐怖元素、不出现畸形肢体或多余手指。';

const TOPIC_HINT = {
  language:
    '主体是名词/动作对象，只出现一个主要物体或一个清晰动作；构图适合作为语言沟通图卡使用，便于命名和指认。',
  social:
    '场景包含清晰的社交动作与人物互动（如对视、微笑、分享、轮流、道歉），角色表情要能被特需儿童准确识别情绪。',
  selfcare:
    '呈现一个明确的自理步骤或行为（洗手/刷牙/穿衣/如厕等），步骤动作分解清楚、可被模仿，环境为儿童熟悉的家庭/教室场景。',
  cognition:
    '突出认知概念（形状/颜色/数量/大小/前后）或精细动作对象；主体在画面正中，比例清晰，方便儿童识别与比较。',
};

const KIND_HINT = {
  image:
    '构图适合作为单张图卡：一屏内只表达一个概念，视觉信息量克制，留白充足，主体占画面 60%~75%。',
  book:
    '每一页承担一个故事步骤，全书角色的外貌与服装严格保持一致；镜头景别以中景为主；每页只承载 1~2 句话可对应的画面。',
};

function buildSystemPrompt(kind, topic) {
  return [
    KIND_HINT[kind] || '',
    TOPIC_HINT[topic] || '',
    COMMON,
  ]
    .filter(Boolean)
    .join(' ');
}

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(PG);
const pool = new pg.Pool({
  connectionString: PG,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const whereEmpty = FORCE
    ? ''
    : `where system_prompt is null or trim(system_prompt) = ''`;
  const { rows } = await pool.query(
    `select id, kind, topic, title from templates ${whereEmpty} order by id asc`
  );
  if (!rows.length) {
    console.log('没有需要更新的模板。');
    await pool.end();
    return;
  }
  console.log(`将为 ${rows.length} 个模板写入 system_prompt${FORCE ? '（--force 覆盖已有值）' : ''}`);
  let ok = 0;
  for (const r of rows) {
    const sp = buildSystemPrompt(r.kind, r.topic);
    await pool.query('update templates set system_prompt = $1 where id = $2', [
      sp,
      r.id,
    ]);
    ok++;
    console.log(`  ✓ [${r.id}] ${r.title}`);
  }
  console.log(`\n完成，共更新 ${ok} 条。`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
