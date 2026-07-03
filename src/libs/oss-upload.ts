// 课堂视频上传：浏览器直传阿里云 OSS（公共读写桶，匿名 PUT 无需签名）
// 不经过 Vercel serverless 中转，避免大文件受限于请求体大小/时长。

const OSS_BASE = 'https://ai-study0701.oss-cn-beijing.aliyuncs.com';

export const OSS_RE = /^https:\/\/ai-study0701\.oss-cn-beijing\.aliyuncs\.com\//;

export function ossObjectUrl(key: string): string {
  return `${OSS_BASE}/${key}`;
}

/** 浏览器端直传视频到 OSS，返回上传后的公开直链 */
export async function uploadVideoToOss(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `videos/${Date.now()}-${rand}.${ext}`;
  const url = ossObjectUrl(key);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!res.ok) throw new Error(`上传失败 (HTTP ${res.status})`);
  return url;
}
