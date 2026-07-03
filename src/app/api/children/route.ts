import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';
import { createChild, listChildren } from '~/libs/children';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const children = await listChildren(user.id);
  return NextResponse.json({ children });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

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

  const child = await createChild({
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

  return NextResponse.json({ child });
}
