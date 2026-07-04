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

type ToastKind = 'info' | 'success' | 'error' | 'warning';

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastCtx {
  show: (text: string, kind?: ToastKind) => void;
  info: (text: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  warning: (text: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used within <ToastProvider>');
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = ++seq.current;
      setItems((xs) => [...xs, { id, kind, text }]);
      setTimeout(() => remove(id), kind === 'error' ? 4200 : 2600);
    },
    [remove]
  );

  const api: ToastCtx = {
    show,
    info: (t) => show(t, 'info'),
    success: (t) => show(t, 'success'),
    error: (t) => show(t, 'error'),
    warning: (t) => show(t, 'warning'),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      role="status"
      onClick={onClose}
      className={clsx(
        'pointer-events-auto flex max-w-md cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        item.kind === 'error' &&
          'border-danger/40 bg-white/95 text-danger-deep',
        item.kind === 'warning' &&
          'border-danger/40 bg-white/95 text-danger-deep',
        item.kind === 'success' &&
          'border-sage/40 bg-white/95 text-sage-deep',
        item.kind === 'info' && 'border-line bg-white/95 text-ink'
      )}
    >
      <ToastIcon kind={item.kind} />
      <span className="leading-relaxed">{item.text}</span>
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const cls = 'h-4 w-4 shrink-0';
  const stroke = 'currentColor';
  if (kind === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M5 12l4 4L19 6" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16v.5" />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v5M12 18v.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.5" />
    </svg>
  );
}
