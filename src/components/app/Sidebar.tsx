'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '~/context/user-context';
import { Spinner } from '~/components/ui';
import {
  BookIcon,
  ChevronLeftIcon,
  ImageIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
} from '~/components/ui/icons';

export interface LibItem {
  id: number;
  kind: 'image' | 'book';
  title: string | null;
  status: string;
  coverUrl: string | null;
}

export function Sidebar({
  items,
  activeId,
  onNew,
  onOpen,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  items: LibItem[];
  activeId: string | null; // `${kind}:${id}`
  onNew: () => void;
  onOpen: (it: LibItem) => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const user = useUser();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-ink/20 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-cream-line bg-white transition-all duration-200 md:static md:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo + 折叠 */}
        <div className="flex h-14 items-center gap-2 border-b border-cream-line px-3">
          <Logo />
          {!collapsed && (
            <span className="text-base font-bold tracking-tight">
              米<span className="text-clay">图</span>
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="ml-auto hidden rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream md:block"
            aria-label={collapsed ? '展开' : '收起'}
          >
            {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* 新建 */}
        <div className="px-3 pt-3">
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className={clsx(
              'flex w-full items-center gap-2 rounded-xl bg-clay text-sm font-medium text-white shadow-soft transition-colors hover:bg-clay/90',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
            )}
            title="新建创作"
          >
            <PlusIcon />
            {!collapsed && <span>新建创作</span>}
          </button>
        </div>

        {/* 我的作品 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {!collapsed && (
            <p className="px-1 pb-2 text-xs font-medium text-ink-muted">我的作品</p>
          )}
          {items.length === 0 ? (
            !collapsed && (
              <p className="px-1 py-6 text-center text-xs text-ink-muted">
                还没有作品，
                <br />
                点上面「新建创作」开始
              </p>
            )
          ) : (
            <div className="space-y-1">
              {items.map((it) => {
                const pending =
                  it.status === 'DRAFTING' ||
                  it.status === 'ILLUSTRATING' ||
                  it.status === 'PENDING' ||
                  it.status === 'RUNNING';
                const active = activeId === `${it.kind}:${it.id}`;
                return (
                  <button
                    key={`${it.kind}:${it.id}`}
                    onClick={() => {
                      onOpen(it);
                      onClose();
                    }}
                    title={it.title || ''}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                      active
                        ? 'border-clay bg-clay-soft'
                        : 'border-transparent hover:bg-cream',
                      collapsed && 'justify-center'
                    )}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cream-line bg-cream">
                      {it.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : pending ? (
                        <Spinner className="h-4 w-4 text-clay" />
                      ) : it.kind === 'book' ? (
                        <BookIcon className="text-ink-muted" />
                      ) : (
                        <ImageIcon className="text-ink-muted" />
                      )}
                      {/* 类型角标 */}
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-ink-soft shadow">
                        {it.kind === 'book' ? (
                          <BookIcon width={10} height={10} />
                        ) : (
                          <ImageIcon width={10} height={10} />
                        )}
                      </span>
                    </div>
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          {it.title || '未命名'}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {pending
                            ? '创作中…'
                            : it.status === 'FAILED'
                            ? '失败'
                            : it.kind === 'book'
                            ? '绘本'
                            : '图片'}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 用户 */}
        <div
          className={clsx(
            'flex items-center border-t border-cream-line px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-soft text-sm font-medium text-clay">
              {(user?.nickname || user?.username || '?').slice(0, 1)}
            </div>
            {!collapsed && (
              <span className="max-w-[120px] truncate text-sm text-ink">
                {user?.nickname || user?.username}
              </span>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream hover:text-ink"
              title="登出"
            >
              <LogoutIcon />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/* 米图 Logo：一枚圆角方块里的小画框 */
function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-clay text-white">
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <circle cx="9" cy="10" r="1.4" />
        <path d="M20 15l-4.5-4L7 18" />
      </svg>
    </span>
  );
}

/** 读/存收起状态的 hook */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem('mitu.sidebar.collapsed') === '1');
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem('mitu.sidebar.collapsed', c ? '0' : '1');
      return !c;
    });
  return { collapsed, toggle };
}
