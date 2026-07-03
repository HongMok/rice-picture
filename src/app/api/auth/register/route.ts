import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne, query } from '~/libs/db';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '~/libs/session';

export const runtime = 'nodejs';

interface ExistingUserRow {
  id: number;
}

interface NewUserRow {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export async function POST(req: Request) {
  let body: { username?: string; password?: string; nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';
  const nickname = (body.nickname || '').trim() || username;

  if (!username || !password) {
    return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: '账号需为 3-32 位字母、数字、下划线或短横线' },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少需要 6 位' }, { status: 400 });
  }

  const existing = await queryOne<ExistingUserRow>(
    'select id from users where username = $1',
    [username]
  );
  if (existing) {
    return NextResponse.json({ error: '该账号已被注册' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const rows = await query<NewUserRow>(
    'insert into users (username, password, nickname) values ($1, $2, $3) returning id, username, nickname, avatar',
    [username, hash, nickname]
  );
  const user = rows[0];

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
