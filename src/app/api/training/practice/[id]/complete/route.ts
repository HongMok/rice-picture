import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import {
  completePracticeSession,
  getPracticeSession,
  getScenario,
} from '~/libs/training';
import { qwenChatJson } from '~/libs/qwen';
import type { PracticeEvaluation } from '~/data/training-types';

export const dynamic = 'force-dynamic';

/** 结束练习：把对话丢给 AI 打分出复盘报告 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const sessionId = Number(params.id);
  const session = await getPracticeSession(user.id, sessionId);
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  if (session.status === 'completed' && session.evaluation) {
    return NextResponse.json({ evaluation: session.evaluation });
  }
  const scenario = await getScenario(session.scenario_id);
  if (!scenario) return NextResponse.json({ error: '场景已被删除' }, { status: 404 });

  const rubric = scenario.evaluation_rubric?.dimensions || [];
  const dimensionSpec = rubric
    .map((d) => `- ${d.key}(${d.name})：${d.criteria}`)
    .join('\n');

  const transcript = session.messages
    .map((m) => `${m.role === 'user' ? '康复师' : scenario.role_persona?.who || 'AI'}：${m.content}`)
    .join('\n');

  const messages = [
    {
      role: 'system' as const,
      content: [
        '你是一位康复师岗位培训督导，正在给一次角色扮演练习打分。',
        '要求严格但公正：不要盲目给高分，如果对话时间过短、康复师没触达关键要点，就该低分。',
        '打分要基于对话原文，可以引用原话。',
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: [
        `【练习场景】${scenario.title}`,
        `【AI 扮演角色】${scenario.role_persona?.who || ''}`,
        '',
        '【评价维度（0-100 分）】',
        dimensionSpec || '- overall: 综合表现',
        '',
        '【对话原文】',
        transcript,
        '',
        '请严格输出 JSON：',
        '{',
        '  "dimensions": { "维度key": { "score": 0-100, "note": "简短评价（<40字）" } },',
        '  "overall": 0-100 综合分,',
        '  "highlights": ["康复师做得好的一句原话，最多2条"],',
        '  "improvements": ["可以更好的一句原话+改写建议，最多3条"]',
        '}',
        '注意：dimensions 里的 key 要用上面维度列表里的 key。',
      ].join('\n'),
    },
  ];

  let evaluation: PracticeEvaluation;
  try {
    evaluation = await qwenChatJson<PracticeEvaluation>(messages, {
      model: 'qwen-max',
      temperature: 0.3,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '复盘生成失败' },
      { status: 500 }
    );
  }

  await completePracticeSession(user.id, sessionId, evaluation);
  return NextResponse.json({ evaluation });
}
