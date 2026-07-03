'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { CHAT_MODELS, type ChatModelKey } from '~/libs/chat';
import { AttachIcon, ChatIcon, CloseIcon, GlobeIcon, SendIcon } from '~/components/ui/icons';

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

let nextId = 0;
function genId() {
  nextId += 1;
  return `m${nextId}`;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ChatModelKey>('qwen-plus');
  const [webSearch, setWebSearch] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function send() {
    if (!canSend) return;
    const text = trimmed;
    const userMsg: ChatMessage = { id: genId(), role: 'user', content: text };
    const pendingMsg: ChatMessage = { id: genId(), role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput('');
    setError('');
    setSending(true);

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
          body: JSON.stringify({ messages: history, model }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');

      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { ...m, content: data.reply, pending: false } : m))
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
      setInput(text);
      setError(err?.name === 'AbortError' ? '请求超时，请重试' : err?.message || '请求失败，请重试');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
        <div className="mx-auto max-w-[720px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-mist text-sage-deep">
                <ChatIcon width={26} height={26} />
              </span>
              <p className="mt-5 max-w-[40ch] text-[15px] leading-[2] text-ink-soft">
                想聊点什么都可以，慢慢说清楚就好。
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={clsx(
                      'max-w-[80%] rounded-card px-4 py-3 text-[15px] leading-[2]',
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
