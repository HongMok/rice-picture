import { query, queryOne } from '~/libs/db';

export interface Asset {
  id: number;
  created_at: string;
  user_id: number;
  kind: string; // 'emotion' | 'object' | 'scene'
  label: string;
  emotion: string | null;
  tags: string[];
  blob_url: string;
  data: string | null; // base64 data URL（无 Blob token 时的兜底）
  source: string; // 'ai' | 'manual'
  prompt: string | null;
}

/** 按 (kind,label) 检索一张可复用素材；命中即返回，用于图库复用 */
export async function findAsset(
  userId: number,
  kind: string,
  label: string
): Promise<Asset | null> {
  return queryOne<Asset>(
    `select * from assets
     where user_id = $1 and kind = $2 and label = $3
     order by created_at desc
     limit 1`,
    [userId, kind, label]
  );
}

export async function createAsset(params: {
  userId: number;
  kind: string;
  label: string;
  emotion?: string | null;
  tags?: string[];
  blobUrl?: string; // Blob 直链；不传则走 DB 兜底
  data?: string | null; // base64 data URL（DB 兜底）
  source?: string;
  prompt?: string | null;
}): Promise<Asset> {
  // 先插入拿到 id
  const row = await queryOne<Asset>(
    `insert into assets (user_id, kind, label, emotion, tags, blob_url, data, source, prompt)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      params.userId,
      params.kind,
      params.label,
      params.emotion ?? null,
      params.tags ?? [],
      params.blobUrl ?? '', // DB 兜底时先空，下面回填
      params.data ?? null,
      params.source ?? 'ai',
      params.prompt ?? null,
    ]
  );
  const asset = row!;

  // DB 兜底（无 Blob 直链但有 data）：blob_url 回填为读取路由
  if (!params.blobUrl && params.data) {
    const url = `/api/asset/${asset.id}`;
    await query('update assets set blob_url = $1 where id = $2', [url, asset.id]);
    asset.blob_url = url;
  }
  return asset;
}

/** 读取 DB 兜底图片的 base64 data（供 /api/asset/[id] 使用） */
export async function getAssetData(
  id: number
): Promise<{ data: string | null } | null> {
  return queryOne<{ data: string | null }>(
    'select data from assets where id = $1',
    [id]
  );
}
