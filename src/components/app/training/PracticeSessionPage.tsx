'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type {
  PracticeEvaluation,
  PracticeMessage,
  PracticeSession,
  TrainingScenario,
} from '~/data/training-types';
import { SendIcon } from '~/components/ui/icons';

export function PracticeSessionPage({ id }: { id: number }) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [scenario, setScenario] = useState<TrainingScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/training/practice/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setSession(d.session);
          setScenario(d.scenario);
        }
      })
      .catch(() => setError('练习加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length, session?.evaluation]);

  const messages = session?.messages || [];
  const userMsgCount = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages]
  );
  const roleLabel = scenario?.role_persona?.who || 'AI';

  async function send() {
    const content = input.trim();
    if (!content || sending || !session) return;
    setSending(true);
    setInput('');
    // 乐观上屏
    setSession((s) =>
      s
        ? {
            ...s,
            messages: [...s.messages, { role: 'user', content, ts: Date.now() }],
          }
        : s
    );
    try {
      const res = await fetch(`/api/training/practice/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
      } else {
        setSession((s) =>
          s
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  { role: 'assistant', content: d.reply, ts: Date.now() },
                ],
              }
            : s
        );
      }
    } catch {
      setError('AI 回复失败，请重试');
    } finally {
      setSending(false);
    }
  }

  async function complete() {
    if (!session || completing) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/training/practice/${id}/complete`, {
        method: 'POST',
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
      } else {
        setSession((s) =>
          s
            ? { ...s, status: 'completed', evaluation: d.evaluation as PracticeEvaluation }
            : s
        );
      }
    } catch {
      setError('复盘生成失败');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <div className="h-40 animate-breathe rounded-card bg-paper-deep" />
      </div>
    );
  }
  if (error || !session || !scenario) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
          {error || '记录不存在'}
        </p>
        <Link
          href="/app/training/practice"
          className="mt-4 inline-block text-sm text-clay-deep hover:underline"
        >
          ← 返回情景练习
        </Link>
      </div>
    );
  }

  const done = session.status === 'completed';

  return (
    <div className="flex h-full flex-col">
      {/* 顶部 */}
      <div className="border-b border-line bg-card px-6 py-4">
        <div className="mx-auto max-w-[820px]">
          <div className="mb-1 text-[12px] text-ink-faint">
            <Link href="/app/training/practice" className="hover:text-clay-deep">
              ← 情景练习
            </Link>
          </div>
          <h1 className="text-[17px] font-medium text-ink">{scenario.title}</h1>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            AI 扮演：{roleLabel}
            {scenario.role_persona?.tone && ` · ${scenario.role_persona.tone}`}
          </p>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[820px] space-y-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} m={m} roleLabel={roleLabel} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-[13px] text-ink-faint">
              <span className="h-2 w-2 animate-pulse rounded-full bg-clay-deep" />
              {roleLabel} 正在回复…
            </div>
          )}

          {/* 结束后的复盘卡 */}
          {done && session.evaluation && <EvaluationCard evaluation={session.evaluation} />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 输入区 */}
      {!done ? (
        <div className="border-t border-line bg-card px-6 py-4">
          <div className="mx-auto max-w-[820px]">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`回复${roleLabel}…（⌘ / Ctrl + Enter 发送）`}
                rows={2}
                className="min-h-[60px] flex-1 resize-none rounded-card border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-deep text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
                aria-label="发送"
              >
                <SendIcon width={18} height={18} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-ink-faint">
              <span>已完成 {userMsgCount} 轮对话</span>
              <button
                onClick={complete}
                disabled={completing || userMsgCount < 2}
                className="text-clay-deep hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {completing ? '生成复盘中…' : '结束练习并出复盘'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-line bg-card px-6 py-4">
          <div className="mx-auto max-w-[820px] flex flex-wrap gap-3">
            <Link
              href="/app/training/practice"
              className="rounded-card border border-line bg-card px-5 py-2.5 text-[14px] text-ink hover:bg-paper-deep"
            >
              ← 返回情景练习
            </Link>
            <Link
              href="/app/training/profile"
              className="rounded-card bg-clay-deep px-5 py-2.5 text-[14px] font-medium text-paper hover:bg-sage-deep"
            >
              查看能力画像 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ m, roleLabel }: { m: PracticeMessage; roleLabel: string }) {
  const isUser = m.role === 'user';
  return (
    <div className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <span
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-medium',
          isUser ? 'bg-clay-deep text-paper' : 'bg-sage-mist text-sage-deep'
        )}
      >
        {isUser ? '你' : roleLabel.slice(0, 1)}
      </span>
      <div
        className={clsx(
          'max-w-[75%] rounded-card px-4 py-3 text-[14px] leading-[1.9] whitespace-pre-wrap',
          isUser ? 'bg-clay-deep text-paper' : 'bg-card text-ink border border-line'
        )}
      >
        {m.content}
      </div>
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: PracticeEvaluation }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-card p-6">
      <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
        练习复盘
      </p>
      <div className="mb-6 flex items-end gap-3">
        <span className="font-serif text-[42px] font-medium leading-none text-clay-deep">
          {evaluation.overall}
        </span>
        <span className="pb-2 text-[14px] text-ink-soft">/ 100 综合分</span>
      </div>

      {/* 维度分 */}
      <div className="mb-6 space-y-3">
        {Object.entries(evaluation.dimensions || {}).map(([key, v]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="text-ink">{v.note ? key : key}</span>
              <span className="text-ink-soft">{v.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full bg-clay-deep"
                style={{ width: `${Math.max(0, Math.min(100, v.score))}%` }}
              />
            </div>
            {v.note && (
              <p className="mt-1 text-[12px] text-ink-faint">{v.note}</p>
            )}
          </div>
        ))}
      </div>

      {evaluation.highlights?.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[12px] font-medium text-sage-deep">做得好的地方</p>
          <ul className="space-y-1.5">
            {evaluation.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-[1.8] text-ink-soft">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sage-deep" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.improvements?.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-medium text-clay">可以更好的地方</p>
          <ul className="space-y-1.5">
            {evaluation.improvements.map((h, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-[1.8] text-ink-soft">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-clay" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
