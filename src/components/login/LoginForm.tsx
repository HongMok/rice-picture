'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { KineticCharacters, type Reaction } from '~/components/login/KineticCharacters';
import { Spinner } from '~/components/ui';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/app';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [tilted, setTilted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.replace(from);
      router.refresh();
    } catch {
      setLoading(false);
      fail('网络错误，请重试');
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* 左：暖棕深色艺术区 */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-ink md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 30%, rgba(224,138,91,0.18), transparent 45%), radial-gradient(circle at 70% 75%, rgba(127,162,126,0.14), transparent 45%)',
          }}
        />
        <div className="relative flex h-[340px] items-end">
          <KineticCharacters reaction={reaction} tilted={tilted} />
        </div>
      </div>

      {/* 右：暖白表单区 */}
      <div className="flex flex-1 items-center justify-center bg-cream px-6 py-10">
        <div className="w-full max-w-sm">
          {/* 移动端：小角色场景放顶部 */}
          <div className="mb-6 flex justify-center md:hidden">
            <div className="scale-75">
              <KineticCharacters reaction={reaction} tilted={tilted} />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-ink">
            欢迎回来！
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            登录米图 · 特需儿童康复图卡与绘本生成
          </p>

          {error && (
            <div className="mt-4 animate-fade-in rounded-xl bg-clay-soft px-3 py-2 text-sm text-clay">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* 账号 */}
            <div
              onMouseEnter={() =>
                reaction !== 'typing' &&
                reaction !== 'side' &&
                setReaction('typing')
              }
              onMouseLeave={() => reaction === 'typing' && setReaction('idle')}
            >
              <label className="mb-1.5 block text-sm font-medium text-ink">
                账号
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setReaction('typing')}
                onBlur={() => setReaction('idle')}
                className="w-full rounded-xl border border-cream-line bg-white px-4 py-3 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-muted/50 focus:border-clay"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                密码
              </label>
              <div
                className="relative"
                onMouseEnter={() => setReaction('side')}
                onMouseLeave={() => setReaction('idle')}
              >
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setReaction('closed')}
                  onBlur={() => setReaction('idle')}
                  className="w-full rounded-xl border border-cream-line bg-white px-4 py-3 pr-11 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-muted/50 focus:border-clay"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPwd((v) => !v);
                    setReaction('closed');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-clay py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-clay/90 disabled:opacity-60"
            >
              {loading && <Spinner className="h-4 w-4" />}
              登录
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-muted">
            演示账号 demo / demo1234
          </p>
        </div>
      </div>
    </div>
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
