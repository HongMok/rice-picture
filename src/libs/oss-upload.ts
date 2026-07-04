// 课堂视频上传：浏览器直传阿里云 OSS（公共读写桶，匿名 PUT 无需签名）
// 不经过 Vercel serverless 中转，避免大文件受限于请求体大小/时长。

const OSS_BASE = 'https://ai-study0701.oss-cn-beijing.aliyuncs.com';

export const OSS_RE = /^https:\/\/ai-study0701\.oss-cn-beijing\.aliyuncs\.com\//;

export function ossObjectUrl(key: string): string {
  return `${OSS_BASE}/${key}`;
}

/**
 * 浏览器端直传视频到 OSS，返回上传后的公开直链。
 * 用 XHR 而非 fetch，是为了拿到 upload progress 事件（fetch 目前浏览器不支持上传进度）。
 * onProgress 回调 0~100 整数。
 */
export function uploadVideoToOss(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `videos/${Date.now()}-${rand}.${ext}`;
  const url = ossObjectUrl(key);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.floor((e.loaded / e.total) * 100);
      onProgress?.(Math.min(99, pct)); // 服务端 200 前留 1% 缓冲，避免立刻满 100 又跳回
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(url);
      } else {
        reject(new Error(`上传失败 (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('上传失败，请检查网络'));
    xhr.send(file);
  });
}
