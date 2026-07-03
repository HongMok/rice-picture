import { put } from '@vercel/blob';

// 把 DashScope 临时图（24h 过期）转存为永久存储。
// 优先 Vercel Blob（配了 token）；否则退回数据库 base64 兜底。
// 图库复用依赖持久化：只有永久地址才能跨天/跨局复用。

const ALIYUN_RE = /^https:\/\/[\w.-]*aliyuncs\.com\//;

/** 是否配置了 Vercel Blob 令牌 */
export function hasBlobToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** 拉取临时图并转成 base64 data URL（数据库兜底存储用） */
export async function fetchAsDataUrl(dashscopeUrl: string): Promise<string> {
  if (!ALIYUN_RE.test(dashscopeUrl)) throw new Error('非法图片来源地址');
  const upstream = await fetch(dashscopeUrl, { cache: 'no-store' });
  if (!upstream.ok) throw new Error(`拉取原图失败 (HTTP ${upstream.status})`);
  const contentType = upstream.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await upstream.arrayBuffer());
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

export async function persistImage(
  dashscopeUrl: string,
  pathHint: string
): Promise<string> {
  if (!ALIYUN_RE.test(dashscopeUrl)) {
    throw new Error('非法图片来源地址');
  }
  const upstream = await fetch(dashscopeUrl, { cache: 'no-store' });
  if (!upstream.ok) {
    throw new Error(`拉取原图失败 (HTTP ${upstream.status})`);
  }
  const contentType = upstream.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  const buf = await upstream.arrayBuffer();

  // 随机后缀避免同名覆盖（Date.now 在部分运行时受限，用随机串）
  const rand = Math.random().toString(36).slice(2, 10);
  const safeHint = pathHint.replace(/[^\w-]/g, '_').slice(0, 40);
  const { url } = await put(`assets/${safeHint}-${rand}.${ext}`, buf, {
    access: 'public',
    contentType,
  });
  return url;
}
