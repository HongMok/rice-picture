'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sidebar,
  useSidebarCollapsed,
  type LibItem,
} from '~/components/app/Sidebar';
import { Composer, type ComposerState, type Mode } from '~/components/app/Composer';
import { TemplateGallery, type TemplateItem } from '~/components/app/TemplateGallery';
import { BookProgress } from '~/components/app/BookProgress';
import { BookReader, type ReaderPage } from '~/components/app/BookReader';
import { Button, Spinner } from '~/components/ui';
import { DownloadIcon, BookIcon, MenuIcon, SparkleIcon } from '~/components/ui/icons';
import { DEFAULT_RATIO, DEFAULT_PAGE_COUNT } from '~/data/taxonomy';
import { exportBookPdf } from '~/libs/book-pdf';

type Stage =
  | { kind: 'compose' }
  | { kind: 'image-loading'; label: string }
  | { kind: 'image-done'; url: string; title: string }
  | { kind: 'book-generating'; bookId: number; title: string }
  | { kind: 'book-done'; bookId: number; title: string };

export function Workbench({ initialItems }: { initialItems: LibItem[] }) {
  const [items, setItems] = useState<LibItem[]>(initialItems);
  const [composer, setComposer] = useState<ComposerState>({
    mode: 'image',
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();

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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = (p: Partial<ComposerState>) => setComposer((s) => ({ ...s, ...p }));
  const clearTimer = () => timer.current && clearTimeout(timer.current);
  useEffect(() => clearTimer, []);

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

  /* ---------- 图片模式轮询 ---------- */
  const pollImage = useCallback(
    (taskId: string, title: string, attempt = 0) => {
      timer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/generate/${taskId}`);
          const data = await res.json();
          if (data.status === 'SUCCEEDED' && data.imageUrl) {
            setStage({ kind: 'image-done', url: data.imageUrl, title });
            setGenerating(false);
            refreshItems();
            return;
          }
          if (data.status === 'FAILED' || attempt > 40) {
            setStage({ kind: 'compose' });
            setGenerating(false);
            refreshItems();
            if (data.status === 'FAILED') alert('生成失败，请调整描述后重试');
            return;
          }
          setStage({
            kind: 'image-loading',
            label: data.status === 'RUNNING' ? '正在绘制…' : '任务排队中…',
          });
          pollImage(taskId, title, attempt + 1);
        } catch {
          pollImage(taskId, title, attempt + 1);
        }
      }, 3000);
    },
    [refreshItems]
  );

  /* ---------- 绘本模式轮询 ---------- */
  const pollBook = useCallback(
    (bookId: number, title: string, attempt = 0) => {
      timer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/book/${bookId}`);
          const data = await res.json();
          if (!res.ok) throw new Error();
          setPages(data.pages);
          setDoneCount(data.doneCount);
          setPageTotal(data.book.pageCount);
          if (data.book.status === 'DONE') {
            setStage({ kind: 'book-done', bookId, title: data.book.title });
            setGenerating(false);
            refreshItems();
            return;
          }
          if (data.book.status === 'FAILED' || attempt > 80) {
            setStage({ kind: 'compose' });
            setGenerating(false);
            refreshItems();
            if (data.book.status === 'FAILED') alert('绘本生成失败，请重试');
            return;
          }
          setStage({ kind: 'book-generating', bookId, title: data.book.title || title });
          pollBook(bookId, title, attempt + 1);
        } catch {
          pollBook(bookId, title, attempt + 1);
        }
      }, 3000);
    },
    [refreshItems]
  );

  /* ---------- 生成 ---------- */
  async function handleGenerate() {
    clearTimer();
    setGenerating(true);
    setActiveId(null);
    if (composer.mode === 'image') {
      setStage({ kind: 'image-loading', label: '正在提交…' });
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief: composer.brief.trim(),
            styleKey: composer.styleKey,
            ratio: composer.ratio,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStage({ kind: 'compose' });
          setGenerating(false);
          alert(data.error || '生成失败');
          return;
        }
        refreshItems();
        pollImage(data.taskId, composer.brief.trim().slice(0, 30));
      } catch {
        setStage({ kind: 'compose' });
        setGenerating(false);
        alert('网络错误');
      }
    } else {
      setPages([]);
      setDoneCount(0);
      setPageTotal(composer.pageCount);
      setStage({ kind: 'book-generating', bookId: 0, title: '' });
      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief: composer.brief.trim(),
            options: { styleKey: composer.styleKey },
            pageCount: composer.pageCount,
            ratio: composer.ratio,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStage({ kind: 'compose' });
          setGenerating(false);
          alert(data.error || '生成失败');
          return;
        }
        refreshItems();
        pollBook(data.bookId, data.title);
      } catch {
        setStage({ kind: 'compose' });
        setGenerating(false);
        alert('网络错误');
      }
    }
  }

  /* ---------- 模板填充 ---------- */
  function pickTemplate(t: TemplateItem) {
    clearTimer();
    setStage({ kind: 'compose' });
    setGenerating(false);
    patch({
      mode: t.kind,
      brief: t.brief,
      styleKey: t.styleKey,
      pageCount: t.options?.pageCount || DEFAULT_PAGE_COUNT,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 打开已有作品 ---------- */
  async function openItem(it: LibItem) {
    clearTimer();
    setActiveId(`${it.kind}:${it.id}`);
    if (it.kind === 'image') {
      if (it.coverUrl) {
        setStage({ kind: 'image-done', url: it.coverUrl, title: it.title || '图片' });
      } else {
        setStage({ kind: 'compose' });
      }
      return;
    }
    // book
    const res = await fetch(`/api/book/${it.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setPages(data.pages);
    setDoneCount(data.doneCount);
    setPageTotal(data.book.pageCount);
    setReaderTitle(data.book.title || '绘本');
    if (data.book.status === 'DONE') {
      setStage({ kind: 'book-done', bookId: it.id, title: data.book.title });
      setReaderOpen(true);
    } else if (data.book.status === 'FAILED') {
      setStage({ kind: 'compose' });
      alert('这本绘本生成失败了');
    } else {
      setGenerating(true);
      setStage({ kind: 'book-generating', bookId: it.id, title: data.book.title });
      pollBook(it.id, data.book.title || '');
    }
  }

  function newCreation() {
    clearTimer();
    setGenerating(false);
    setActiveId(null);
    setStage({ kind: 'compose' });
    patch({ brief: '' });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar
        items={items}
        activeId={activeId}
        onNew={newCreation}
        onOpen={openItem}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggle}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏 */}
        <header className="flex h-14 items-center gap-3 border-b border-cream-line px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-cream"
            aria-label="菜单"
          >
            <MenuIcon />
          </button>
          <span className="text-sm font-bold">
            米<span className="text-clay">图</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {/* 生成区 */}
          <Composer
            state={composer}
            setState={patch}
            generating={generating}
            onGenerate={handleGenerate}
          />

          {/* 结果 / 进度 */}
          <div className="mx-auto mt-6 w-full max-w-3xl">
            {stage.kind === 'image-loading' && (
              <div className="flex flex-col items-center rounded-2xl border border-cream-line bg-white p-10 shadow-soft">
                <Spinner className="h-8 w-8 text-clay" />
                <p className="mt-3 text-sm text-ink-soft">{stage.label}</p>
                <p className="mt-1 text-xs text-ink-muted">通常需要 10～30 秒</p>
              </div>
            )}

            {stage.kind === 'image-done' && (
              <div className="rounded-2xl border border-cream-line bg-white p-4 shadow-soft">
                <div className="overflow-hidden rounded-xl border border-cream-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stage.url} alt={stage.title} className="w-full" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {stage.title}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      loading={generating}
                      onClick={handleGenerate}
                    >
                      <SparkleIcon width={16} height={16} />
                      重新生成
                    </Button>
                    <a href={stage.url} target="_blank" rel="noreferrer" download>
                      <Button variant="outline" className="gap-1.5">
                        <DownloadIcon width={16} height={16} />
                        下载
                      </Button>
                    </a>
                  </div>
                </div>
                <p className="mt-2 text-center text-[11px] text-ink-muted">
                  图片链接有效期约 24 小时，请及时下载保存
                </p>
              </div>
            )}

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
                    <Button
                      variant="outline"
                      className="gap-1.5 px-6 py-2.5"
                      onClick={newCreation}
                    >
                      <SparkleIcon width={16} height={16} />
                      再做一个
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
  );
}
