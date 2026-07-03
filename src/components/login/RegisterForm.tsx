'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Brandmark } from '~/components/login/Brandmark';
import { KineticCharacters, type Reaction } from '~/components/login/KineticCharacters';
import { Spinner } from '~/components/ui';
import { rememberLastAccount } from '~/libs/last-account';

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/app/toolbox';

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password.length < 6) {
      fail('密码至少需要 6 位');
      return;
    }
    if (password !== confirmPassword) {
      fail('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setReaction('submit');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        fail(data.error || '注册失败');
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

          <h1 className="text-3xl tracking-tight text-ink">
            创建账号
          </h1>
          <p className="mt-1.5 text-sm text-ink-faint">
            注册后即可开始为孩子创作图卡与绘本
          </p>

          {error && (
            <div className="mt-4 animate-fade-in rounded-card bg-clay-mist px-3 py-2 text-sm text-clay">
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
                placeholder="3-32 位字母、数字、下划线或短横线"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setReaction('typing')}
                onBlur={() => setReaction('idle')}
                className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-faint/50 focus:border-clay"
              />
            </div>

            {/* 昵称 */}
            <div
              onMouseEnter={() =>
                reaction !== 'typing' &&
                reaction !== 'side' &&
                setReaction('typing')
              }
              onMouseLeave={() => reaction === 'typing' && setReaction('idle')}
            >
              <label className="mb-1.5 block text-sm font-medium text-ink">
                昵称 <span className="text-ink-faint">（选填）</span>
              </label>
              <input
                type="text"
                autoComplete="nickname"
                placeholder="留空则使用账号作为昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onFocus={() => setReaction('typing')}
                onBlur={() => setReaction('idle')}
                className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-faint/50 focus:border-clay"
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
                  autoComplete="new-password"
                  placeholder="至少 6 位"
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

            {/* 确认密码 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                确认密码
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setReaction('closed')}
                onBlur={() => setReaction('idle')}
                className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink caret-clay outline-none transition-colors placeholder:text-ink-faint/50 focus:border-clay"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => !loading && setReaction('submit')}
              onMouseLeave={() => !loading && setReaction('idle')}
              className="flex w-full items-center justify-center gap-2 rounded-card bg-clay py-3 text-sm font-medium text-white transition-colors hover:bg-clay/90 disabled:opacity-60"
            >
              {loading && <Spinner className="h-4 w-4" />}
              注册
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-faint">
            已有账号？{' '}
            <Link href="/login" className="font-medium text-clay hover:underline">
              直接登录
            </Link>
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
