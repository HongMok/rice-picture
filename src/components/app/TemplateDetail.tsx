'use client';

import { useEffect, useState } from 'react';
import { Button, Spinner } from '~/components/ui';
import { CloseIcon } from '~/components/ui/icons';
import { BookReader, type ReaderPage } from '~/components/app/BookReader';
import { topicName, styleName } from '~/data/taxonomy';
import type { TemplateItem } from '~/components/app/TemplateGallery';

interface DetailData {
  template: TemplateItem;
  pages: ReaderPage[];
}

export function TemplateDetail({
  id,
  onClose,
  onUse,
}: {
  id: number;
  onClose: () => void;
  onUse: (t: TemplateItem) => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((d) => (d.template ? setData(d) : setData(null)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // 绘本且有多页 → 用翻页阅读器
  if (data && data.template.kind === 'book' && data.pages.length > 0) {
    return (
      <BookReader
        title={data.template.title}
        pages={data.pages}
        onClose={onClose}
        footer={
          <div className="mt-3 flex justify-center">
            <Button className="px-6 py-2" onClick={() => onUse(data.template)}>
              用此模板生成
            </Button>
          </div>
        }
      />
    );
  }

  // 图片 / 加载中 / 无页 → 详情卡
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-cream p-5 shadow-soft">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-clay-soft hover:text-ink"
          aria-label="关闭"
        >
          <CloseIcon width={18} height={18} />
        </button>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-7 w-7 text-clay" />
          </div>
        ) : !data ? (
          <p className="py-16 text-center text-sm text-ink-muted">加载失败</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-cream-line bg-white">
              {data.template.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.template.coverUrl}
                  alt={data.template.title}
                  className="w-full"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-ink-muted">
                  暂无预览
                </div>
              )}
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-ink">
                {data.template.title}
              </h3>
              {data.template.subtitle && (
                <p className="mt-0.5 text-sm text-ink-muted">
                  {data.template.subtitle}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag>{data.template.kind === 'book' ? '绘本' : '图片'}</Tag>
                <Tag>{topicName(data.template.topic)}</Tag>
                <Tag>{styleName(data.template.styleKey)}</Tag>
                {data.template.options?.pageCount && (
                  <Tag>{data.template.options.pageCount} 页</Tag>
                )}
              </div>
              {data.template.brief && (
                <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm leading-relaxed text-ink-soft">
                  {data.template.brief}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="px-5">
                关闭
              </Button>
              <Button onClick={() => onUse(data.template)} className="px-5">
                用此模板生成
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream-line bg-white px-2.5 py-1 text-xs text-ink-soft">
      {children}
    </span>
  );
}
