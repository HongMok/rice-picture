'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibItem } from '~/components/app/Sidebar';
import type { ModuleKey } from '~/components/app/ModuleNav';
import { Composer, type ComposerState } from '~/components/app/Composer';
import {
  TemplateGallery,
  type TemplateItem,
  formatTemplateBrief,
} from '~/components/app/TemplateGallery';
import { BookProgress } from '~/components/app/BookProgress';
import { BookReader, type ReaderPage } from '~/components/app/BookReader';
import { GameStudio } from '~/components/app/GameStudio';
import { VideoStudio } from '~/components/app/VideoStudio';
import { PanelBackProvider, usePanelBack } from '~/components/app/PanelBack';
import { Button, Spinner } from '~/components/ui';
import {
  DownloadIcon,
  BookIcon,
  ChevronLeftIcon,
  ImageIcon,
  SparkleIcon,
} from '~/components/ui/icons';
import { toolByKey } from '~/data/tools';
import { DEFAULT_RATIO, DEFAULT_PAGE_COUNT } from '~/data/taxonomy';
import { exportBookPdf } from '~/libs/book-pdf';

type Stage =
  | { kind: 'compose' }
  | { kind: 'image-done'; url: string; title: string }
  | { kind: 'book-generating'; bookId: number; title: string }
  | { kind: 'book-done'; bookId: number; title: string };

/** 通知 GlobalSidebar：乐观塞一条历史项（即刻可见），随后 refresh 会用真数据 hydrate */
function dispatchHistoryAdd(item: {
  id: number;
  type: 'image' | 'book';
  title: string;
}) {
  if (typeof window === 'undefined') return;
  const nowIso = new Date().toISOString();
  window.dispatchEvent(
    new CustomEvent('xiaohe:history-add', {
      detail: { ...item, updated_at: nowIso, created_at: nowIso },
    })
  );
}
function dispatchHistoryRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('xiaohe:history-refresh'));
}

