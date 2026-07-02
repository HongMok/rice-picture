import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { listTemplates } from '~/libs/templates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind') || undefined;
  const topic = searchParams.get('topic') || undefined;
  const style = searchParams.get('style') || undefined;

  const rows = await listTemplates({ kind, topic, style });
  return NextResponse.json({
    templates: rows.map((t) => ({
      id: t.id,
      kind: t.kind,
      topic: t.topic,
      styleKey: t.style_key,
      title: t.title,
      subtitle: t.subtitle,
      brief: t.brief,
      options: t.options,
      coverUrl: t.cover_url,
    })),
  });
}
