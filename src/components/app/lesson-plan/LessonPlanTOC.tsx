'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

export interface TocEntry {
  id: string;
  label: string;
  index: string;
}

export const LESSON_PLAN_TOC: TocEntry[] = [
  { id: 'sec-overview', label: '概览', index: '①' },
  { id: 'sec-goals', label: '目标', index: '②' },
  { id: 'sec-setup', label: '教学准备', index: '③' },
  { id: 'sec-abc', label: '一节课怎么上', index: '④' },
  { id: 'sec-checklist', label: '教学项清单', index: '⑤' },
];

export function LessonPlanTOC({
  scrollRoot,
  footer,
}: {
  scrollRoot: React.RefObject<HTMLElement | null>;
  footer?: React.ReactNode;
}) {
  const [active, setActive] = useState<string>(LESSON_PLAN_TOC[0].id);
  const suppressUntil = useRef<number>(0);

  useEffect(() => {
    const root = scrollRoot.current;
    if (!root) return;

    const sections = LESSON_PLAN_TOC.map((e) => document.getElementById(e.id)).filter(
      (el): el is HTMLElement => !!el
    );
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressUntil.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        if (visible[0]?.id) setActive(visible[0].id);
      },
      {
        root,
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [scrollRoot]);

  function scrollTo(id: string) {
    const target = document.getElementById(id);
    const root = scrollRoot.current;
    if (!target || !root) return;
    suppressUntil.current = Date.now() + 700;
    setActive(id);
    const top = target.offsetTop - 12;
    root.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <aside className="hidden w-[220px] flex-shrink-0 flex-col border-r border-line bg-card md:flex">
      <nav className="flex-1 overflow-y-auto px-3 py-6">
        <p className="mb-3 px-3 text-[11px] uppercase tracking-widest text-ink-faint">
          教案目录
        </p>
        <div className="space-y-0.5">
          {LESSON_PLAN_TOC.map((entry) => {
            const isActive = active === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => scrollTo(entry.id)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-input px-3 py-2 text-left text-[13px] transition-colors',
                  isActive
                    ? 'bg-sage-mist text-sage-deep'
                    : 'text-ink hover:bg-paper-deep'
                )}
              >
                <span className="flex-shrink-0 text-[13px] font-medium text-ink-faint">
                  {entry.index}
                </span>
                <span className="truncate">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {footer && <div className="border-t border-line px-4 py-4">{footer}</div>}
    </aside>
  );
}
