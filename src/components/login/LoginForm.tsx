'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CartoonMascot } from '~/components/login/CartoonMascot';
import { Spinner } from '~/components/ui';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/app';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [covering, setCovering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 眼珠跟随：账号输入长度映射到 0~1（打字越多越往右看）
  const lookRatio = Math.min(username.length / 16, 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登录失败');
        setLoading(false);
        return;
      }
      router.replace(from);
      router.refresh();
    } catch {
      setError('网络错误，请重试');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* 熊猫探出卡片顶部 */}
      <div className="relative z-10 flex justify-center">
        <div className="-mb-6">
          <CartoonMascot lookRatio={lookRatio} covering={covering} />
        </div>
      </div>

      {/* 白色卡片 */}
      <div className="relative rounded-3xl bg-white px-7 pb-8 pt-10 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-bold tracking-tight text-ink">
            米<span className="text-amber-500">图</span>
          </h1>
          <p className="mt-0.5 text-xs text-ink-muted">特需儿童康复 · 图卡与绘本生成</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-bold text-ink">
              账号：
            </label>
            <input
              type="text"
              autoComplete="username"
              placeholder="请输入账号…"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setCovering(false)}
              className="w-full border-0 border-b-2 border-amber-300 bg-transparent px-1 py-1.5 text-sm text-ink caret-amber-500 outline-none transition-colors placeholder:text-neutral-300 focus:border-amber-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-ink">
              密码：
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setCovering(true)}
              onBlur={() => setCovering(false)}
              className="w-full border-0 border-b-2 border-amber-300 bg-transparent px-1 py-1.5 text-sm text-ink caret-amber-500 outline-none transition-colors placeholder:text-neutral-300 focus:border-amber-400"
            />
          </div>

          {error && (
            <p className="animate-fade-in text-center text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(245,180,40,0.4)] transition-colors hover:bg-amber-500 disabled:opacity-60"
          >
            {loading && <Spinner className="h-4 w-4" />}
            LOGIN
          </button>
        </form>
      </div>

      {/* 卡片底部小脚掌装饰 */}
      <div className="mt-3 flex justify-center gap-6">
        <PawIcon />
        <PawIcon />
      </div>

      <p className="mt-4 text-center text-xs text-ink/50">
        演示账号 demo / demo1234
      </p>
    </div>
  );
}

/* 熊猫脚掌 */
function PawIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <ellipse cx="20" cy="26" rx="11" ry="9" fill="#2b2622" />
      <circle cx="10" cy="14" r="4" fill="#2b2622" />
      <circle cx="18" cy="10" r="4" fill="#2b2622" />
      <circle cx="27" cy="12" r="4" fill="#2b2622" />
    </svg>
  );
}
