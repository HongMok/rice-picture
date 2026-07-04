import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { query } from '~/libs/db';

export const dynamic = 'force-dynamic';

export interface RecentProject {
  id: number;
  type: 'image' | 'book' | 'game' | 'video' | 'lesson-plan' | 'chat';
  title: string;
  updated_at: string;
  created_at: string;
}

/**
 * 过去 720 小时（30 天）内创建或更新的项目，跨表联合，最多 50 条。
 * 各子表独立 try/catch —— 某张表在当前环境不存在（例如 chat_sessions 未迁移）
 * 也只跳过它，不影响其它模块的历史条目显示。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const sources: { type: RecentProject['type']; sql: string; fallback: string }[] = [
    {
      type: 'image',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from works
             where user_id = $1 and deleted_at is null
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名图卡',
    },
    {
      type: 'book',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from books
             where user_id = $1 and deleted_at is null
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名绘本',
    },
    {
      type: 'game',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from games
             where user_id = $1
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名游戏',
    },
    {
      type: 'video',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from video_analyses
             where user_id = $1
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名视频分析',
    },
    {
      type: 'lesson-plan',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from lesson_plans
             where user_id = $1 and deleted_at is null
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名教案',
    },
    {
      type: 'chat',
      sql: `select id, updated_at, created_at, coalesce(title, $2) as title
              from chat_sessions
             where user_id = $1 and deleted_at is null
               and updated_at >= now() - interval '720 hours'`,
      fallback: '未命名对话',
    },
  ];

  const all: RecentProject[] = [];
  for (const s of sources) {
    try {
      const rows = await query<{
        id: number;
        title: string;
        updated_at: string;
        created_at: string;
      }>(s.sql, [user.id, s.fallback]);
      for (const r of rows) all.push({ ...r, type: s.type });
    } catch {
      // 该表在此环境不存在 / 结构不匹配 —— 静默跳过，不影响其它模块
    }
  }

  all.sort((a, b) => {
    const ua = new Date(a.updated_at).getTime();
    const ub = new Date(b.updated_at).getTime();
    if (ub !== ua) return ub - ua;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return NextResponse.json({ items: all.slice(0, 50) });
}
