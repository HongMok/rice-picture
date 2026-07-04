// 一次性脚本：把 templates / template_pages 里过期的 DashScope 临时链接，
// 用原 prompt 重新抽一张，转存到 Vercel Blob，写回 DB。
//
// 前置：
//   .env.local 里需要有
//     - DASHSCOPE_API_KEY
//     - BLOB_READ_WRITE_TOKEN  （Vercel Blob store 的读写 token）
//     - POSTGRES_URL / DATABASE_URL / POSTGRES_PRISMA_URL 之一
//
// 用法：
//   node scripts/refresh-template-covers.mjs         # 只处理 dashscope 域名的（默认）
//   node scripts/refresh-template-covers.mjs --all   # 强制处理全部模板（含已在 Blob 上的）
//   node scripts/refresh-template-covers.mjs --ids 46,47,48   # 指定 template id
//
// 说明：只有 templates 表里 kind=image 的绘制单张封面；kind=book 的会：
//   1) 先把 template_pages 每一页重新出图 + 存 Blob，更新 image_url；
//   2) 把 templates.cover_url 更新为第 0 页封面。
//
// 幂等：跑失败可再跑；每次调用都会重新出图（不去比对）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { put } from '@vercel/blob';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const KEY = process.env.DASHSCOPE_API_KEY;
const BLOB = process.env.BLOB_READ_WRITE_TOKEN;
const PG =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;
if (!KEY) fail('缺少 DASHSCOPE_API_KEY');
if (!BLOB) fail('缺少 BLOB_READ_WRITE_TOKEN（去 Vercel → Storage → Blob 建一个）');
if (!PG) fail('缺少数据库连接串');

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE_ALL = args.includes('--all');
const idsArg = args.find((a) => a.startsWith('--ids'));
const FIXED_IDS = idsArg
  ? (idsArg.split('=')[1] || args[args.indexOf('--ids') + 1] || '')
      .split(',')
      .map((n) => Number(n.trim()))
      .filter(Boolean)
  : null;

const NEG =
  '文字，字母，水印，logo，霓虹色，高饱和，塑料感，3D渲染，恐怖，暴力，多余的手指，畸形';

// 与运行时一致的域名判定：dashscope OSS 域为临时地址；非该域视为已持久化
const ALIYUN_RE = /aliyuncs\.com/i;
const isEphemeral = (url) => !!url && ALIYUN_RE.test(url);

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
  if (!r.ok || !d.output?.task_id)
    throw new Error(d.message || `HTTP ${r.status}`);
  return d.output.task_id;
}

async function pollTask(taskId) {
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const r = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${KEY}` } }
    );
    const d = await r.json();
    const st = d.output?.task_status;
    if (st === 'SUCCEEDED') return d.output.results?.[0]?.url;
    if (st === 'FAILED') throw new Error(d.output?.message || 'FAILED');
  }
  throw new Error('轮询超时');
}

async function persistToBlob(dashscopeUrl, hint) {
  const upstream = await fetch(dashscopeUrl, { cache: 'no-store' });
  if (!upstream.ok) throw new Error(`拉图失败 (HTTP ${upstream.status})`);
  const contentType = upstream.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  const buf = await upstream.arrayBuffer();
  const rand = Math.random().toString(36).slice(2, 10);
  const safe = String(hint || '').replace(/[^\w-]/g, '_').slice(0, 40);
  const { url } = await put(`assets/${safe}-${rand}.${ext}`, buf, {
    access: 'public',
    contentType,
    token: BLOB,
  });
  return url;
}

async function genOne(prompt, hint) {
  const url = await retry(async () => {
    const tid = await createTask(prompt);
    return await pollTask(tid);
  }, '生图');
  await sleep(800);
  const blobUrl = await retry(() => persistToBlob(url, hint), '存 Blob');
  return blobUrl;
}

async function main() {
  const clause = FIXED_IDS
    ? `where id = any($1)`
    : FORCE_ALL
    ? ''
    : `where cover_url is null or cover_url ~ 'aliyuncs\\.com'`;
  const params = FIXED_IDS ? [FIXED_IDS] : [];
  const { rows: templates } = await pool.query(
    `select id, kind, title, prompt, cover_url from templates ${clause}
       order by sort asc, id asc`,
    params
  );

  if (!templates.length) {
    console.log('没有需要刷新的模板。');
    await pool.end();
    return;
  }

  console.log(`将刷新 ${templates.length} 个模板：\n`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    process.stdout.write(`[${i + 1}/${templates.length}] ${t.title} … `);

    try {
      if (t.kind === 'book') {
        // 绘本模板：处理每一页
        const { rows: pages } = await pool.query(
          `select id, page_index, image_url from template_pages
            where template_id = $1 order by page_index asc`,
          [t.id]
        );
        // 需要重跑的页 = 空 image_url 或 aliyuncs
        const targets = FORCE_ALL || FIXED_IDS
          ? pages
          : pages.filter((p) => isEphemeral(p.image_url) || !p.image_url);
        if (!targets.length && !isEphemeral(t.cover_url)) {
          console.log('无过期，跳过');
          continue;
        }
        let firstUrl = null;
        for (const p of targets) {
          const scenePrompt = t.prompt || t.title;
          const u = await genOne(
            scenePrompt,
            `tpl${t.id}-p${p.page_index}`
          );
          await pool.query(
            `update template_pages set image_url = $1 where id = $2`,
            [u, p.id]
          );
          if (p.page_index === 0) firstUrl = u;
          process.stdout.write(`${p.page_index} `);
        }
        // 更新封面（第 0 页；若第 0 页不在 targets 里，就直接查现存图）
        if (!firstUrl) {
          const { rows } = await pool.query(
            `select image_url from template_pages
              where template_id = $1 and page_index = 0`,
            [t.id]
          );
          firstUrl = rows[0]?.image_url;
        }
        if (firstUrl) {
          await pool.query(
            `update templates set cover_url = $1 where id = $2`,
            [firstUrl, t.id]
          );
        }
      } else {
        // 图卡模板：单张封面
        const url = await genOne(t.prompt || t.title, `tpl${t.id}-cover`);
        await pool.query(`update templates set cover_url = $1 where id = $2`, [
          url,
          t.id,
        ]);
      }
      console.log('✓');
      ok++;
    } catch (e) {
      console.log('✗', e.message);
      fail++;
    }
  }

  console.log(`\n完成：成功 ${ok}，失败 ${fail}`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
