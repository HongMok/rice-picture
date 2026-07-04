'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { CourseListItem } from '~/data/training-types';
import { DOMAINS, domainName } from '~/data/training-types';

export function CoursesPage() {
  const [items, setItems] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>('all');

  useEffect(() => {
    fetch('/api/training/courses')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setItems(d.items || []);
      })
      .catch(() => setError('课程列表加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const activeCats = useMemo(() => {
    const s = new Set(items.map((i) => i.category));
    return DOMAINS.filter((c) => s.has(c.key));
  }, [items]);

  const filtered = useMemo(
    () => (cat === 'all' ? items : items.filter((i) => i.category === cat)),
    [items, cat]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-12 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <span>课程库</span>
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">课程库</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          结构化图文学习稿，每章配要点。学完可以直接去练习或测评。
        </p>

        {/* 分类切换 */}
        {activeCats.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <CategoryChip active={cat === 'all'} onClick={() => setCat('all')}>
              全部 · {items.length}
            </CategoryChip>
            {activeCats.map((c) => (
              <CategoryChip
                key={c.key}
                active={cat === c.key}
                onClick={() => setCat(c.key)}
              >
                {c.short}
              </CategoryChip>
            ))}
          </div>
        )}

        <div className="mt-6">
          {loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-breathe rounded-card bg-paper-deep" />
              ))}
            </div>
          )}
          {error && (
            <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-card border border-line bg-card px-6 py-10 text-center text-[14px] text-ink-faint">
              课程正在录入中，先做点别的吧。
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-[250ms]',
        active
          ? 'bg-clay-deep text-paper'
          : 'bg-card text-ink-soft hover:bg-paper-deep hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function CourseCard({ course }: { course: CourseListItem }) {
  return (
    <Link
      href={`/app/training/courses/${course.id}`}
      className="group flex flex-col gap-3 rounded-card border border-line bg-card p-5 transition-colors duration-[450ms] hover:bg-paper-deep"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-sage-mist px-2.5 py-0.5 text-[11px] font-medium text-sage-deep">
          {domainName(course.category)}
        </span>
        {course.completed ? (
          <span className="rounded-full bg-clay-deep px-2.5 py-0.5 text-[11px] font-medium text-paper">
            已完成
          </span>
        ) : (
          <span className="text-[11px] text-ink-faint">
            {course.duration_min ? `${course.duration_min} 分钟` : ''}
          </span>
        )}
      </div>
      <h3 className="text-[16px] font-medium text-ink">{course.title}</h3>
      {course.section_count > 0 && (
        <p className="text-[12px] text-ink-faint">共 {course.section_count} 章</p>
      )}
      {course.progress_pct !== undefined && course.progress_pct > 0 && !course.completed && (
        <div className="mt-1">
          <div className="h-1 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full bg-clay-deep"
              style={{ width: `${course.progress_pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">已学 {course.progress_pct}%</p>
        </div>
      )}
    </Link>
  );
}
