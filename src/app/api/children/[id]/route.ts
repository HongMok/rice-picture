import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { updateChild } from '~/libs/children';

export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const nickname = String(body.nickname || '').trim();
  if (!nickname) {
    return NextResponse.json({ error: '请填写孩子的称呼' }, { status: 400 });
  }

  const arr = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const child = await updateChild({
    id,
    userId: user.id,
    nickname: nickname.slice(0, 30),
    age: Number.isFinite(body.age) ? Number(body.age) : null,
    gender: body.gender ? String(body.gender) : null,
    diagnosis: body.diagnosis ? String(body.diagnosis) : null,
    severity: body.severity ? String(body.severity) : null,
    strengths: arr(body.strengths),
    weaknesses: arr(body.weaknesses),
    interests: arr(body.interests),
  });

  if (!child) return NextResponse.json({ error: '个案不存在' }, { status: 404 });
  return NextResponse.json({ child });
}
