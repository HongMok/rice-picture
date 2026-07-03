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
}

/** 轮询单个生图任务直到完成（服务端，节流友好）
 *  turbo 模型通常 5～15s 出图；上限收紧，避免一轮多张图超时。 */
async function waitForImage(taskId: string, maxTries = 12): Promise<string | null> {
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await queryImageTask(taskId);
    if (res.status === 'SUCCEEDED') return res.imageUrl || null;
    if (res.status === 'FAILED') return null;
  }
  return null;
}

/**
 * 解析一张图：先查图库，命中返回永久 URL；未命中则生图+转存+入库。
 * 失败返回 null（前端用 emoji 兜底）。
 */
export async function resolveImage(
  userId: number,
  spec: ImageSpec
): Promise<string | null> {
  // 1) 图库命中
  const hit = await findAsset(userId, spec.kind, spec.label);
  if (hit) return hit.blob_url;

  // 2) 生图
  let taskId: string;
  try {
    taskId = await createImageTask({
      prompt: `${spec.prompt}。${styleSuffix(STYLE_KEY)}`,
      negativePrompt: COMMON_NEGATIVE,
      size: '1024*1024',
    });
  } catch {
    return null;
  }

  const tempUrl = await waitForImage(taskId);
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
