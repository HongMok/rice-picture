'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { GoalChecklistItem } from '~/data/lesson-plan-types';

type PollState = 'idle' | 'creating' | 'polling' | 'error';

const POLL_INTERVAL = 2000;
const MAX_POLLS = 40; // 40 × 2s = 80s

export function GoalImage({
  item,
  planId,
  onImageChanged,
}: {
  item: GoalChecklistItem;
  planId: number;
  /** url === null 表示清空；taskId === null 表示清任务 */
  onImageChanged: (url: string | undefined | null, taskId: string | undefined | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, setState] = useState<PollState>(item.imageTaskId ? 'polling' : 'idle');
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);

  // 首次挂载：若 item 上有 imageTaskId 则继续轮询（跨会话恢复）
  useEffect(() => {
    if (item.imageTaskId && state === 'polling') {
      pollCount.current = 0;
      pollOnce(item.imageTaskId);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 关闭菜单：点击外部
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  async function pollOnce(taskId: string) {
    try {
      const res = await fetch(
        `/api/lesson-plans/${planId}/goal-item-image/tasks/${taskId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '查询失败');
      if (data.status === 'SUCCEEDED' && data.imageUrl) {
        setState('idle');
        onImageChanged(data.imageUrl, null);
        return;
      }
      if (data.status === 'FAILED') {
        setState('error');
        setError(data.message || '生成失败');
        onImageChanged(undefined, null);
        setTimeout(() => setError(''), 3000);
        return;
      }
      // PENDING / RUNNING / UNKNOWN → 继续
      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        setState('error');
        setError('生成超时，请重试');
        onImageChanged(undefined, null);
        setTimeout(() => setError(''), 3000);
        return;
      }
      pollRef.current = setTimeout(() => pollOnce(taskId), POLL_INTERVAL);
    } catch (err: any) {
      setState('error');
      setError(err?.message || '网络错误');
      setTimeout(() => setError(''), 3000);
    }
  }

  async function startGenerate() {
    setMenuOpen(false);
    setError('');
    if (!item.name.trim()) {
      setError('请先填写目标名称');
      setTimeout(() => setError(''), 2500);
      return;
    }
    setState('creating');
    try {
      const res = await fetch(`/api/lesson-plans/${planId}/goal-item-image/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.taskId) throw new Error(data.error || '创建任务失败');
      onImageChanged(undefined, data.taskId); // 落地 taskId 用于跨会话恢复
      setState('polling');
      pollCount.current = 0;
      pollRef.current = setTimeout(() => pollOnce(data.taskId), POLL_INTERVAL);
    } catch (err: any) {
      setState('error');
      setError(err?.message || '生成失败');
      setTimeout(() => setError(''), 3000);
    }
  }

  function removeImage() {
    setMenuOpen(false);
    onImageChanged(null, null);
  }

  const loading = state === 'creating' || state === 'polling';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !loading && setMenuOpen((v) => !v)}
        disabled={loading}
        className={clsx(
          'group relative grid h-14 w-14 place-items-center overflow-hidden rounded-input border transition-colors',
          item.imageUrl
            ? 'border-line bg-card hover:border-sage'
            : 'border-dashed border-line bg-paper-deep hover:border-sage hover:bg-paper',
          loading && 'cursor-wait'
        )}
        aria-label={item.imageUrl ? '更换图片' : '添加图片'}
      >
        {loading ? (
          <>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-paper-deep via-line to-paper-deep" />
            <div className="relative h-4 w-4 animate-spin rounded-full border-2 border-sage border-t-transparent" />
          </>
        ) : item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name || '目标图片'}
            onError={(e) => {
              // dashscope 24h 过期 → 隐藏破图，显示占位
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
          />
        ) : (
          <span className="text-[18px] leading-none text-ink-faint">＋</span>
        )}
      </button>
      {loading && (
        <span className="pointer-events-none absolute -bottom-4 left-0 whitespace-nowrap text-[10.5px] text-ink-faint">
          生成中… 30 秒
        </span>
      )}
      {error && (
        <div className="absolute left-16 top-1 z-20 whitespace-nowrap rounded-input bg-[#C0524B] px-2 py-1 text-[11px] text-white shadow">
          {error}
        </div>
      )}
      {menuOpen && !loading && (
        <div className="absolute left-16 top-0 z-20 min-w-[152px] rounded-input border border-line bg-card py-1.5 text-[13px] shadow-lg">
          <button
            onClick={startGenerate}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink transition-colors hover:bg-paper-deep"
          >
            <span className="text-sage-deep">✦</span>
            <span>{item.imageUrl ? 'AI 重新生成' : 'AI 生成图片'}</span>
          </button>
          {item.imageUrl && (
            <>
              <div className="my-1 h-px bg-line" />
              <button
                onClick={removeImage}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger transition-colors hover:bg-paper-deep"
              >
                <span>🗑</span>
                <span>移除图片</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
