// 最近登录账号的本地缓存（localStorage）。
// 只存展示所需的最小字段：账号名、昵称、头像。绝不缓存密码/token。
// 保留最近 3 个，最新登录的排在最前。

export interface LastAccount {
  username: string;
  nickname: string | null;
  avatar: string | null;
  savedAt: number;
}

const KEY = 'xiaohe.recentAccounts';
const LEGACY_KEY = 'xiaohe.lastAccount'; // 旧版单账号 key
export const MAX_RECENT = 3;

function normalize(obj: unknown): LastAccount | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.username !== 'string' || !o.username) return null;
  return {
    username: o.username,
    nickname: typeof o.nickname === 'string' ? o.nickname : null,
    avatar: typeof o.avatar === 'string' ? o.avatar : null,
    savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0,
  };
}

function readRaw(): LastAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map(normalize).filter((x): x is LastAccount => !!x).slice(0, MAX_RECENT);
      }
    }
    // 旧版单账号 → 迁移
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const one = normalize(JSON.parse(legacy));
      if (one) {
        window.localStorage.setItem(KEY, JSON.stringify([one]));
        window.localStorage.removeItem(LEGACY_KEY);
        return [one];
      }
    }
  } catch {
    /* 忽略：JSON / localStorage 异常 */
  }
  return [];
}

function writeRaw(list: LastAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* 忽略：容量满 / 隐私模式禁用 */
  }
}

/** 最近账号列表，最新的在前。 */
export function loadRecentAccounts(): LastAccount[] {
  return readRaw();
}

/** 兼容旧调用：取最近一个账号（列表首位）。 */
export function loadLastAccount(): LastAccount | null {
  return readRaw()[0] || null;
}

/** 将账号写入/更新到列表最前。同名账号会被去重后提到最前。 */
export function rememberLastAccount(
  info: Pick<LastAccount, 'username' | 'nickname' | 'avatar'>
): void {
  if (!info.username) return;
  const now: LastAccount = {
    username: info.username,
    nickname: info.nickname ?? null,
    avatar: info.avatar ?? null,
    savedAt: Date.now(),
  };
  const rest = readRaw().filter((a) => a.username !== info.username);
  writeRaw([now, ...rest]);
}

/** 从最近账号列表中移除指定账号。 */
export function removeAccount(username: string): void {
  writeRaw(readRaw().filter((a) => a.username !== username));
}

/** 清空所有最近账号。 */
export function forgetLastAccount(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* 忽略 */
  }
}
