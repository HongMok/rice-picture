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
  visible = true,
}: {
  items: LibItem[];
  activeId: string | null; // `${kind}:${id}`
  onNew: () => void;
  onOpen: (it: LibItem) => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** false 时整个作品库面板不渲染（如互动游戏/视频分析模块，内部自带列表，不需要这层） */
  visible?: boolean;
}) {
  const user = useUser();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  if (!visible) return null;

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
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-white transition-all duration-[450ms] md:static md:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo + 折叠 */}
        <div className="flex h-14 items-center gap-2 border-b border-line px-3">
          <Logo />
          {!collapsed && (
            <span className="text-base tracking-tight">
              <span className="text-clay">小禾</span>
              <span className="text-ink">AI</span>
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="ml-auto hidden rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-paper md:block"
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
              'flex w-full items-center gap-2 rounded-card bg-clay text-sm font-medium text-white transition-colors hover:bg-clay/90',
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
            <p className="px-1 pb-2 text-xs font-medium text-ink-faint">我的作品</p>
          )}
          {items.length === 0 ? (
            !collapsed && (
              <p className="px-1 py-6 text-center text-xs text-ink-faint">
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
                      'flex w-full items-center gap-3 rounded-card border p-2 text-left transition-colors',
                      active
                        ? 'border-clay bg-clay-mist'
                        : 'border-transparent hover:bg-paper',
                      collapsed && 'justify-center'
                    )}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
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
                        <BookIcon className="text-ink-faint" />
                      ) : (
                        <ImageIcon className="text-ink-faint" />
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
                        <p className="text-xs text-ink-faint">
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
            'flex items-center border-t border-line px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-mist text-sm font-medium text-clay">
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
              className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-paper hover:text-ink"
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

/* 小禾 Logo：主色底 + 白色嫩苗（茎/双叶/顶芽） */
function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-clay text-white">
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
        <path d="M12 21V8.5" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M12 14.5c-3 0-5-2-5-5.2 3 0 5 2 5 5.2Z" fill="currentColor" />
        <path d="M12 11.5c3 0 5.2-2 5.2-5.2-3 0-5.2 2-5.2 5.2Z" fill="currentColor" fillOpacity="0.85" />
        <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

/** 读/存收起状态的 hook */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem('xiaohe.sidebar.collapsed') === '1');
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem('xiaohe.sidebar.collapsed', c ? '0' : '1');
      return !c;
    });
  return { collapsed, toggle };
}
