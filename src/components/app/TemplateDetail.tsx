'use client';

import { useEffect, useState } from 'react';
import { Button, Spinner } from '~/components/ui';
import { CloseIcon, DownloadIcon } from '~/components/ui/icons';
import { BookReader, type ReaderPage } from '~/components/app/BookReader';
import { exportBookPdf } from '~/libs/book-pdf';
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((d) => (d.template ? setData(d) : setData(null)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPdf(title: string, pages: ReaderPage[]) {
    setPdfBusy(true);
    try {
      await exportBookPdf(title, pages);
    } catch {
      alert('PDF 生成失败，请重试');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleDownloadImage(title: string, url: string) {
    setImgBusy(true);
    try {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const ext =
        (blob.type && blob.type.split('/')[1]?.split('+')[0]) ||
        url.split('.').pop()?.split('?')[0] ||
        'png';
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${title || 'image'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      alert('图片下载失败，请重试');
    } finally {
      setImgBusy(false);
    }
  }

  // 绘本且有多页 → 用翻页阅读器
  if (data && data.template.kind === 'book' && data.pages.length > 0) {
    return (
      <BookReader
        title={data.template.title}
        pages={data.pages}
        onClose={onClose}
        footer={
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleDownloadPdf(data.template.title, data.pages)}
              loading={pdfBusy}
              className="px-5 py-2"
            >
              {!pdfBusy && <DownloadIcon width={14} height={14} />}
              下载
            </Button>
            <Button className="px-6 py-2" onClick={() => onUse(data.template)}>
              做同款
            </Button>
          </div>
        }
      />
    );
  }

  // 图片 / 加载中 / 无页 → 详情卡
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-section bg-paper p-5">
        {/* 顶部条：标题 + 关闭，下载按钮移到底部与主 CTA 并排 */}
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate pr-4 text-sm font-medium text-ink-soft">
            {data?.template.title ?? ''}
          </p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-clay-mist hover:text-ink"
            aria-label="关闭"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-7 w-7 text-clay" />
          </div>
        ) : !data ? (
          <p className="py-16 text-center text-sm text-ink-faint">加载失败</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-card border border-line bg-white">
              {data.template.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.template.coverUrl}
                  alt={data.template.title}
                  className="w-full"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-ink-faint">
                  暂无预览
                </div>
              )}
            </div>

            <div className="mt-4">
              {data.template.subtitle && (
                <p className="text-sm text-ink-faint">
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
                <p className="mt-3 rounded-card bg-white/70 px-3 py-2 text-sm leading-relaxed text-ink-soft">
                  {data.template.brief}
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {data.template.coverUrl && (
                <Button
                  variant="outline"
                  onClick={() =>
                    handleDownloadImage(data.template.title, data.template.coverUrl!)
                  }
                  loading={imgBusy}
                  className="px-5"
                >
                  {!imgBusy && <DownloadIcon width={14} height={14} />}
                  下载
                </Button>
              )}
              <Button onClick={() => onUse(data.template)} className="px-5">
                做同款
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
    <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-soft">
      {children}
    </span>
  );
}
