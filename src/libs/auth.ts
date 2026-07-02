import { cookies } from 'next/headers';
import { queryOne } from '~/libs/db';
import { SESSION_COOKIE, verifySession } from '~/libs/session';

export interface CurrentUser {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

/**
 * 在服务端组件 / Route Handler 中读取当前登录用户。
 * 未登录返回 null。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const user = await queryOne<CurrentUser>(
    'select id, username, nickname, avatar from users where id = $1',
    [session.uid]
  );
  return user;
}
