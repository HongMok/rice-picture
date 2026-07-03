'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookReader, type ReaderPage } from '~/components/app/BookReader';
import { exportBookPdf } from '~/libs/book-pdf';

interface Props {
  id: number;
  initialTitle: string;
  status: string;
  pages: ReaderPage[];
}

export function BookDetail({ id, initialTitle, status, pages }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);

  async function downloadPdf() {
    const done = pages.filter((p) => p.status === 'SUCCEEDED');
    if (done.length === 0) {
      alert('这本绘本还没有已生成的页面');
      return;
    }
    setPdfBusy(true);
    try {
      await exportBookPdf(title, done);
    } catch {
      alert('PDF 生成失败，请重试');
    } finally {
      setPdfBusy(false);
    }
  }

  // 允许通过 prompt 快速重命名（省一个专属 UI）
  async function renamePrompt() {
    const next = window.prompt('重命名绘本', title)?.trim();
    if (!next || next === title || renaming) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '保存失败');
        return;
      }
      setTitle(next);
    } catch {
      alert('网络错误');
    } finally {
      setRenaming(false);
    }
  }

  const canRead = pages.length > 0 && status !== 'FAILED';

  if (!canRead) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm leading-[1.9] text-ink-soft">
          {status === 'FAILED' ? '这本绘本生成失败了。' : '这本绘本还没有已生成的页面。'}
        </p>
        <button
          onClick={() => router.push('/app/library')}
          className="mt-4 text-sm text-sage-deep hover:underline"
        >
          返回资源管理 →
        </button>
      </div>
    );
  }

  return (
    <BookReader
      title={title}
      pages={pages}
      onClose={() => router.push('/app/library')}
      onDownloadPdf={downloadPdf}
      pdfBusy={pdfBusy}
      footer={
        <button
          type="button"
          onClick={renamePrompt}
          disabled={renaming}
          className="text-[12px] text-ink-faint hover:text-ink disabled:opacity-50"
        >
          重命名绘本
        </button>
      }
    />
  );
}
