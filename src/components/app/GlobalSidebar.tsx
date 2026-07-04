'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '~/context/user-context';
import { toolByKey, type RecentProjectType } from '~/data/tools';
import {
  ChatIcon,
  ClockIcon,
  MenuIcon,
  SidebarToggleIcon,
  ToolboxIcon,
  UsersIcon,
  WorksIcon,
} from '~/components/ui/icons';

interface RecentProject {
  id: number;
  type: RecentProjectType | 'chat';
  title: string;
  updated_at: string;
  created_at: string;
}

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: RecentProject[] };

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function projectHref(item: RecentProject): string {
  if (item.type === 'lesson-plan') return `/app/lesson-plan/${item.id}`;
  if (item.type === 'chat') return `/app/chat?id=${item.id}`;
  return `/app?panel=${item.type}&open=${item.id}`;
}

export function GlobalSidebar() {
  const user = useUser();
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapsed();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ kind: 'loading' });

  useEffect(() => {
    loadHistory();
  }, []);

  // 监听全站派发的历史刷新事件（新对话/新作品创建时触发）
  useEffect(() => {
    function onRefresh() {
      loadHistory();
    }
    function onOptimisticAdd(e: Event) {
      const detail = (e as CustomEvent<RecentProject>).detail;
      if (!detail) return;
      setHistory((s) =>
        s.kind === 'ready'
          ? { kind: 'ready', items: [detail, ...s.items] }
          : s
      );
    }
    window.addEventListener('xiaohe:history-refresh', onRefresh);
    window.addEventListener('xiaohe:history-add', onOptimisticAdd as EventListener);
    return () => {
      window.removeEventListener('xiaohe:history-refresh', onRefresh);
      window.removeEventListener('xiaohe:history-add', onOptimisticAdd as EventListener);
    };
  }, []);

  async function loadHistory() {
    // 只在首次或没有 items 时进入 loading 骨架，避免在有条目时先 flash 空态
    setHistory((s) => (s.kind === 'ready' ? s : { kind: 'loading' }));
    try {
      const res = await fetch('/api/projects/recent');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory({ kind: 'ready', items: data.items || [] });
    } catch {
      setHistory({ kind: 'error' });
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-ink/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 移动端顶部展开触发（默认折叠态下的入口） */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink-soft shadow-none md:hidden"
        aria-label="展开侧栏"
      >
        <MenuIcon width={18} height={18} />
      </button>

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-card transition-[width,transform] duration-[350ms] ease-out md:static md:translate-x-0',
          collapsed ? 'w-[64px]' : 'w-[260px]',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* 头部：展开态 Logo+品牌+收起按钮；收起态只居中一个展开按钮 */}
        <div
          className={clsx(
            'flex h-14 shrink-0 items-center border-b border-line',
            collapsed ? 'justify-center' : 'gap-2.5 px-3'
          )}
        >
          {collapsed ? (
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-card text-ink-soft transition-colors duration-[250ms] ease-out hover:bg-paper-deep hover:text-ink"
              aria-label="展开侧栏"
              title="展开侧栏"
            >
              <SidebarToggleIcon direction="right" width={18} height={18} />
            </button>
          ) : (
            <>
              <Logo />
              <span className="flex items-baseline gap-1.5">
                <span className="font-serif text-[17px] font-medium tracking-[0.02em] leading-none text-clay-deep">
                  小禾
                </span>
                <span className="text-[11px] font-medium tracking-[0.24em] leading-none text-ink">
                  AI
                </span>
              </span>
              <button
                onClick={toggle}
                className="ml-auto hidden h-8 w-8 items-center justify-center rounded-card text-ink-faint transition-colors duration-[250ms] ease-out hover:bg-paper-deep hover:text-ink md:flex"
                aria-label="收起侧栏"
                title="收起侧栏"
              >
                <SidebarToggleIcon direction="left" width={17} height={17} />
              </button>
            </>
          )}
        </div>

        {/* 工具箱 + 资源管理 + 个案管理 + 小禾AI */}
        <div className={clsx('flex flex-col gap-1 pt-3', collapsed ? 'px-2' : 'px-3')}>
          <NavEntry
            href="/app/toolbox"
            icon={<ToolboxIcon width={18} height={18} />}
            label="工具箱"
            collapsed={collapsed}
            active={pathname === '/app/toolbox'}
          />
          <NavEntry
            href="/app/library"
            icon={<WorksIcon width={18} height={18} />}
            label="资源管理"
            collapsed={collapsed}
            active={pathname?.startsWith('/app/library')}
          />
          <NavEntry
            href="/app/cases"
            icon={<UsersIcon width={18} height={18} />}
            label="个案管理"
            collapsed={collapsed}
            active={pathname?.startsWith('/app/cases')}
          />
          <NavEntry
            href="/app/chat"
            icon={<ChatIcon width={18} height={18} />}
            label="小禾AI"
            collapsed={collapsed}
            active={pathname === '/app/chat'}
          />
        </div>

        {/* 过去 30 天历史（收起态隐藏） */}
        {collapsed ? (
          <div className="flex-1" />
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto px-3 pb-3">
            <p className="flex items-center gap-1.5 px-1 pb-2 text-[12px] text-ink-faint">
              <ClockIcon width={13} height={13} />
              过去 30 天
            </p>
            <HistoryList
              state={history}
              collapsed={collapsed}
              onRetry={loadHistory}
              onOpen={() => setOpen(false)}
            />
          </div>
        )}

        {/* 用户 —— 点击进入个人信息页 */}
        <Link
          href="/app/profile"
          onClick={() => setOpen(false)}
          className={clsx(
            'flex items-center border-t border-line transition-colors duration-[250ms] ease-out hover:bg-paper-deep',
            collapsed ? 'justify-center py-3' : 'gap-2.5 px-3 py-3',
            pathname === '/app/profile' && 'bg-paper-deep'
          )}
          title={collapsed ? user?.nickname || user?.username || '个人信息' : '个人信息'}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-mist text-sm font-medium text-sage-deep">
            {(user?.nickname || user?.username || '?').slice(0, 1)}
          </div>
          {!collapsed && (
            <span className="max-w-[180px] truncate text-[14px] text-ink">
              {user?.nickname || user?.username}
            </span>
          )}
        </Link>
      </aside>
    </>
  );
}

