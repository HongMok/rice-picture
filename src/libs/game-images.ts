// 情境图解析：图库命中优先，未命中则 AI 生图 → 转存 Blob → 入库复用
import { createImageTask, queryImageTask } from '~/libs/dashscope';
import { findAsset, createAsset } from '~/libs/assets';
import { persistImage, fetchAsDataUrl, hasBlobToken } from '~/libs/blob';
import { styleSuffix, COMMON_NEGATIVE } from '~/data/taxonomy';

const STYLE_KEY = 'flat'; // 扁平简洁风格，单主体居中，最适合教学图标

/** 一张情境图的生成需求 */
export interface ImageSpec {
  kind: 'emotion' | 'object';
  label: string; // 检索键
  emotion?: string; // kind=emotion 时
  prompt: string; // 画面描述（不含风格后缀）
  /** 首次 prompt 被内容审查拒稿时用的降级 prompt（如把 IP 形象改成
   *  「一个小朋友手里拿着 XX 相关玩具」，规避视觉审查）。 */
  fallbackPrompt?: string;
}

/** 轮询单个生图任务直到完成（服务端，节流友好）
 *  turbo 模型通常 5～15s 出图；上限收紧，避免一轮多张图超时。 */
interface WaitResult {
  url: string | null;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT';
  message?: string;
}

async function waitForImage(taskId: string, maxTries = 12): Promise<WaitResult> {
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await queryImageTask(taskId);
    if (res.status === 'SUCCEEDED') return { url: res.imageUrl || null, status: 'SUCCEEDED' };
    if (res.status === 'FAILED') {
      return { url: null, status: 'FAILED', message: res.message };
    }
  }
  return { url: null, status: 'TIMEOUT' };
}

/**
 * 解析一张图：先查图库，命中返回永久 URL；未命中则生图+转存+入库。
 * 失败返回 null（前端用 emoji 兜底）。
 */
/** 单次生图 + 等待。成功返回 url；失败返回 null 并打日志。 */
async function tryGenerate(
  prompt: string,
  spec: ImageSpec,
  attempt: string,
): Promise<string | null> {
  let taskId: string;
  try {
    taskId = await createImageTask({
      prompt: `${prompt}。${styleSuffix(STYLE_KEY)}`,
      negativePrompt: COMMON_NEGATIVE,
      size: '1024*1024',
    });
  } catch (err) {
    console.warn('[game-images] createImageTask 失败', {
      attempt,
      kind: spec.kind,
      label: spec.label,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
  const wait = await waitForImage(taskId);
  if (!wait.url) {
    console.warn('[game-images] 生图未成功', {
      attempt,
      kind: spec.kind,
      label: spec.label,
      taskId,
      status: wait.status,
      message: wait.message,
      prompt: prompt.slice(0, 200),
    });
    return null;
  }
  return wait.url;
}

export async function resolveImage(
  userId: number,
  spec: ImageSpec
): Promise<string | null> {
  // 1) 图库命中
  const hit = await findAsset(userId, spec.kind, spec.label);
  if (hit) return hit.blob_url;

  // 2) 首次尝试
  let tempUrl = await tryGenerate(spec.prompt, spec, 'primary');

  // 3) 首试失败 + 提供了降级 prompt → 再试一次
  if (!tempUrl && spec.fallbackPrompt) {
    console.info('[game-images] 首试失败，走降级 prompt 重试', {
      kind: spec.kind,
      label: spec.label,
    });
    tempUrl = await tryGenerate(spec.fallbackPrompt, spec, 'fallback');
  }

  if (!tempUrl) return null;

  // 3) 持久化 + 入库（Blob 优先，否则数据库 base64 兜底）
  try {
    if (hasBlobToken()) {
      const blobUrl = await persistImage(tempUrl, `${spec.kind}-${spec.label}`);
      const asset = await createAsset({
        userId,
        kind: spec.kind,
        label: spec.label,
        emotion: spec.emotion ?? null,
        blobUrl,
        source: 'ai',
        prompt: spec.prompt,
      });
      return asset.blob_url;
    }
    // 数据库兜底：转 base64 存 assets.data，blob_url 回填为 /api/asset/<id>
    const dataUrl = await fetchAsDataUrl(tempUrl);
    const asset = await createAsset({
      userId,
      kind: spec.kind,
      label: spec.label,
      emotion: spec.emotion ?? null,
      data: dataUrl,
      source: 'ai',
      prompt: spec.prompt,
    });
    return asset.blob_url; // = /api/asset/<id>
  } catch {
    // 持久化失败：退回临时地址（当天可用），不入库
    return tempUrl;
  }
}
