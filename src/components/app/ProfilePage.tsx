'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CurrentUser } from '~/libs/auth';
import { Button, Input } from '~/components/ui';
import { useConfirm } from '~/components/ui/dialog';
import { ChevronLeftIcon, LogoutIcon } from '~/components/ui/icons';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'ok' };

export function ProfilePage({ initialUser }: { initialUser: CurrentUser }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [user, setUser] = useState(initialUser);
  const [nickname, setNickname] = useState(initialUser.nickname || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [loggingOut, setLoggingOut] = useState(false);

  const trimmedNickname = nickname.trim();
  const nicknameChanged = trimmedNickname !== (user.nickname || '');
  const passwordFieldsFilled =
    changingPassword &&
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;
  const canSave =
    trimmedNickname.length > 0 &&
    (nicknameChanged || passwordFieldsFilled) &&
    status.kind !== 'saving';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedNickname) {
      setStatus({ kind: 'error', message: '昵称不能为空' });
      return;
    }
    if (changingPassword) {
      if (!currentPassword || !newPassword) {
        setStatus({ kind: 'error', message: '请填写当前密码和新密码' });
        return;
      }
      if (newPassword.length < 6) {
        setStatus({ kind: 'error', message: '新密码至少需要 6 位' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatus({ kind: 'error', message: '两次输入的新密码不一致' });
        return;
      }
    }

    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: trimmedNickname,
          currentPassword: changingPassword ? currentPassword : undefined,
          newPassword: changingPassword ? newPassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: 'error', message: data.error || '保存失败' });
        return;
      }
      setUser(data.user);
      setNickname(data.user.nickname || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
      setStatus({ kind: 'ok' });
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: '网络错误，请重试' });
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    const ok = await confirm({
      title: '退出登录',
      text: '确定要退出当前账号吗？未保存的修改会丢失。',
      confirmLabel: '退出登录',
      cancelLabel: '取消',
      danger: true,
    });
    if (!ok) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 忽略 —— 后端 cookie 已在客户端过期 */
    }
    router.replace('/login');
    router.refresh();
  }

  const initial = (user.nickname || user.username || '?').slice(0, 1);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-12 md:px-10 md:py-16">
      <Link
        href="/app/toolbox"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-ink-soft transition-colors duration-[450ms] ease-out hover:bg-paper-deep hover:text-ink"
      >
        <ChevronLeftIcon width={16} height={16} />
        返回
      </Link>

      {/* 顶部：头像 + 昵称 */}
      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-clay-mist text-2xl font-medium text-clay-deep">
          {initial}
        </div>
        <h1 className="min-w-0 truncate font-serif text-2xl font-normal text-ink">
          {user.nickname || user.username}
        </h1>
      </div>

      {/* 常规信息 */}
      <form onSubmit={handleSave} className="mt-10 space-y-8">
        <section>
          <h2 className="text-base font-medium text-ink">常规信息</h2>
          <p className="mt-1 text-sm text-ink-faint">
            用于在系统和 AI 对话中称呼你。
          </p>

          <div className="mt-5 space-y-4">
            <Field label="账号">
              <Input value={user.username} disabled className="bg-paper-deep text-ink-soft" />
            </Field>

            <Field label="昵称">
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                placeholder="例如：李老师"
              />
            </Field>
          </div>
        </section>

        {/* 修改密码 */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-ink">密码</h2>
              <p className="mt-1 text-sm text-ink-faint">
                {changingPassword
                  ? '输入当前密码后设置一个新密码。'
                  : '不修改可保持原密码不变。'}
              </p>
            </div>
            {!changingPassword && (
              <button
                type="button"
                onClick={() => setChangingPassword(true)}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-[450ms] hover:border-clay hover:text-clay"
              >
                修改密码
              </button>
            )}
          </div>

          {changingPassword && (
            <div className="mt-5 space-y-4">
              <Field label="当前密码">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入当前密码"
                />
              </Field>
              <Field label="新密码">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="至少 6 位"
                />
              </Field>
              <Field label="确认新密码">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="再次输入新密码"
                />
              </Field>
              <button
                type="button"
                onClick={() => {
                  setChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-xs text-ink-faint underline hover:text-ink-soft"
              >
                取消修改密码
              </button>
            </div>
          )}
        </section>

        {status.kind === 'error' && (
          <div className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
            {status.message}
          </div>
        )}
        {status.kind === 'ok' && (
          <div className="rounded-card bg-sage-mist px-4 py-3 text-sm text-sage-deep">
            已保存
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={status.kind === 'saving'} disabled={!canSave}>
            保存修改
          </Button>
        </div>
      </form>

      {/* 退出登录 */}
      <section className="mt-12 border-t border-line pt-8">
        <Button
          variant="outline"
          onClick={handleLogout}
          loading={loggingOut}
          className="gap-1.5 text-ink-soft"
        >
          <LogoutIcon width={16} height={16} />
          退出登录
        </Button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