export function Workbench({
  initialItems,
  initialPanel,
  initialOpenId,
}: {
  initialItems: LibItem[];
  initialPanel?: ModuleKey;
  initialOpenId?: number;
}) {
  const [items, setItems] = useState<LibItem[]>(initialItems);
  const [composer, setComposer] = useState<ComposerState>({
    mode: initialPanel === 'book' ? 'book' : 'image',
    brief: '',
    styleKey: 'warm',
    ratio: DEFAULT_RATIO,
    pageCount: DEFAULT_PAGE_COUNT,
  });
  const [stage, setStage] = useState<Stage>({ kind: 'compose' });
  const [generating, setGenerating] = useState(false);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [pageTotal, setPageTotal] = useState(0);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerTitle, setReaderTitle] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  // 本次会话在这个 Workbench 里点过「生成」的作品 id 集合。主区的进度/结果卡片只渲染这些，
  // 避免历史堆到主区里；左栏仍显示全部作品。
  const [sessionIds, setSessionIds] = useState<Set<string>>(() => new Set());
  const trackSession = (kind: 'image' | 'book', id: number) =>
    setSessionIds((s) => new Set(s).add(`${kind}:${id}`));
  const panel: ModuleKey = initialPanel || 'image';

  async function downloadPdf(title: string) {
    setPdfBusy(true);
    try {
      await exportBookPdf(title, pages);
    } catch {
      alert('PDF 生成失败，请重试');
    } finally {
      setPdfBusy(false);
    }
  }

  // 多任务并行：每个正在轮询的 task/book 各持有自己的 timeout；key = `image:${taskId}` | `book:${bookId}`
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const setTimer = (key: string, t: ReturnType<typeof setTimeout>) => {
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    timers.current.set(key, t);
  };
  const clearTimerFor = (key: string) => {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
  };
  const clearAllTimers = () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
  };

  const patch = (p: Partial<ComposerState>) => setComposer((s) => ({ ...s, ...p }));
  useEffect(() => clearAllTimers, []);

  const refreshItems = useCallback(async () => {
    const [w, b] = await Promise.all([
      fetch('/api/works').then((r) => (r.ok ? r.json() : { works: [] })),
      fetch('/api/books').then((r) => (r.ok ? r.json() : { books: [] })),
    ]);
    const merged: LibItem[] = [
      ...(b.books || []).map((x: any) => ({
        id: x.id,
        kind: 'book' as const,
        title: x.title,
        status: x.status,
        coverUrl: x.coverUrl,
      })),
      ...(w.works || []).map((x: any) => ({
        id: x.id,
        kind: 'image' as const,
        title: x.title,
        status: x.status,
        coverUrl: x.output_url,
      })),
    ];
    setItems(merged);
  }, []);

  /* ---------- 图片模式轮询（后台，多任务并行） ---------- */
  const pollImage = useCallback(
    (taskId: string, attempt = 0) => {
      const key = `image:${taskId}`;
      setTimer(
        key,
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/generate/${taskId}`);
            const data = await res.json();
            if (data.status === 'SUCCEEDED' && data.imageUrl) {
              clearTimerFor(key);
              refreshItems();
              dispatchHistoryRefresh();
              return;
            }
            if (data.status === 'FAILED' || attempt > 40) {
              clearTimerFor(key);
              refreshItems();
              dispatchHistoryRefresh();
              return;
            }
            pollImage(taskId, attempt + 1);
          } catch {
            pollImage(taskId, attempt + 1);
          }
        }, 3000)
      );
    },
    [refreshItems]
  );

  /* ---------- 绘本模式轮询（后台，多任务并行） ---------- */
  const pollBook = useCallback(
    (bookId: number, attempt = 0) => {
      const key = `book:${bookId}`;
      setTimer(
        key,
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/book/${bookId}`);
            const data = await res.json();
            if (!res.ok) throw new Error();
            // 若用户此刻正打开这本绘本进度页，同步刷新本地 pages / doneCount
            setActiveId((cur) => {
              if (cur === `book:${bookId}`) {
                setPages(data.pages);
                setDoneCount(data.doneCount);
                setPageTotal(data.book.pageCount);
                if (data.book.status === 'DONE') {
                  setStage({ kind: 'book-done', bookId, title: data.book.title });
                } else if (data.book.status !== 'FAILED') {
                  setStage({ kind: 'book-generating', bookId, title: data.book.title || '' });
                }
              }
              return cur;
            });
            if (data.book.status === 'DONE' || data.book.status === 'FAILED') {
              clearTimerFor(key);
              refreshItems();
              dispatchHistoryRefresh();
              return;
            }
            if (attempt > 80) {
              clearTimerFor(key);
              refreshItems();
              dispatchHistoryRefresh();
              return;
            }
            pollBook(bookId, attempt + 1);
          } catch {
            pollBook(bookId, attempt + 1);
          }
        }, 3000)
      );
    },
    [refreshItems]
  );

  /* ---------- 生成 ---------- */
  /**
   * 提交后立刻回到「输入框 + 模板列表」的初始态，并在左侧历史顶端乐观塞一条
   * PENDING 条目，用户可以继续修改输入框、点其它模板并行提交下一张。
   * 轮询在后台各自跑，完成后 refreshItems() 会用真数据覆盖乐观条目。
   */
  async function handleGenerate() {
    if (generating) return; // 防止 rapid 双击造成重复提交
    setGenerating(true);
    if (composer.mode === 'image') {
      const briefText = composer.brief.trim();
      const optimisticTitle =
        briefText.split('\n')[0].replace(/^主题：/, '').slice(0, 30) ||
        briefText.slice(0, 30);
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief: briefText,
            styleKey: composer.styleKey,
            ratio: composer.ratio,
            templateId: composer.templateId ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || '生成失败');
          return;
        }
        // 乐观：左侧列表顶端塞一条 PENDING
        setItems((cur) => [
          {
            id: data.workId,
            kind: 'image' as const,
            title: optimisticTitle,
            status: 'PENDING',
            coverUrl: null,
          },
          ...cur.filter((x) => !(x.kind === 'image' && x.id === data.workId)),
        ]);
        // 同步 GlobalSidebar 的「过去 30 天」历史：先乐观加一条，再触发一次真实拉取
        dispatchHistoryAdd({
          id: data.workId,
          type: 'image',
          title: optimisticTitle || '未命名图卡',
        });
        dispatchHistoryRefresh();
        trackSession('image', data.workId);
        pollImage(data.taskId);
      } catch {
        alert('网络错误');
      } finally {
        setGenerating(false);
      }
    } else {
      const briefText = composer.brief.trim();
      const optimisticTitle =
        briefText.split('\n')[0].replace(/^主题：/, '').slice(0, 30) ||
        briefText.slice(0, 30) ||
        '新绘本';
      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief: briefText,
            options: { styleKey: composer.styleKey },
            pageCount: composer.pageCount,
            ratio: composer.ratio,
            templateId: composer.templateId ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || '生成失败');
          return;
        }
        setItems((cur) => [
          {
            id: data.bookId,
            kind: 'book' as const,
            title: data.title || optimisticTitle,
            status: 'ILLUSTRATING',
            coverUrl: null,
          },
          ...cur.filter((x) => !(x.kind === 'book' && x.id === data.bookId)),
        ]);
        dispatchHistoryAdd({
          id: data.bookId,
          type: 'book',
          title: data.title || optimisticTitle || '未命名绘本',
        });
        dispatchHistoryRefresh();
        trackSession('book', data.bookId);
        pollBook(data.bookId);
      } catch {
        alert('网络错误');
      } finally {
        setGenerating(false);
      }
    }
  }

  /* ---------- 失败重试：调后端 retry API，前端把该条置回 PENDING 并恢复轮询 ---------- */
  async function retryItem(it: LibItem) {
    const url =
      it.kind === 'image'
        ? `/api/generate/${it.id}/retry`
        : `/api/book/${it.id}/retry`;
    // 先乐观置回 pending
    setItems((cur) =>
      cur.map((x) =>
        x.kind === it.kind && x.id === it.id
          ? {
              ...x,
              status: it.kind === 'image' ? 'PENDING' : 'ILLUSTRATING',
              coverUrl: null,
            }
          : x
      )
    );
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // 失败：把该条状态回到 FAILED
        setItems((cur) =>
          cur.map((x) =>
            x.kind === it.kind && x.id === it.id ? { ...x, status: 'FAILED' } : x
          )
        );
        alert(data.error || '重试失败');
        return;
      }
      if (it.kind === 'image') {
        pollImage(data.taskId);
      } else {
        pollBook(data.bookId);
      }
      dispatchHistoryRefresh();
    } catch {
      setItems((cur) =>
        cur.map((x) =>
          x.kind === it.kind && x.id === it.id ? { ...x, status: 'FAILED' } : x
        )
      );
      alert('网络错误');
    }
  }

  /* ---------- 模板填充（不清后台轮询，保留正在进行的任务） ---------- */
  function pickTemplate(t: TemplateItem) {
    setStage({ kind: 'compose' });
    patch({
      mode: t.kind,
      brief: formatTemplateBrief(t),
      styleKey: t.styleKey,
      pageCount: t.options?.pageCount || DEFAULT_PAGE_COUNT,
      templateId: t.id,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * 打开已有作品：
   * - 图卡 / 绘本：不进入大图/进度独立页；而是复原 Composer 的输入框和参数，
   *   把该作品加入 sessionCards，用户能在同一界面看到进度或成品缩略图。
   * - 若作品未完成，恢复后台轮询。
   */
  async function openItem(it: LibItem) {
    setActiveId(`${it.kind}:${it.id}`);
    // 确保主视图停在 Composer（sessionCards 只在 stage=compose 时渲染）
    setStage({ kind: 'compose' });
    // 让该作品进入主区卡片区
    setSessionIds((s) => new Set(s).add(`${it.kind}:${it.id}`));

    if (it.kind === 'image') {
      try {
        const res = await fetch(`/api/works/${it.id}`);
        if (!res.ok) return;
        const { work } = await res.json();
        // 回填 Composer
        patch({
          mode: 'image',
          brief: work.brief || '',
          styleKey: work.styleKey || composer.styleKey,
          ratio: work.ratio || composer.ratio,
          templateId: null,
        });
        // items 若无这条，补上（例如来自 URL 直达但列表还没加载到）
        setItems((cur) =>
          cur.some((x) => x.kind === 'image' && x.id === it.id)
            ? cur
            : [
                {
                  id: it.id,
                  kind: 'image',
                  title: work.title || it.title,
                  status: work.status,
                  coverUrl: work.outputUrl || null,
                },
                ...cur,
              ]
        );
        // 未完成 → 恢复轮询
        if (
          work.taskId &&
          (work.status === 'PENDING' || work.status === 'RUNNING')
        ) {
          pollImage(work.taskId);
        }
      } catch {
        /* 忽略 */
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // book
    try {
      const res = await fetch(`/api/book/${it.id}`);
      if (!res.ok) return;
      const data = await res.json();
      // 回填 Composer
      const opts = data.book.options || {};
      patch({
        mode: 'book',
        brief: data.book.brief || '',
        styleKey: opts.styleKey || composer.styleKey,
        ratio: opts.ratio || composer.ratio,
        pageCount: data.book.pageCount || composer.pageCount,
        templateId: null,
      });
      setItems((cur) =>
        cur.some((x) => x.kind === 'book' && x.id === it.id)
          ? cur
          : [
              {
                id: it.id,
                kind: 'book',
                title: data.book.title || it.title,
                status: data.book.status,
                coverUrl: data.pages?.[0]?.imageUrl || null,
              },
              ...cur,
            ]
      );
      // 供 reader/BookProgress 使用
      setPages(data.pages);
      setDoneCount(data.doneCount);
      setPageTotal(data.book.pageCount);
      setReaderTitle(data.book.title || '绘本');
      // 未完成 → 恢复轮询
      if (
        data.book.status === 'DRAFTING' ||
        data.book.status === 'ILLUSTRATING'
      ) {
        pollBook(it.id);
      }
    } catch {
      /* 忽略 */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 通过 URL ?open=<id> 自动打开一次 ---------- */
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    if (!initialOpenId) return;
    const wantKind: LibItem['kind'] = panel === 'book' ? 'book' : 'image';
    const it = items.find((x) => x.id === initialOpenId && x.kind === wantKind);
    if (!it) return;
    openedRef.current = true;
    openItem(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId, panel, items]);

  function newCreation() {
    // 只切主视图；正在后台跑的轮询继续
    setActiveId(null);
    setStage({ kind: 'compose' });
    patch({ brief: '', templateId: null });
  }

  const tool = toolByKey(panel);

  return (
    <PanelBackProvider>
    <div className="flex h-full overflow-hidden bg-paper">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏：返回（若子模块注册了 override 则先调它，否则回工具箱）+ 当前工具名 */}
        <PanelHeader tool={tool} />


        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {panel === 'game' ? (
            <GameStudio />
          ) : panel === 'video' ? (
            <VideoStudio />
          ) : (
            <>
          {/* 生成区 */}
          <Composer
            state={composer}
            setState={patch}
            generating={generating}
            onGenerate={handleGenerate}
          />

          {/* 本次会话的进行中 / 已完成卡片（横向堆叠；点卡片打开大图 / 进度） */}
          {stage.kind === 'compose' && (
            <SessionCards
              items={items}
              sessionIds={sessionIds}
              mode={composer.mode}
              onOpen={openItem}
              onRetry={retryItem}
              onReadBook={async (it) => {
                // 先确保本地 pages 是这本的（可能已经在 openItem 里拉过；这里再拉一次以防用户直接从大列表点）
                try {
                  const res = await fetch(`/api/book/${it.id}`);
                  if (res.ok) {
                    const d = await res.json();
                    setPages(d.pages);
                    setDoneCount(d.doneCount);
                    setPageTotal(d.book.pageCount);
                    setReaderTitle(d.book.title || '绘本');
                  }
                } catch {}
                setReaderOpen(true);
              }}
            />
          )}

          {/* 结果 / 进度 */}
          <div className="mx-auto mt-6 w-full max-w-3xl">
            {/* image-done：仅从左侧历史点开已完成图卡时展示；提交后不会自动进入 */}
            {stage.kind === 'image-done' && (
              <div className="rounded-section border border-line bg-white p-4">
                <div className="overflow-hidden rounded-card border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stage.url} alt={stage.title} className="w-full" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {stage.title}
                  </p>
                  <a href={stage.url} target="_blank" rel="noreferrer" download>
                    <Button variant="outline" className="gap-1.5">
                      <DownloadIcon width={16} height={16} />
                      下载
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* book-generating / book-done：仅从左侧历史打开时展示 */}
            {(stage.kind === 'book-generating' || stage.kind === 'book-done') && (
              <div className="flex flex-col items-center">
                <BookProgress
                  title={stage.title}
                  pages={pages}
                  doneCount={doneCount}
                  total={pageTotal}
                  phase={
                    stage.kind === 'book-generating' && !stage.title
                      ? 'writing'
                      : 'illustrating'
                  }
                />
                {stage.kind === 'book-done' && (
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Button
                      className="gap-1.5 px-6 py-2.5"
                      onClick={() => {
                        setReaderTitle(stage.title);
                        setReaderOpen(true);
                      }}
                    >
                      <BookIcon width={16} height={16} />
                      打开阅读
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5 px-6 py-2.5"
                      loading={pdfBusy}
                      onClick={() => downloadPdf(stage.title)}
                    >
                      <DownloadIcon width={16} height={16} />
                      下载 PDF
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 模板库（仅在初始 compose 态展示，按当前模式区分图片/绘本） */}
          {stage.kind === 'compose' && (
            <TemplateGallery kind={composer.mode} onPick={pickTemplate} />
          )}
            </>
          )}
        </main>
      </div>

      {readerOpen && (
        <BookReader
          title={readerTitle}
          pages={pages}
          onClose={() => setReaderOpen(false)}
          onDownloadPdf={() => downloadPdf(readerTitle)}
          pdfBusy={pdfBusy}
        />
      )}
    </div>
    </PanelBackProvider>
  );
}

/**
 * 主区「本次生成」卡片区：把左栏历史里、本次会话触发的作品，
 * 以横向卡片网格的方式在主区同步展示。生成中显示 spinner，完成后就地变缩略图卡。
 */
function SessionCards({
  items,
  sessionIds,
  mode,
  onOpen,
  onRetry,
  onReadBook,
}: {
  items: LibItem[];
  sessionIds: Set<string>;
  mode: 'image' | 'book';
  onOpen: (it: LibItem) => void;
  onRetry: (it: LibItem) => void;
  onReadBook: (it: LibItem) => void;
}) {
  const list = items.filter(
    (it) => it.kind === mode && sessionIds.has(`${it.kind}:${it.id}`)
  );
  if (list.length === 0) return null;
  return (
    <div className="mx-auto mt-6 w-full max-w-3xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((it) => {
          const pending =
            it.status === 'DRAFTING' ||
            it.status === 'ILLUSTRATING' ||
            it.status === 'PENDING' ||
            it.status === 'RUNNING';
          const failed = it.status === 'FAILED';
          // 图卡完成态 = SUCCEEDED，绘本完成态 = DONE。两者统一判 done。
          const done = !pending && !failed && !!it.coverUrl;
          const openViewer = () => {
            if (it.kind === 'book') onReadBook(it);
            else if (it.coverUrl) window.open(it.coverUrl, '_blank', 'noopener');
          };
          return (
            <div
              key={`${it.kind}:${it.id}`}
              className="group overflow-hidden rounded-card border border-line bg-white text-left transition-all duration-[450ms] hover:-translate-y-1 hover:border-clay/50"
              title={it.title || ''}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper">
                {it.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.coverUrl}
                    alt={it.title || ''}
                    className="h-full w-full object-cover transition-transform duration-[450ms]"
                  />
                ) : pending ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                    <Spinner className="h-6 w-6 text-clay" />
                    <p className="text-xs text-ink-faint">
                      {it.kind === 'book' ? '绘本创作中…' : '生成中…'}
                    </p>
                  </div>
                ) : failed ? (
                  <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
                    生成失败
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-faint">
                    {it.kind === 'book' ? <BookIcon /> : <ImageIcon />}
                  </div>
                )}
                {/* 类型角标（对齐模板卡） */}
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-ink-soft backdrop-blur">
                  {it.kind === 'book' ? (
                    <BookIcon width={11} height={11} />
                  ) : (
                    <ImageIcon width={11} height={11} />
                  )}
                  {it.kind === 'book' ? '绘本' : '图片'}
                </span>
                {/* 悬停遮罩 —— 与模板卡完全一致的纯文字胶囊按钮 */}
                {(done || failed) && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/45 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                    {done && (
                      <button
                        onClick={openViewer}
                        className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-[450ms]"
                      >
                        查看
                      </button>
                    )}
                    <button
                      onClick={() => onRetry(it)}
                      className="rounded-full bg-clay px-3 py-1.5 text-xs font-medium text-white transition-colors duration-[450ms]"
                    >
                      重新生成
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (done) openViewer();
                  else if (!failed) onOpen(it);
                }}
                className="block w-full px-2.5 py-2 text-left"
              >
                <p className="truncate text-sm font-medium text-ink">
                  {it.title || '未命名'}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelHeader({ tool }: { tool: ReturnType<typeof toolByKey> }) {
  const override = usePanelBack();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 md:px-6">
      {override ? (
        <button
          onClick={override}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-ink-soft transition-colors duration-[450ms] ease-out hover:bg-paper-deep hover:text-ink"
        >
          <ChevronLeftIcon width={16} height={16} />
          <span>返回</span>
        </button>
      ) : (
        <Link
          href="/app/toolbox"
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-ink-soft transition-colors duration-[450ms] ease-out hover:bg-paper-deep hover:text-ink"
        >
          <ChevronLeftIcon width={16} height={16} />
          <span>返回</span>
        </Link>
      )}
      {tool && (
        <>
          <span className="mx-1 text-ink-faint">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <tool.icon width={16} height={16} className="text-clay" />
            {tool.name}
          </span>
        </>
      )}
    </header>
  );
}
