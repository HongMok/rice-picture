'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Brandmark } from '~/components/login/Brandmark';
import { KineticCharacters, type Reaction } from '~/components/login/KineticCharacters';
import { Spinner } from '~/components/ui';
import {
  loadRecentAccounts,
  rememberLastAccount,
  removeAccount,
  type LastAccount,
} from '~/libs/last-account';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/app/toolbox';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [tilted, setTilted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<LastAccount[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const usernameWrapRef = useRef<HTMLDivElement | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const pwdRef = useRef<HTMLInputElement | null>(null);

  // 初次挂载：读取最近账号列表，若有则预填首个（不打开下拉）
  useEffect(() => {
    const list = loadRecentAccounts();
    setAccounts(list);
    if (list.length > 0) setUsername(list[0].username);
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (!usernameWrapRef.current) return;
      if (!usernameWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);

  // 按当前输入前缀过滤（大小写不敏感）；输入为空则展示全部
  const filtered = useMemo(() => {
    const q = username.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        (a.nickname || '').toLowerCase().includes(q)
    );
  }, [accounts, username]);

  function pickAccount(a: LastAccount) {
    setUsername(a.username);
    setPassword('');
    setError('');
    setDropdownOpen(false);
    setTimeout(() => pwdRef.current?.focus(), 20);
  }

  function handleRemove(a: LastAccount, e: React.MouseEvent) {
    // 用 mousedown 阻止 blur；此处仅同步状态
    e.preventDefault();
    e.stopPropagation();
    removeAccount(a.username);
    const next = accounts.filter((x) => x.username !== a.username);
    setAccounts(next);
    if (username === a.username) setUsername('');
    if (next.length === 0) setDropdownOpen(false);
  }

  function fail(msg: string) {
    setError(msg);
    setReaction('surprise');
    setTilted(true);
    setTimeout(() => {
      setReaction('idle');
      setTilted(false);
    }, 2500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      fail('请输入账号和密码');
      return;
    }
    setLoading(true);
    setReaction('submit');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        fail(data.error || '登录失败');
        return;
      }
      if (data?.user?.username) {
        rememberLastAccount({
          username: data.user.username,
          nickname: data.user.nickname ?? null,
          avatar: data.user.avatar ?? null,
        });
      }
      router.replace(from);
      router.refresh();
    } catch {
      setLoading(false);
      fail('网络错误，请重试');
    }
  }

  const showDropdown = dropdownOpen && filtered.length > 0;

  return (
    <div className="flex min-h-screen w-full">
      {/* 左：小禾绿艺术区 */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-ink md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 30%, rgba(127,169,139,0.22), transparent 45%), radial-gradient(circle at 70% 75%, rgba(183,211,184,0.16), transparent 45%)',
          }}
        />
        <Brandmark className="absolute left-10 top-10" />
        <div className="relative flex h-[340px] items-end">
          <KineticCharacters reaction={reaction} tilted={tilted} />
        </div>
      </div>

      {/* 右：暖白表单区 */}
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-10">
        <div className="w-full max-w-sm">
          {/* 移动端：品牌 + 小角色场景放顶部 */}
          <div className="mb-8 flex flex-col items-center gap-4 md:hidden">
            <Brandmark align="center" />
            <div className="scale-75">
              <KineticCharacters reaction={reaction} tilted={tilted} />
            </div>
          </div>

          <h1 className="text-3xl tracking-tight text-ink">欢迎回来！</h1>
          <p className="mt-1.5 text-sm text-ink-faint">登录账号，继续为孩子创作</p>

          {error && (
            <div className="mt-4 animate-fade-in rounded-card bg-clay-mist px-3 py-2 text-sm text-clay">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" autoComplete="on">
            {/* 账号 —— 支持最近账号下拉 */}
            <div
              ref={usernameWrapRef}
              className="relative"
              onMouseEnter={() =>
                reaction !== 'typing' &&
                reaction !== 'side' &&
                setReaction('typing')
              }
              onMouseLeave={() => reaction === 'typing' && setReaction('idle')}
            >
              <label className="mb-1.5 block text-sm font-medium text-ink">账号</label>
              <input
                ref={usernameInputRef}
                type="text"
                autoComplete="username"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (!dropdownOpen && accounts.length > 0) setDropdownOpen(true);
                }}
                onFocus={() => {
                  setReaction('typing');
                  if (accounts.length > 0) setDropdownOpen(true);
                }}
                onBlur={() => setReaction('idle')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setDropdownOpen(false);
                }}
                className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-faint/50 focus:border-clay"
              />

              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-card border border-line bg-white shadow-lg animate-fade-in"
                  role="listbox"
                >
                  <p className="border-b border-line px-3 py-1.5 text-[11px] font-medium tracking-[0.15em] text-ink-faint">
                    最近登录
                  </p>
                  {filtered.map((a) => (
                    <div
                      key={a.username}
                      role="option"
                      aria-selected={username === a.username}
                      onMouseDown={(e) => {
                        // 阻止 input blur，让点击顺利被下面 click 处理
                        e.preventDefault();
                      }}
                      onClick={() => pickAccount(a)}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sage-mist"
                    >
                      <AccountAvatar account={a} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {a.nickname || a.username}
                        </p>
                        <p className="truncate text-xs text-ink-faint">@{a.username}</p>
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => handleRemove(a, e)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
                        aria-label={`忘记账号 ${a.username}`}
                        title="从最近记录中移除"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">密码</label>
              <div
                className="relative"
                onMouseEnter={() => setReaction('side')}
                onMouseLeave={() => setReaction('idle')}
              >
                <input
                  ref={pwdRef}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setReaction('closed')}
                  onBlur={() => setReaction('idle')}
                  className="w-full rounded-input border border-line bg-white px-4 py-3 pr-11 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-faint/50 focus:border-clay"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPwd((v) => !v);
                    setReaction('closed');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => !loading && setReaction('submit')}
              onMouseLeave={() => !loading && setReaction('idle')}
              className="flex w-full items-center justify-center gap-2 rounded-card bg-clay py-3 text-sm font-medium text-white transition-colors hover:bg-clay/90 disabled:opacity-60"
            >
              {loading && <Spinner className="h-4 w-4" />}
              登录
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-faint">
            还没有账号？{' '}
            <Link href="/register" className="font-medium text-clay hover:underline">
              立即注册
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-ink-faint">
            演示账号 demo / demo1234
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountAvatar({
  account,
  size,
}: {
  account: Pick<LastAccount, 'nickname' | 'username' | 'avatar'>;
  size: number;
}) {
  const initial = (account.nickname || account.username || '?').slice(0, 1);
  if (account.avatar) {
    return (
      <img
        src={account.avatar}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-sage-mist text-sm font-medium text-sage-deep"
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.42)) }}
    >
      {initial}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function EyeOn() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.9 4.6M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
