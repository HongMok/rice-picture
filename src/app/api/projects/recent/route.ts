import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { query } from '~/libs/db';

export const dynamic = 'force-dynamic';

export interface RecentProject {
  id: number;
  type: 'image' | 'book' | 'game' | 'video' | 'lesson-plan';
  title: string;
  updated_at: string;
  created_at: string;
}

// 过去 720 小时（30 天）内创建或更新的项目，跨表联合，最多 50 条
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const rows = await query<RecentProject>(
      `
      select id, 'image' as type, coalesce(title, '未命名图卡') as title, updated_at, created_at
        from works
       where user_id = $1 and deleted_at is null and updated_at >= now() - interval '720 hours'
      union all
      select id, 'book' as type, coalesce(title, '未命名绘本') as title, updated_at, created_at
        from books
       where user_id = $1 and deleted_at is null and updated_at >= now() - interval '720 hours'
      union all
      select id, 'game' as type, coalesce(title, '未命名游戏') as title, updated_at, created_at
        from games
       where user_id = $1 and updated_at >= now() - interval '720 hours'
      union all
      select id, 'video' as type, coalesce(title, '未命名视频分析') as title, updated_at, created_at
        from video_analyses
       where user_id = $1 and updated_at >= now() - interval '720 hours'
      union all
      select id, 'lesson-plan' as type, coalesce(title, '未命名教案') as title, updated_at, created_at
        from lesson_plans
       where user_id = $1 and deleted_at is null and updated_at >= now() - interval '720 hours'
      order by updated_at desc, created_at desc
      limit 50
      `,
      [user.id]
    );
    return NextResponse.json({ items: rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '历史列表加载失败' },
      { status: 500 }
    );
  }
}
