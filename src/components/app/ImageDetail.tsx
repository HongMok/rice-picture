'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '~/components/ui';
import { ChevronLeftIcon, DownloadIcon, ImageIcon } from '~/components/ui/icons';

interface Props {
  id: number;
  title: string;
  imageUrl: string | null;
  status: string;
  templateId: string | null;
  createdAt: string;
}

export function ImageDetail({
  id,
  title: initialTitle,
  imageUrl,
  status,
  templateId,
  createdAt,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.select());
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '保存失败');
        setDraft(title);
      } else {
        setTitle(next);
      }
    } catch {
      alert('网络错误');
      setDraft(title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function download() {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${title || '图卡'}.png`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const createdFmt = new Date(createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-6 py-8 md:px-10">
      {/* 顶栏：返回 + 标题（可编辑） */}
      <header className="mb-8 flex items-center gap-3">
        <Link
          href="/app/library"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="返回资源管理"
          title="返回资源管理"
        >
          <ChevronLeftIcon width={18} height={18} />
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-sage-mist px-2 py-0.5 text-[11px] text-sage-deep">
          <ImageIcon width={12} height={12} />
          图卡
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                else if (e.key === 'Escape') {
                  setDraft(title);
                  setEditing(false);
                }
              }}
              onBlur={commit}
              className="w-full max-w-[520px] rounded-card border border-clay/40 bg-white px-3 py-1.5 text-[18px] text-ink outline-none focus:border-clay"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="max-w-full truncate text-left font-serif text-[22px] leading-tight text-ink hover:text-clay"
              title="点击重命名"
            >
              {title}
            </button>
          )}
        </div>
      </header>

      {/* 大图区 */}
      <div className="rounded-section border border-line bg-card p-4 md:p-6">
        {imageUrl && !imgBroken ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="max-h-[70vh] w-auto max-w-full rounded-card object-contain"
              onError={() => setImgBroken(true)}
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card bg-paper-deep">
            <div className="text-center">
              <ImageIcon width={48} height={48} className="mx-auto text-ink-faint" />
              <p className="mt-3 text-sm text-ink-faint">
                {status === 'SUCCEEDED'
                  ? '图片链接已过期，可以回到工具箱重新生成'
                  : status === 'FAILED'
                  ? '这张图卡生成失败了'
                  : '生成中，请稍后回来查看'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 元信息 + 下载 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-faint">
          {templateId && (
            <span>
              模板：<span className="text-ink-soft">{templateId}</span>
            </span>
          )}
          <span>
            创建时间：<span className="text-ink-soft">{createdFmt}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!imageUrl || imgBroken}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner className="h-3.5 w-3.5" /> : <DownloadIcon width={14} height={14} />}
          下载图片
        </button>
      </div>
      </div>
    </div>
  );
}
