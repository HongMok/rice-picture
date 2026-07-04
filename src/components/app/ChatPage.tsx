'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { CHAT_MODELS, type ChatModelKey } from '~/libs/chat';
import { AttachIcon, CloseIcon, GlobeIcon, SendIcon } from '~/components/ui/icons';
import { BrandmarkGlyph } from '~/components/login/Brandmark';

const MAX_LEN = 2000;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  failed?: boolean;
}

interface Attachment {
  id: string;
  file: File;
}

const SUGGESTIONS = [
  '帮我给一个 5 岁自闭症谱系孩子设计"物品命名"的教学步骤',
  '孩子上课坐不住 15 分钟就走神，我该怎么调整环境？',
  '想给家长解释什么是"回合式教学（DTT）"，用简单点的话',
  '把这段行为观察记录改成结构化的 ABC 分析',
];

let nextId = 0;
function genId() {
  nextId += 1;
  return `m${nextId}`;
}

export function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();
  const urlSessionId = params.get('id');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ChatModelKey>('qwen-plus');
  const [webSearch, setWebSearch] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 从 URL 读会话 id，加载历史消息回填
  useEffect(() => {
    const idNum = urlSessionId ? Number(urlSessionId) : NaN;
    if (!Number.isFinite(idNum)) {
      setSessionId(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`/api/chat-sessions/${idNum}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.session?.messages) {
          setSessionId(data.session.id);
          setMessages(
            (data.session.messages as { role: 'user' | 'assistant'; content: string }[])
              .map((m) => ({ id: genId(), role: m.role, content: m.content }))
          );
        } else {
          setError(data.error || '加载对话失败');
        }
      })
      .catch(() => setError('加载对话失败'))
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [urlSessionId]);

  // 消息更新后滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const trimmed = input.trim();
  const canSend = trimmed.length > 0 && !sending;

  function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachError('');
    const incoming = Array.from(files);
    const next: Attachment[] = [...attachments];
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        setAttachError('最多可添加 5 个附件。');
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        setAttachError(`「${file.name}」超过 20MB，没有添加。`);
        continue;
      }
      next.push({ id: genId(), file });
    }
    setAttachments(next);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function sendText(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: ChatMessage = { id: genId(), role: 'user', content: text };
    const pendingMsg: ChatMessage = { id: genId(), role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput('');
    setError('');
    setSending(true);

    // 首轮：立刻在侧栏塞一条乐观条目，让"过去 30 天"即刻可见
    // 后端会在几十毫秒内创建真 session；API 返回后广播 refresh，用真数据 hydrate 替换
    const isFirstTurn = !sessionId;
    if (isFirstTurn && typeof window !== 'undefined') {
      const previewTitle = text.trim().replace(/\s+/g, ' ').slice(0, 20);
      const nowIso = new Date().toISOString();
      window.dispatchEvent(
        new CustomEvent('xiaohe:history-add', {
          detail: {
            id: -Date.now(), // 负 id 占位，避免和真 id 冲突
            type: 'chat',
            title: previewTitle + (text.trim().length > 20 ? '…' : ''),
            updated_at: nowIso,
            created_at: nowIso,
          },
        })
      );
    }

    try {
      const history = [...messages, userMsg]
        .filter((m) => !m.pending && !m.failed)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      let res: Response;
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history, model, sessionId }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id ? { ...m, content: data.reply, pending: false } : m
        )
      );

      // 拿到 sessionId 后写入 URL（首次），后续保持
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        router.replace(`/app/chat?id=${data.sessionId}`, { scroll: false });
      }

      // 通知侧栏刷新历史列表（拉真数据、替换掉乐观占位条目）
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('xiaohe:history-refresh'));
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
      setInput(text);
      setError(err?.name === 'AbortError' ? '请求超时，请重试' : err?.message || '请求失败，请重试');
      // 失败时也刷一下：如果后端已回滚软删，占位条目会被真数据替换（不含它）；
      // 若后端已创建真 session，那就正常显示。
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('xiaohe:history-refresh'));
      }
    } finally {
      setSending(false);
    }
  }

  function send() {
    if (canSend) sendText(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const empty = messages.length === 0 && !loadingHistory;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
        <div className="mx-auto max-w-[720px]">
          {loadingHistory ? (
            <div className="flex justify-center py-24 text-sm text-ink-faint">加载对话中…</div>
          ) : empty ? (
            <EmptyState onPickSuggestion={(s) => sendText(s)} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={clsx(
                      'max-w-[80%] whitespace-pre-wrap rounded-card px-4 py-3 text-[15px] leading-[2]',
                      m.role === 'user' ? 'bg-sage-mist text-sage-deep' : 'bg-card text-ink'
                    )}
                  >
                    {m.pending ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-faint">
                        <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ink-faint" />
                        生成中
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-center justify-between rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
              <span>{error}</span>
              <button onClick={send} className="ml-3 shrink-0 text-clay underline">
                重试
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部固定输入区 */}
      <div className="border-t border-line bg-card px-6 py-4 md:px-10">
        <div className="mx-auto max-w-[720px]">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-full bg-paper-deep px-3 py-1 text-xs text-ink-soft"
                >
                  {a.file.name}
                  <button onClick={() => removeAttachment(a.id)} aria-label="移除附件">
                    <CloseIcon width={12} height={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {attachError && <p className="mb-2 text-xs text-clay">{attachError}</p>}

          <div className="rounded-section border border-line bg-paper px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={handleKeyDown}
              maxLength={MAX_LEN}
              rows={2}
              placeholder="输入消息，慢慢说也可以…"
              className="w-full resize-none bg-transparent text-[15px] leading-[1.8] text-ink outline-none placeholder:text-ink-faint"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ChatModelKey)}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-ink-soft outline-none"
                >
                  {CHAT_MODELS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setWebSearch((v) => !v)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors duration-[450ms] ease-out',
                    webSearch ? 'bg-water-mist text-water' : 'text-ink-faint hover:bg-paper-deep'
                  )}
                >
                  <GlobeIcon width={14} height={14} />
                  联网
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-faint transition-colors duration-[450ms] ease-out hover:bg-paper-deep"
                >
                  <AttachIcon width={14} height={14} />
                  附件
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />

                <span className="text-xs text-ink-faint">
                  {input.length}/{MAX_LEN}
                </span>
              </div>

              <button
                onClick={send}
                disabled={!canSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sage text-paper transition-colors duration-[450ms] ease-out hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="发送"
              >
                <SendIcon width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPickSuggestion }: { onPickSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      {/* 小禾 印章 Logo */}
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[14px] border border-clay-deep/25 bg-sage-mist">
        <BrandmarkGlyph size={40} onDark={false} />
      </span>
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[0.02em]">
        <span className="text-clay-deep">小禾</span>
        <span className="ml-1.5 text-[16px] font-medium tracking-[0.24em] text-ink">AI</span>
      </h1>
      <p className="mt-2.5 text-[15px] text-ink-soft">
        面向特需儿童康复师 · 特教老师的日常助手
      </p>
      <p className="mt-1 text-[13px] text-ink-faint">
        备教案、写观察记录、给家长解释术语，都可以聊
      </p>

      <div className="mt-9 grid w-full max-w-[520px] grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPickSuggestion(s)}
            className="rounded-card border border-line bg-card px-4 py-3 text-left text-[13.5px] leading-[1.7] text-ink-soft transition-colors duration-[250ms] ease-out hover:border-clay-deep/40 hover:bg-sage-mist hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
