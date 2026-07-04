'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '~/components/ui';
import {
  BookIcon,
  DownloadIcon,
  ImageIcon,
  LessonPlanIcon,
  TrashIcon,
  WorksIcon,
} from '~/components/ui/icons';
import { exportBookPdf } from '~/libs/book-pdf';
import { styleName } from '~/data/taxonomy';

/* ---------------- 类型 ---------------- */

type ResourceType = 'image' | 'book' | 'lesson-plan';

interface LibraryItem {
  id: number;
  type: ResourceType;
  title: string;
  coverUrl: string | null;
  subtitle: string | null;
  updatedAt: string;
  createdAt: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; msg: string }
  | { kind: 'ready'; items: LibraryItem[] };

type TabKey = 'all' | ResourceType;

const TAB_META: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图卡' },
  { key: 'book', label: '绘本' },
  { key: 'lesson-plan', label: '教案' },
];

const TYPE_META: Record<
  ResourceType,
  { label: string; icon: typeof ImageIcon; tint: string; text: string }
> = {
  image: { label: '图卡', icon: ImageIcon, tint: 'bg-sage-mist', text: 'text-sage-deep' },
  book: { label: '绘本', icon: BookIcon, tint: 'bg-clay-mist', text: 'text-clay' },
  'lesson-plan': {
    label: '教案',
    icon: LessonPlanIcon,
    tint: 'bg-paper-deep',
    text: 'text-ink-soft',
  },
};

/* ---------------- 主组件 ---------------- */