function NavEntry({
  href,
  icon,
  label,
  collapsed,
  primary,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center rounded-card text-[15px] font-medium transition-colors duration-[250ms] ease-out',
        collapsed ? 'h-10 w-10 justify-center' : 'gap-2.5 px-3 py-2.5',
        primary
          ? 'bg-sage text-white hover:bg-sage-deep'
          : active
          ? 'bg-sage-mist text-sage-deep'
          : 'text-ink hover:bg-paper-deep'
      )}
      title={label}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function HistoryList({
  state,
  collapsed,
  onRetry,
  onOpen,
}: {
  state: HistoryState;
  collapsed: boolean;
  onRetry: () => void;
  onOpen: () => void;
}) {
  if (state.kind === 'loading') {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-breathe rounded-card bg-paper-deep" />
        ))}
      </div>
    );
  }

  if (state.kind === 'error') {
    if (collapsed) return null;
    return (
      <div className="px-1 py-4 text-center">
        <p className="text-xs text-ink-faint">历史列表暂时加载不出来。</p>
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-sage-deep hover:underline"
        >
          重试 →
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    if (collapsed) return null;
    return (
      <p className="px-1 py-6 text-center text-xs leading-relaxed text-ink-faint">
        还没有项目，从工具箱挑一个开始也可以。
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {state.items.map((item) => {
        // chat 类型不在 tools 表中，走 ChatIcon
        const Icon =
          item.type === 'chat' ? ChatIcon : toolByKey(item.type)?.icon;
        return (
          <Link
            key={`${item.type}:${item.id}`}
            href={projectHref(item)}
            onClick={onOpen}
            title={item.title}
            className={clsx(
              'flex items-center gap-2 rounded-card px-2 py-2 text-left transition-colors duration-[250ms] ease-out hover:bg-paper-deep',
              collapsed && 'justify-center'
            )}
          >
            {Icon && <Icon width={16} height={16} className="shrink-0 text-ink-soft" />}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">{item.title}</p>
                <p className="text-[12px] text-ink-faint">{formatUpdatedAt(item.updated_at)}</p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* 小禾印章 Logo：柔角方形 + 卡通萌芽（黑边+绿叶+土堆，一大一小对生）*/
function Logo() {
  const leaf = '#7FA98B';
  const leafShade = '#5E8A6E';
  const stroke = '#3E3A36';
  const soil = '#C9A57B';
  const soilStroke = '#8B6F4E';
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-clay-deep/25 bg-sage-mist">
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
        <path d="M4.5 21.5 C 6 20, 9 19.4, 12 19.4 C 15 19.4, 18 20, 19.5 21.5 Z" fill={soil} stroke={soilStroke} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M11.6 19.6 C 11.9 16, 12.2 12.5, 12.6 8.4" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        <path d="M11.9 15.2 C 10.4 15, 8.8 14.6, 7.4 13.6" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M7.4 13.6 C 5.4 13.2, 3.6 12.4, 3 10.8 C 2.8 10.2, 3.2 9.8, 4 9.9 C 5.6 10.1, 7.2 10.9, 8.6 12.2 C 9.2 12.8, 9 13.4, 8.2 13.6 C 7.9 13.68, 7.6 13.64, 7.4 13.6 Z" fill={leaf} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M4.4 10.8 C 5.6 11.3, 6.8 12, 8 12.6" stroke={leafShade} strokeWidth={0.9} strokeLinecap="round" fill="none" />
        <path d="M12.6 8.4 C 13.4 7.6, 14.4 6.8, 15.6 6.2" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M15.6 6.2 C 17.8 5, 20 5, 21 6.4 C 21.8 7.6, 21.6 9.4, 20.4 11 C 19 12.8, 16.6 13.8, 14.2 13.4 C 12.8 13.2, 12.2 12.4, 12.6 11.2 C 13 10, 14 8.4, 15.6 6.2 Z" fill={leaf} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M13.6 12 C 15.4 10.6, 17.2 9.2, 19.4 7.8" stroke={leafShade} strokeWidth={1} strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

/** 读/存收起状态；视口 <768px 默认折叠 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('xiaohe.sidebar.collapsed');
    if (stored !== null) {
      setCollapsed(stored === '1');
    } else {
      setCollapsed(window.innerWidth < 768);
    }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem('xiaohe.sidebar.collapsed', c ? '0' : '1');
      return !c;
    });
  return { collapsed, toggle };
}
