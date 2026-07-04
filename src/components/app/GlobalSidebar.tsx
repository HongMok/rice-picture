'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '~/context/user-context';
import { toolByKey, type RecentProjectType } from '~/data/tools';
import {
  ChatIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  GraduationIcon,
  MenuIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  SidebarToggleIcon,
  ToolboxIcon,
  TrashIcon,
  UsersIcon,
  WorksIcon,
} from '~/components/ui/icons';
import { BrandmarkGlyph } from '~/components/login/Brandmark';

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
            href="/app/training"
            icon={<GraduationIcon width={18} height={18} />}
            label="培训测评"
            collapsed={collapsed}
            active={pathname?.startsWith('/app/training')}
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

        {/* 用户 —— 点击进入个人信息页；右侧齿轮作为"可点击 / 可编辑"的视觉暗示 */}
        <Link
          href="/app/profile"
          onClick={() => setOpen(false)}
          className={clsx(
            'group flex items-center border-t border-line transition-colors duration-[250ms] ease-out hover:bg-paper-deep',
            collapsed ? 'justify-center py-3' : 'gap-2.5 px-3 py-3',
            pathname === '/app/profile' && 'bg-paper-deep'
          )}
          title={collapsed ? user?.nickname || user?.username || '个人信息' : '个人信息 / 设置'}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-mist text-sm font-medium text-sage-deep">
            {(user?.nickname || user?.username || '?').slice(0, 1)}
          </div>
          {!collapsed && (
            <>
              <span className="min-w-0 max-w-[150px] flex-1 truncate text-[14px] text-ink">
                {user?.nickname || user?.username}
              </span>
              <span
                className="shrink-0 rounded-full p-1.5 text-ink-faint transition-colors duration-[250ms] ease-out group-hover:bg-card group-hover:text-clay-deep"
                aria-hidden
              >
                <SettingsIcon width={15} height={15} />
              </span>
            </>
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
      {state.items.map((item) => (
        <HistoryItem
          key={`${item.type}:${item.id}`}
          item={item}
          collapsed={collapsed}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

/**
 * 单条历史项：hover 时右侧显示 `⋯` 菜单触发器，弹浮层菜单。
 * 操作集：重命名（内联输入）/ 删除（二次确认）—— 对齐 ChatGPT / Claude / Gemini 的最小基线。
 * 5 类资源统一走 endpoint pattern：/api/{type}/${id}（chat 走 chat-sessions）。
 */
function HistoryItem({
  item,
  collapsed,
  onOpen,
}: {
  item: RecentProject;
  collapsed: boolean;
  onOpen: () => void;
}) {
  const Icon = item.type === 'chat' ? ChatIcon : toolByKey(item.type)?.icon;
  const [menuOpen, setMenuOpen] = useState(false);
  // 'idle' → 'renaming'（内联输入）/ 'confirming'（内联"确认删除"按钮）
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirming'>('idle');
  const [editTitle, setEditTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(item.title);
  const [removed, setRemoved] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外部 item.title 变化时同步（乐观刷新后 hydrate 到真数据）
  useEffect(() => {
    setDisplayTitle(item.title);
    setEditTitle(item.title);
  }, [item.title]);

  // 点外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // 5 类资源的 rename / delete endpoint
  function endpoint(): string {
    if (item.type === 'chat') return `/api/chat-sessions/${item.id}`;
    if (item.type === 'book') return `/api/books/${item.id}`;
    if (item.type === 'image') return `/api/works/${item.id}`;
    if (item.type === 'game') return `/api/games/${item.id}`;
    if (item.type === 'video') return `/api/videos/${item.id}`;
    if (item.type === 'lesson-plan') return `/api/lesson-plans/${item.id}`;
    return '';
  }

  async function doRename() {
    const t = editTitle.trim();
    if (!t || t === displayTitle) {
      setMode('idle');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t }),
      });
      if (res.ok) {
        setDisplayTitle(t);
        setMode('idle');
      } else {
        // 简单回滚
        setEditTitle(displayTitle);
      }
    } catch {
      setEditTitle(displayTitle);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch(endpoint(), { method: 'DELETE' });
      if (res.ok) {
        setRemoved(true);
        // 通知侧栏刷新（保险：其它 tab 打开时也同步）
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('xiaohe:history-refresh'));
        }
      } else {
        setMode('idle');
      }
    } catch {
      setMode('idle');
    } finally {
      setBusy(false);
    }
  }

  if (removed) return null;

  // 收起态：只显示图标，不给菜单入口（点击进入项目）
  if (collapsed) {
    return (
      <Link
        href={projectHref(item)}
        onClick={onOpen}
        title={displayTitle}
        className="flex items-center justify-center gap-2 rounded-card px-2 py-2 transition-colors duration-[250ms] ease-out hover:bg-paper-deep"
      >
        {Icon && <Icon width={16} height={16} className="shrink-0 text-ink-soft" />}
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="group relative">
      {/* 主体行 */}
      {mode === 'renaming' ? (
        <div className="flex items-center gap-2 rounded-card bg-paper-deep px-2 py-2">
          {Icon && <Icon width={16} height={16} className="shrink-0 text-ink-soft" />}
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doRename();
              if (e.key === 'Escape') {
                setEditTitle(displayTitle);
                setMode('idle');
              }
            }}
            onBlur={doRename}
            disabled={busy}
            className="min-w-0 flex-1 rounded-input border border-clay-deep/30 bg-card px-2 py-1 text-[14px] text-ink outline-none focus:border-clay-deep"
          />
        </div>
      ) : (
        <Link
          href={projectHref(item)}
          onClick={onOpen}
          title={displayTitle}
          className="flex items-center gap-2 rounded-card px-2 py-2 pr-8 text-left transition-colors duration-[250ms] ease-out hover:bg-paper-deep"
        >
          {Icon && <Icon width={16} height={16} className="shrink-0 text-ink-soft" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-ink">{displayTitle}</p>
            <p className="text-[12px] text-ink-faint">
              {formatUpdatedAt(item.updated_at)}
            </p>
          </div>
        </Link>
      )}

      {/* 三点按钮：hover / menuOpen 时显示 */}
      {mode !== 'renaming' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
            setMode('idle');
          }}
          aria-label="更多操作"
          className={clsx(
            'absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-opacity duration-[200ms] ease-out hover:bg-card hover:text-ink',
            menuOpen ? 'opacity-100 bg-card text-ink' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <MoreHorizontalIcon width={14} height={14} />
        </button>
      )}

      {/* 浮层菜单 */}
      {menuOpen && (
        <div
          className="absolute right-1 top-full z-30 mt-1 w-[140px] overflow-hidden rounded-card border border-line bg-card shadow-lg animate-fade-in"
          role="menu"
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setMode('renaming');
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-paper-deep"
            role="menuitem"
          >
            <EditIcon width={14} height={14} className="text-ink-soft" />
            重命名
          </button>
          {mode === 'confirming' ? (
            <button
              type="button"
              onClick={doDelete}
              disabled={busy}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-[13px] font-medium text-ember-deep transition-colors hover:bg-ember-mist disabled:opacity-60"
              role="menuitem"
            >
              <TrashIcon width={14} height={14} />
              确认删除
              <span
                role="button"
                aria-label="取消"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMode('idle');
                }}
                className="ml-auto text-ink-faint hover:text-ink"
              >
                <CloseIcon width={12} height={12} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('confirming')}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-[13px] text-ember-deep transition-colors hover:bg-ember-mist"
              role="menuitem"
            >
              <TrashIcon width={14} height={14} />
              删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* 小禾印章 Logo：柔角方形 + 萌芽豆子卡通吉祥物 */
function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-clay-deep/25 bg-sage-mist">
      <BrandmarkGlyph size={22} />
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
