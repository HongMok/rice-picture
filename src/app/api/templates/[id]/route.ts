import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { getTemplate, getTemplatePages } from '~/libs/templates';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '无效 id' }, { status: 400 });
  }

  const t = await getTemplate(id);
  if (!t) return NextResponse.json({ error: '模板不存在' }, { status: 404 });

  const pages = await getTemplatePages(id);
  return NextResponse.json({
    template: {
      id: t.id,
      kind: t.kind,
      topic: t.topic,
      styleKey: t.style_key,
      title: t.title,
      subtitle: t.subtitle,
      brief: t.brief,
      options: t.options,
      coverUrl: t.cover_url,
    },
    pages: pages.map((p) => ({
      pageIndex: p.page_index,
      text: p.text,
      imageUrl: p.image_url,
      status: 'SUCCEEDED',
    })),
  });
}
