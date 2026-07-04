'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { Spinner } from './index';

interface ConfirmOptions {
  title?: string;
  text: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 危险操作按钮用红色（默认 clay 绿） */
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  text?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 允许的最大长度 */
  maxLength?: number;
}

interface DialogCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<DialogCtx | null>(null);

export function useConfirm() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConfirm must be used within <DialogProvider>');
  return v.confirm;
}

export function usePrompt() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrompt must be used within <DialogProvider>');
  return v.prompt;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (v: boolean) => void;
}
interface PromptState extends PromptOptions {
  id: number;
  resolve: (v: string | null) => void;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const seq = useRef(0);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, id: ++seq.current, resolve });
      }),
    []
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPromptState({ ...opts, id: ++seq.current, resolve });
      }),
    []
  );

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {confirmState && (
        <ConfirmModal
          key={confirmState.id}
          state={confirmState}
          onClose={(v) => {
            confirmState.resolve(v);
            setConfirmState(null);
          }}
        />
      )}
      {promptState && (
        <PromptModal
          key={promptState.id}
          state={promptState}
          onClose={(v) => {
            promptState.resolve(v);
            setPromptState(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 px-6 animate-fade-in">
      {children}
    </div>
  );
}

function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Overlay>
      <div className="w-full max-w-sm rounded-section bg-card p-6 shadow-md">
        {state.title && (
          <h3 className="mb-2 font-serif text-base text-ink">{state.title}</h3>
        )}
        <p className="text-sm leading-[1.9] text-ink">{state.text}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onClose(false)}
            disabled={loading}
            className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors duration-[250ms] hover:border-ink-soft hover:text-ink disabled:opacity-40"
          >
            {state.cancelLabel || '取消'}
          </button>
          <button
            onClick={() => {
              setLoading(true);
              onClose(true);
            }}
            disabled={loading}
            style={{
              backgroundColor: state.danger ? '#C08585' : '#7FA98B',
            }}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors duration-[250ms] disabled:opacity-60',
              state.danger
                ? 'bg-danger hover:bg-danger-deep'
                : 'bg-clay hover:bg-clay-deep'
            )}
          >
            {loading && <Spinner className="h-3.5 w-3.5" />}
            {state.confirmLabel || '确认'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function PromptModal({
  state,
  onClose,
}: {
  state: PromptState;
  onClose: (v: string | null) => void;
}) {
  const [value, setValue] = useState(state.initialValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.select(), 30);
    return () => clearTimeout(t);
  }, []);
  function submit() {
    const v = value.trim();
    if (!v) return;
    onClose(v);
  }
  return (
    <Overlay>
      <div className="w-full max-w-sm rounded-section bg-card p-6 shadow-md">
        <h3 className="mb-2 font-serif text-lg text-ink">{state.title}</h3>
        {state.text && (
          <p className="mb-3 text-xs leading-[1.9] text-ink-faint">{state.text}</p>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose(null);
            }
          }}
          maxLength={state.maxLength}
          placeholder={state.placeholder}
          className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-clay"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => onClose(null)}
            className="rounded-full px-4 py-2 text-xs text-ink-soft hover:bg-paper-deep"
          >
            {state.cancelLabel || '取消'}
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="rounded-full bg-clay px-4 py-2 text-xs font-medium text-white hover:bg-clay-deep disabled:opacity-40"
          >
            {state.confirmLabel || '确认'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
