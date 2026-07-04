import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  finalizeDraftLessonPlan,
  getLessonPlan,
  lessonPlanOwnerId,
  markLessonPlanGenerationFailed,
  resetLessonPlanToGenerating,
} from '~/libs/lesson-plans';
import { generateLessonPlan, GenerationTimeoutError } from '~/libs/lesson-plan-gen';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_CHAT_LEN = 2000;
const MAX_KNOWLEDGE_LEN = 500;
const MAX_AIDS = 20;

/**
 * 对指定 draft 教案（status=GENERATING 或 FAILED）阻塞跑一次 AI 生成。
 * 前端 fire-and-forget 调用：拿到 draft id 后立即跳详情页占位，同时后台调本接口。
 * 本接口在同一个请求周期内跑 qwen（最长 60s），结束写回 skeleton + status=READY，
 * 或失败时写 status=FAILED + generation_error 供前端"重试"。
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '无效的教案 ID' }, { status: 400 });
  }

  // 鉴权 + 读取现有 plan（含 status）
  const existing = await getLessonPlan(id, user.id);
  if (!existing) {
    const ownerId = await lessonPlanOwnerId(id);
    if (ownerId !== null && ownerId !== user.id) {
      return NextResponse.json({ error: '无权访问该教案' }, { status: 403 });
    }
    return NextResponse.json({ error: '教案不存在或已被删除' }, { status: 404 });
  }

  // 已经是 READY 且用户没有明确要求重生成 → 直接返回，避免误覆盖
  // 我们要求前端在 READY 状态下不再调 /generate；这里做一次防御
  if (existing.status === 'READY') {
    return NextResponse.json({ plan: existing });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body：会写失败态提示"参数丢失"
  }

  const chatPrompt = String(body.chatPrompt || '').slice(0, MAX_CHAT_LEN).trim();
  const knowledgePoint = String(body.knowledgePoint || '').slice(0, MAX_KNOWLEDGE_LEN).trim();
  const hasMaterialAttachment = Boolean(body.hasMaterialAttachment);
  const targetSkill = String(body.targetSkill || '').trim();
  const phaseLabel = body.phaseLabel ? String(body.phaseLabel).trim() : undefined;
  const ownedAids = Array.isArray(body.ownedAids)
    ? body.ownedAids.slice(0, MAX_AIDS).map(String)
    : [];
  const lessonMinutes = Number(body.lessonMinutes) || undefined;

  if (!hasMaterialAttachment && !knowledgePoint) {
    await markLessonPlanGenerationFailed(id, user.id, '缺少输入源：请提供知识点或教材附件');
    return NextResponse.json({ error: '请先选择一种输入源：教材附件或指定知识点' }, { status: 400 });
  }
  if (!targetSkill) {
    await markLessonPlanGenerationFailed(id, user.id, '缺少目标能力');
    return NextResponse.json({ error: '请填写目标能力' }, { status: 400 });
  }

  // 若当前是 FAILED 想重试，先切回 GENERATING
  if (existing.status === 'FAILED') {
    await resetLessonPlanToGenerating(id, user.id);
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

    const plan = await finalizeDraftLessonPlan(id, user.id, skeleton, source);
    if (!plan) return NextResponse.json({ error: '写回失败，请刷新重试' }, { status: 500 });
    return NextResponse.json({ plan });
  } catch (err: any) {
    const msg =
      err instanceof GenerationTimeoutError
        ? '生成超时，请重试'
        : err?.message || '生成失败';
    await markLessonPlanGenerationFailed(id, user.id, msg);
    return NextResponse.json({ error: msg }, { status: err instanceof GenerationTimeoutError ? 504 : 500 });
  }
}
