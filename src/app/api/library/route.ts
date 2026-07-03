import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { query } from '~/libs/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LibraryItem {
  id: number;
  type: 'image' | 'book' | 'lesson-plan';
  title: string;
  coverUrl: string | null;
  subtitle: string | null;
  updatedAt: string;
  createdAt: string;
}

interface Row {
  id: number;
  type: 'image' | 'book' | 'lesson-plan';
  title: string;
  cover_url: string | null;
  subtitle: string | null;
  updated_at: string;
  created_at: string;
}

// 聚合返回图卡 / 绘本 / 教案，按更新时间倒序。deleted_at 过滤全部走。
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const rows = await query<Row>(
      `
      -- 图卡：output_url 当封面，模板 id 当副标题（前端可再映射为模板名）
      select w.id,
             'image'::text as type,
             coalesce(nullif(trim(w.title), ''), '未命名图卡') as title,
             w.output_url as cover_url,
             w.template_id as subtitle,
             w.updated_at,
             w.created_at
        from works w
       where w.user_id = $1 and w.deleted_at is null
      union all
      -- 绘本：首页图当封面，"共 N 页" 当副标题
      select b.id,
             'book'::text as type,
             coalesce(nullif(trim(b.title), ''), '未命名绘本') as title,
             (select image_url from book_pages p
               where p.book_id = b.id and p.image_url is not null
               order by p.page_index asc limit 1) as cover_url,
             ('共 ' || coalesce(b.page_count, 0) || ' 页') as subtitle,
             b.updated_at,
             b.created_at
        from books b
       where b.user_id = $1 and b.deleted_at is null
      union all
      -- 教案：无封面，type 字段当副标题
      select l.id,
             'lesson-plan'::text as type,
             coalesce(nullif(trim(l.title), ''), '未命名教案') as title,
             null::text as cover_url,
             l.type as subtitle,
             l.updated_at,
             l.created_at
        from lesson_plans l
       where l.user_id = $1 and l.deleted_at is null
      order by updated_at desc, created_at desc
      limit 200
      `,
      [user.id]
    );

    const items: LibraryItem[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      coverUrl: r.cover_url,
      subtitle: r.subtitle,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '资源列表加载失败' },
      { status: 500 }
    );
  }
}
