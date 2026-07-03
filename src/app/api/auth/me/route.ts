import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '~/libs/auth';
import { query, queryOne } from '~/libs/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

interface UserRow {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  password: string;
}

export async function PATCH(req: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: {
    nickname?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const nickname = (body.nickname ?? '').trim();
  if (!nickname) {
    return NextResponse.json({ error: '昵称不能为空' }, { status: 400 });
  }
  if (nickname.length > 30) {
    return NextResponse.json({ error: '昵称最多 30 个字符' }, { status: 400 });
  }

  const wantsPasswordChange = Boolean(body.newPassword);
  if (wantsPasswordChange) {
    const oldPwd = body.currentPassword || '';
    const newPwd = body.newPassword || '';
    if (newPwd.length < 6) {
      return NextResponse.json({ error: '新密码至少需要 6 位' }, { status: 400 });
    }
    const row = await queryOne<UserRow>(
      'select id, username, nickname, avatar, password from users where id = $1',
      [current.id]
    );
    if (!row) {
      return NextResponse.json({ error: '账号不存在' }, { status: 404 });
    }
    const ok = await bcrypt.compare(oldPwd, row.password);
    if (!ok) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    }
    const hash = await bcrypt.hash(newPwd, 10);
    await query(
      'update users set nickname = $1, password = $2 where id = $3',
      [nickname, hash, current.id]
    );
  } else {
    await query('update users set nickname = $1 where id = $2', [
      nickname,
      current.id,
    ]);
  }

  const updated = await queryOne<{
    id: number;
    username: string;
    nickname: string | null;
    avatar: string | null;
  }>('select id, username, nickname, avatar from users where id = $1', [
    current.id,
  ]);

  return NextResponse.json({ user: updated });
}
