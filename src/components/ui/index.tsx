'use client';

import clsx from 'clsx';
import { forwardRef } from 'react';

/* ---------------- Button ---------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading, className, children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          variant === 'primary' &&
            'bg-clay text-white shadow-soft hover:bg-clay/90 active:bg-clay',
          variant === 'outline' &&
            'border border-cream-line bg-white text-ink hover:bg-cream',
          variant === 'ghost' && 'text-ink-soft hover:bg-clay-soft',
          className
        )}
        {...rest}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

/* ---------------- Input ---------------- */
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-xl border border-cream-line bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition-colors focus:border-clay',
        className
      )}
      {...rest}
    />
  )
);
Input.displayName = 'Input';

/* ---------------- Textarea ---------------- */
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        'w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-ink placeholder:text-neutral-400 outline-none transition-colors focus:border-ink',
        className
      )}
      {...rest}
    />
  )
);
Textarea.displayName = 'Textarea';

/* ---------------- Spinner ---------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------- Label ---------------- */
export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
      {children}
      {required && <span className="ml-0.5 text-neutral-400">*</span>}
    </label>
  );
}
