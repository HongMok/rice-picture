import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { generateLessonPlan, GenerationTimeoutError } from '~/libs/lesson-plan-gen';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_CHAT_LEN = 2000;
const MAX_KNOWLEDGE_LEN = 500;
const MAX_AIDS = 20;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const chatPrompt = String(body.chatPrompt || '').slice(0, MAX_CHAT_LEN).trim();
  const knowledgePoint = String(body.knowledgePoint || '').slice(0, MAX_KNOWLEDGE_LEN).trim();
  const hasMaterialAttachment = Boolean(body.hasMaterialAttachment);
  const targetSkill = String(body.targetSkill || '').trim();
  const phaseLabel = body.phaseLabel ? String(body.phaseLabel).trim() : undefined;
  const ownedAids = Array.isArray(body.ownedAids) ? body.ownedAids.slice(0, MAX_AIDS).map(String) : [];
  const lessonMinutes = Number(body.lessonMinutes) || undefined;

  // 需求 6.10：未提供任何输入源（教材附件/指定知识点）阻止提交
  if (!hasMaterialAttachment && !knowledgePoint) {
    return NextResponse.json({ error: '请先选择一种输入源：教材附件或指定知识点' }, { status: 400 });
  }
  // 需求 6.6：至少一种输入源 + 目标能力
  if (!targetSkill) {
    return NextResponse.json({ error: '请填写目标能力' }, { status: 400 });
  }
  if (lessonMinutes !== undefined && (lessonMinutes < 5 || lessonMinutes > 120)) {
    return NextResponse.json({ error: '预计时长需在 5 到 120 分钟之间' }, { status: 400 });
  }

  try {
    const skeleton = await generateLessonPlan({
      chatPrompt: chatPrompt || undefined,
      knowledgePoint: knowledgePoint || undefined,
      hasMaterialAttachment,
      targetSkill,
      phaseLabel,
      ownedAids,
      lessonMinutes,
    });

    const source = hasMaterialAttachment
      ? { kind: 'upload' as const, ref: '教材附件' }
      : { kind: 'knowledge-point' as const, ref: knowledgePoint };

    return NextResponse.json({ skeleton, source });
  } catch (err: any) {
    if (err instanceof GenerationTimeoutError) {
      return NextResponse.json({ error: '生成超时，请重试' }, { status: 504 });
    }
    return NextResponse.json({ error: err?.message || '生成失败' }, { status: 500 });
  }
}
