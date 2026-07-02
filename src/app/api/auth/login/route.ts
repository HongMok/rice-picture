import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '~/libs/db';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '~/libs/session';

export const runtime = 'nodejs';

interface UserRow {
  id: number;
  username: string;
  password: string;
  nickname: string | null;
  avatar: string | null;
}

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';
  if (!username || !password) {
    return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
  }

  const user = await queryOne<UserRow>(
    'select id, username, password, nickname, avatar from users where username = $1',
    [username]
  );
  if (!user) {
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }

  const uid = Number(user.id);
  const token = await signSession({ uid, username: user.username });
  const res = NextResponse.json({
    user: {
      id: uid,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
