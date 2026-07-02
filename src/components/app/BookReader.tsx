'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '~/components/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
} from '~/components/ui/icons';

export interface ReaderPage {
  pageIndex: number;
  text: string | null;
  status: string;
  imageUrl: string | null;
}

export function BookReader({
  title,
  pages,
  onClose,
  onDownloadPdf,
  pdfBusy,
}: {
  title: string;
  pages: ReaderPage[];
  onClose: () => void;
  onDownloadPdf?: () => void;
  pdfBusy?: boolean;
}) {
  const [i, setI] = useState(0);
  const total = pages.length;
  const page = pages[i];

  const prev = () => setI((v) => Math.max(0, v - 1));
  const next = () => setI((v) => Math.min(total - 1, v + 1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-4xl flex-col rounded-2xl bg-cream p-4 shadow-soft sm:p-6">
        {/* 关闭 + 标题 */}
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate pr-4 text-sm font-medium text-ink-soft">
            {title}
          </p>
          <div className="flex items-center gap-1">
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                disabled={pdfBusy}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-clay-soft hover:text-ink disabled:opacity-50"
                title="下载 PDF"
              >
                {pdfBusy ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <DownloadIcon width={14} height={14} />
                )}
                PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-clay-soft hover:text-ink"
              aria-label="关闭"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        </div>

        {/* 页面 */}
        <div className="relative flex items-center justify-center">
          {/* 左箭头 */}
          {i > 0 && (
            <button
              onClick={prev}
              className="absolute left-0 z-10 -ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform hover:scale-105 sm:-ml-5"
              aria-label="上一页"
            >
              <ChevronLeftIcon />
            </button>
          )}

          <div className="relative w-full overflow-hidden rounded-xl border border-cream-line bg-white">
            <div className="relative aspect-[4/3] w-full">
              {page?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.imageUrl}
                  alt={`第 ${i + 1} 页`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-cream">
                  {page?.status === 'FAILED' ? (
                    <span className="text-sm text-ink-muted">这一页生成失败了</span>
                  ) : (
                    <div className="text-center">
                      <Spinner className="mx-auto h-7 w-7 text-clay" />
                      <p className="mt-2 text-sm text-ink-muted">这一页还在画…</p>
                    </div>
                  )}
                </div>
              )}

              {/* 底部叠故事文字 */}
              {page?.text && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/40 to-transparent px-5 pb-5 pt-10">
                  <p className="text-center text-base font-medium leading-relaxed text-white sm:text-lg">
                    {page.text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右箭头 */}
          {i < total - 1 && (
            <button
              onClick={next}
              className="absolute right-0 z-10 -mr-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform hover:scale-105 sm:-mr-5"
              aria-label="下一页"
            >
              <ChevronRightIcon />
            </button>
          )}
        </div>

        {/* 页码 */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {pages.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={
                'h-1.5 rounded-full transition-all ' +
                (idx === i ? 'w-6 bg-clay' : 'w-1.5 bg-cream-line hover:bg-clay/40')
              }
              aria-label={`第 ${idx + 1} 页`}
            />
          ))}
        </div>
        <p className="mt-1 text-center text-xs text-ink-muted">
          第 {i + 1} / {total} 页 · 用左右方向键翻页
        </p>
      </div>
    </div>
  );
}
