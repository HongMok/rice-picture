import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  ensureBuiltinTemplatesSeeded,
  findMyTemplateByName,
  listTemplates,
  saveCustomTemplate,
} from '~/libs/lesson-plan-templates';
import { BUILTIN_TEMPLATES } from '~/data/lesson-plan-builtin-templates';
import type { LessonPlanSkeleton } from '~/data/lesson-plan-types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    await ensureBuiltinTemplatesSeeded(
      BUILTIN_TEMPLATES.map((t) => ({ name: t.name, skill: t.skill, content: t.skeleton }))
    );
    const { builtin, mine } = await listTemplates(user.id);
    return NextResponse.json({ builtin, mine });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '模板加载失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { name?: string; content?: LessonPlanSkeleton; skill?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  if (!name || name.length < 1 || name.length > 50) {
    return NextResponse.json({ error: '模板名称需为 1 到 50 个字符' }, { status: 400 });
  }
  if (!body.content) {
    return NextResponse.json({ error: '缺少教案内容' }, { status: 400 });
  }

  try {
    const dup = await findMyTemplateByName(user.id, name);
    if (dup) {
      return NextResponse.json({ error: '你已有同名模板，换一个名字吧' }, { status: 409 });
    }
    const template = await saveCustomTemplate(user.id, name, body.content, body.skill);
    return NextResponse.json({ template });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '保存失败，请重试' }, { status: 500 });
  }
}
