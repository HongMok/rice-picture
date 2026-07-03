import { query, queryOne } from '~/libs/db';
import type { VideoReport } from '~/data/video-types';

export interface VideoAnalysisRow {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  child_id: number | null;
  title: string | null;
  video_url: string;
  status: string; // ANALYZING / DONE / FAILED
  report: VideoReport | null;
  error: string | null;
}

export async function createAnalysis(params: {
  userId: number;
  childId: number | null;
  title: string | null;
  videoUrl: string;
}): Promise<VideoAnalysisRow> {
  const row = await queryOne<VideoAnalysisRow>(
    `insert into video_analyses (user_id, child_id, title, video_url, status)
     values ($1, $2, $3, $4, 'ANALYZING')
     returning *`,
    [params.userId, params.childId, params.title, params.videoUrl]
  );
  return row!;
}

export async function setReport(id: number, report: VideoReport): Promise<void> {
  await query(
    `update video_analyses
       set report = $1, status = 'DONE', error = null, updated_at = now()
     where id = $2`,
    [JSON.stringify(report), id]
  );
}

export async function setStatus(
  id: number,
  status: string,
  error?: string
): Promise<void> {
  await query(
    'update video_analyses set status = $1, error = $2, updated_at = now() where id = $3',
    [status, error ?? null, id]
  );
}

export async function getAnalysis(
  id: number,
  userId: number
): Promise<VideoAnalysisRow | null> {
  return queryOne<VideoAnalysisRow>(
    'select * from video_analyses where id = $1 and user_id = $2',
    [id, userId]
  );
}

export async function listAnalyses(
  userId: number,
  limit = 50
): Promise<VideoAnalysisRow[]> {
  return query<VideoAnalysisRow>(
    'select * from video_analyses where user_id = $1 order by created_at desc limit $2',
    [userId, limit]
  );
}

/** 同一个孩子历次已完成分析（按时间升序），用于能力趋势图 */
export async function listChildAnalyses(
  childId: number,
  userId: number,
  limit = 12
): Promise<VideoAnalysisRow[]> {
  return query<VideoAnalysisRow>(
    `select * from video_analyses
     where child_id = $1 and user_id = $2 and status = 'DONE'
     order by created_at asc limit $3`,
    [childId, userId, limit]
  );
}

/** 个案详情页用：该孩子最近的视频分析（含各种状态），按时间倒序 */
export async function listChildAnalysesRecent(
  childId: number,
  userId: number,
  limit = 20
): Promise<VideoAnalysisRow[]> {
  return query<VideoAnalysisRow>(
    `select * from video_analyses
     where child_id = $1 and user_id = $2
     order by created_at desc limit $3`,
    [childId, userId, limit]
  );
}