export function LibraryPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<TabKey>('all');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<LibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/library');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setState({ kind: 'ready', items: data.items || [] });
    } catch {
      setState({ kind: 'error', msg: '资源列表加载失败' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    if (state.kind !== 'ready') return { all: 0, image: 0, book: 0, 'lesson-plan': 0 };
    const c = { all: state.items.length, image: 0, book: 0, 'lesson-plan': 0 };
    for (const it of state.items) c[it.type] += 1;
    return c;
  }, [state]);

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const kw = q.trim().toLowerCase();
    return state.items.filter((it) => {
      if (tab !== 'all' && it.type !== tab) return false;
      if (kw && !it.title.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [state, tab, q]);

  function openItem(it: LibraryItem) {
    if (it.type === 'lesson-plan') {
      router.push(`/app/lesson-plan/${it.id}`);
    } else if (it.type === 'image') {
      router.push(`/app/library/image/${it.id}`);
    } else {
      router.push(`/app/library/book/${it.id}`);
    }
  }

  async function renameItem(it: LibraryItem, nextTitle: string): Promise<boolean> {
    const title = nextTitle.trim();
    if (!title || title === it.title) return false;
    const url =
      it.type === 'image'
        ? `/api/works/${it.id}`
        : it.type === 'book'
        ? `/api/books/${it.id}`
        : `/api/lesson-plans/${it.id}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '保存失败');
        return false;
      }
      // 本地乐观更新，避免全量重拉
      setState((s) =>
        s.kind === 'ready'
          ? {
              ...s,
              items: s.items.map((x) =>
                x.type === it.type && x.id === it.id ? { ...x, title } : x
              ),
            }
          : s
      );
      return true;
    } catch {
      alert('网络错误');
      return false;
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    const url =
      confirm.type === 'image'
        ? `/api/works/${confirm.id}`
        : confirm.type === 'book'
        ? `/api/books/${confirm.id}`
        : `/api/lesson-plans/${confirm.id}`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '删除失败');
        return;
      }
      setState((s) =>
        s.kind === 'ready'
          ? {
              ...s,
              items: s.items.filter((x) => !(x.type === confirm.type && x.id === confirm.id)),
            }
          : s
      );
      setConfirm(null);
    } catch {
      alert('网络错误');
    } finally {
      setDeleting(false);
    }
  }

  async function downloadItem(it: LibraryItem) {
    const key = `${it.type}:${it.id}`;
    if (pdfBusyId) return;
    if (it.type === 'image') {
      if (!it.coverUrl) {
        alert('这张图卡还没生成好');
        return;
      }
      // 走 <a download> 让浏览器直接下载
      const a = document.createElement('a');
      a.href = it.coverUrl;
      a.download = `${it.title || '图卡'}.png`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (it.type === 'book') {
      setPdfBusyId(key);
      try {
        const res = await fetch(`/api/book/${it.id}`);
        if (!res.ok) {
          alert('绘本加载失败');
          return;
        }
        const data = await res.json();
        const pages = (data.pages || []).filter((p: any) => p.status === 'SUCCEEDED');
        if (pages.length === 0) {
          alert('这本绘本还没有已生成的页面');
          return;
        }
        await exportBookPdf(data.book?.title || it.title || '绘本', pages);
      } catch {
        alert('PDF 生成失败，请重试');
      } finally {
        setPdfBusyId(null);
      }
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] font-normal leading-tight text-ink">
            资源管理
          </h1>
          <p className="mt-1.5 text-sm text-ink-faint">
            工具箱生成的图卡、绘本和教案都在这里，可以搜索、重命名、下载和删除。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox value={q} onChange={setQ} />
        </div>
      </header>

      <TabBar tab={tab} onChange={setTab} counts={counts} />

      <main className="mt-6 min-h-[240px]">
        {state.kind === 'loading' ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-clay" />
          </div>
        ) : state.kind === 'error' ? (
          <div className="mx-auto max-w-md rounded-section border border-line bg-white/50 px-6 py-14 text-center">
            <p className="text-sm text-ink">{state.msg}</p>
            <button
              onClick={load}
              className="mt-3 text-xs text-sage-deep hover:underline"
            >
              重试 →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={q.length > 0} tab={tab} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((it) => (
              <Card
                key={`${it.type}:${it.id}`}
                item={it}
                onOpen={() => openItem(it)}
                onRename={(t) => renameItem(it, t)}
                onDelete={() => setConfirm(it)}
                onDownload={() => downloadItem(it)}
                pdfBusy={pdfBusyId === `${it.type}:${it.id}`}
              />
            ))}
          </div>
        )}
      </main>

      {confirm && (
        <ConfirmDialog
          text={`删除「${confirm.title}」？删除后不再显示，如需恢复请联系管理员。`}
          confirmLabel="确认删除"
          loading={deleting}
          onCancel={() => (deleting ? undefined : setConfirm(null))}
          onConfirm={handleDelete}
        />
      )}
      </div>
    </div>
  );
}

/* ---------------- 搜索框 ---------------- */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索标题…"
        className="w-[240px] rounded-full border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-faint/60 outline-none transition-colors focus:border-clay"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] text-ink-faint hover:bg-paper-deep"
          aria-label="清空搜索"
          title="清空"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ---------------- Tab 组 ---------------- */

function TabBar({
  tab,
  onChange,
  counts,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
      {TAB_META.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors',
              active
                ? 'border-clay text-clay-deep'
                : 'border-transparent text-ink-soft hover:text-ink'
            )}
          >
            {t.label}
            <span
              className={clsx(
                'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px]',
                active ? 'bg-clay-mist text-clay-deep' : 'bg-paper-deep text-ink-faint'
              )}
            >
              {counts[t.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- 空态 ---------------- */

function EmptyState({ hasQuery, tab }: { hasQuery: boolean; tab: TabKey }) {
  const tabLabel = TAB_META.find((t) => t.key === tab)?.label || '资源';
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-section border border-dashed border-line bg-white/50 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-mist text-clay">
        <WorksIcon width={22} height={22} />
      </span>
      <p className="mt-4 text-sm font-medium text-ink">
        {hasQuery ? '没有匹配的资源' : `还没有${tabLabel}`}
      </p>
      <p className="mt-1 max-w-xs text-xs leading-[1.9] text-ink-faint">
        {hasQuery
          ? '换个关键词试试，或者清空搜索看看全部。'
          : '去工具箱里生成第一份内容，成品会自动出现在这里。'}
      </p>
    </div>
  );
}

/* ---------------- 卡片 ---------------- */

function Card({
  item,
  onOpen,
  onRename,
  onDelete,
  onDownload,
  pdfBusy,
}: {
  item: LibraryItem;
  onOpen: () => void;
  onRename: (t: string) => Promise<boolean>;
  onDelete: () => void;
  onDownload: () => void;
  pdfBusy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const meta = TYPE_META[item.type];

  useEffect(() => {
    if (!editing) setDraft(item.title);
  }, [editing, item.title]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  async function commit() {
    if (saving) return;
    setSaving(true);
    const ok = await onRename(draft);
    setSaving(false);
    setEditing(false);
    if (!ok) setDraft(item.title);
  }

  const canDownload = item.type === 'image' || item.type === 'book';
  const updated = formatTime(item.updatedAt);
  const Icon = meta.icon;
  const subtitleText = formatSubtitle(item);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-section border border-line bg-card transition-colors duration-[250ms] hover:border-clay/40">
      {/* 缩略图区（点击进入详情） */}
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[4/3] w-full overflow-hidden bg-paper-deep text-left"
        aria-label={`打开${meta.label}：${item.title}`}
      >
        {item.coverUrl && !imgBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-[450ms] group-hover:scale-[1.02]"
            loading="lazy"
            onError={() => setImgBroken(true)}
          />
        ) : item.type === 'lesson-plan' ? (
          <LessonPlanCoverArt />
        ) : (
          <div
            className={clsx(
              'flex h-full w-full items-center justify-center',
              meta.tint
            )}
          >
            <Icon width={44} height={44} className={meta.text} />
          </div>
        )}
        <span
          className={clsx(
            'absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] backdrop-blur-sm',
            meta.tint,
            meta.text
          )}
        >
          <Icon width={12} height={12} />
          {meta.label}
        </span>
      </button>

      {/* 卡片信息 */}
      <div className="flex min-h-[76px] flex-col gap-1.5 px-4 py-3">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') {
                setDraft(item.title);
                setEditing(false);
              }
            }}
            onBlur={commit}
            className="w-full rounded-card border border-clay/40 bg-white px-2 py-1 text-[14px] text-ink outline-none focus:border-clay"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-[14px] font-medium text-ink hover:text-clay"
            title="点击重命名"
          >
            {item.title}
          </button>
        )}
        <p className="truncate text-[12px] text-ink-faint">
          {subtitleText ? (
            <>
              <span>{subtitleText}</span>
              <span className="mx-1.5 opacity-60">·</span>
            </>
          ) : null}
          <span>{updated}</span>
        </p>
      </div>

      {/* 右上悬浮菜单按钮 */}
      <div
        ref={menuRef}
        className={clsx(
          'absolute right-2 top-2 transition-opacity duration-200',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink-soft shadow-sm ring-1 ring-line hover:text-ink"
          aria-label="更多操作"
          title="更多操作"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 min-w-[140px] overflow-hidden rounded-card border border-line bg-white py-1 shadow-lg">
            {canDownload && (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => {
                  setMenuOpen(false);
                  onDownload();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-paper-deep disabled:opacity-50"
              >
                {pdfBusy ? (
                  <Spinner className="h-3.5 w-3.5 text-clay" />
                ) : (
                  <DownloadIcon width={14} height={14} className="text-ink-soft" />
                )}
                {item.type === 'book' ? '下载 PDF' : '下载图片'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-clay hover:bg-clay-mist/70"
            >
              <TrashIcon width={14} height={14} />
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 教案统一封面：一张纸卡 + 折角 + 三行结构 + 勾 ---------------- */

function LessonPlanCoverArt() {
  // 用 Japandi 调色板；只用 SVG 保持清晰度，不依赖任何位图
  const paper = '#F7F1E6';
  const paperLine = '#E4D9C4';
  const clay = '#B18463';
  const claySoft = '#D8B593';
  const sage = '#7FA98B';
  const ink = '#3E3A36';
  return (
    <div className="flex h-full w-full items-center justify-center bg-sage-mist">
      <svg
        viewBox="0 0 200 150"
        preserveAspectRatio="xMidYMid meet"
        width="60%"
        height="60%"
        aria-hidden="true"
        role="img"
      >
        {/* 纸卡本体（带折角） */}
        <path
          d="M40 22 H140 L160 42 V128 H40 Z"
          fill={paper}
          stroke={ink}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {/* 折角三角 */}
        <path
          d="M140 22 V42 H160 Z"
          fill={paperLine}
          stroke={ink}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {/* 顶部彩条：教案标题条 */}
        <rect x="50" y="34" width="72" height="6" rx="2" fill={clay} />
        {/* 结构行 1 */}
        <rect x="50" y="52" width="90" height="4" rx="1.5" fill={ink} opacity="0.85" />
        {/* 结构行 2 */}
        <rect x="50" y="66" width="76" height="4" rx="1.5" fill={ink} opacity="0.55" />
        {/* 结构行 3 */}
        <rect x="50" y="80" width="86" height="4" rx="1.5" fill={ink} opacity="0.55" />
        {/* 结构行 4（短一些） */}
        <rect x="50" y="94" width="52" height="4" rx="1.5" fill={ink} opacity="0.35" />
        {/* 装订孔（左侧两个点） */}
        <circle cx="46" cy="60" r="1.6" fill={claySoft} />
        <circle cx="46" cy="80" r="1.6" fill={claySoft} />
        {/* 右下勾选：教学要点已定 */}
        <circle cx="140" cy="112" r="10" fill={sage} />
        <path
          d="M134 112.5 l4 4 l8 -8"
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ---------------- 确认弹层（照抄 CasesManager 风格）---------------- */

function ConfirmDialog({
  text,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  text: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-6">
      <div className="w-full max-w-sm rounded-section bg-card p-6">
        <p className="text-sm leading-[1.9] text-ink">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-full px-4 py-2 text-xs text-ink-soft hover:bg-paper-deep disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#C08585' }}
          >
            {loading && <Spinner className="h-3 w-3" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 时间格式化 ---------------- */

// 把 API 返回的原始 subtitle（英文 key 或未加工文本）转成中文副标题
function formatSubtitle(item: LibraryItem): string {
  const raw = item.subtitle;
  if (!raw) return '';
  if (item.type === 'image') {
    // 形如 "image:warm" / "image:line"，冒号后是 STYLES 里的 key
    const colon = raw.indexOf(':');
    const key = colon >= 0 ? raw.slice(colon + 1) : raw;
    const cn = styleName(key);
    return `${cn}图卡`;
  }
  if (item.type === 'lesson-plan') {
    // 目前 lesson_plans.type 唯一值就是 'ABA-DTT'
    if (raw === 'ABA-DTT') return 'DTT 教案';
    return raw;
  }
  // book: '共 N 页'，保持
  return raw;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffMs < oneDay * 2) return '昨天';
  if (diffMs < oneDay * 7) return `${Math.floor(diffMs / oneDay)} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}
