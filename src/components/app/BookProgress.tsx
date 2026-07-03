'use client';

import clsx from 'clsx';
import { Spinner } from '~/components/ui';
import { CloseIcon } from '~/components/ui/icons';
import type { ReaderPage } from '~/components/app/BookReader';

export function BookProgress({
  title,
  pages,
  doneCount,
  total,
  phase,
}: {
  title: string;
  pages: ReaderPage[];
  doneCount: number;
  total: number;
  phase: 'writing' | 'illustrating';
}) {
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-section border border-line bg-white p-6">
      <div className="mb-4 text-center">
        <h2 className="text-lg text-ink">
          {title || '正在创作绘本…'}
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          {phase === 'writing'
            ? '正在编写故事内容…'
            : `正在绘制插画 · 已完成 ${doneCount} / ${total} 页`}
        </p>
      </div>

      {/* 进度条 */}
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-clay transition-all duration-500"
          style={{ width: `${phase === 'writing' ? 8 : Math.max(pct, 8)}%` }}
        />
      </div>

      {/* 逐页缩略 */}
      <div className="grid grid-cols-4 gap-3">
        {(pages.length ? pages : Array.from({ length: total })).map((p, idx) => {
          const page = pages[idx];
          const ok = page?.status === 'SUCCEEDED' && page.imageUrl;
          const failed = page?.status === 'FAILED';
          return (
            <div
              key={idx}
              className={clsx(
                'relative aspect-[4/3] overflow-hidden rounded-lg border',
                ok ? 'border-line' : 'border-dashed border-line'
              )}
            >
              {ok ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page!.imageUrl!}
                  alt={`第 ${idx + 1} 页`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-paper">
                  {failed ? (
                    <CloseIcon width={14} height={14} className="text-ink-faint" />
                  ) : (
                    <Spinner className="h-4 w-4 text-clay" />
                  )}
                </div>
              )}
              <span className="absolute left-1 top-1 rounded bg-white/80 px-1 text-[10px] text-ink-faint">
                {idx + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
