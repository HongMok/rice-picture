import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'rice_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export interface SessionPayload {
  uid: number;
  username: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('缺少环境变量 SESSION_SECRET');
  return new TextEncoder().encode(secret);
}

/** 签发会话 JWT */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ uid: payload.uid, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

/** 校验会话 JWT，失败返回 null（Edge/Node 均可用） */
export async function verifySession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.uid === 'number' && typeof payload.username === 'string') {
      return { uid: payload.uid, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};
