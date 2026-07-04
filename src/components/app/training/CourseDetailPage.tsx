'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { TrainingCourse } from '~/data/training-types';
import { domainName } from '~/data/training-types';

export function CourseDetailPage({ id }: { id: number }) {
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch(`/api/training/courses/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setCourse(d.course);
      })
      .catch(() => setError('课程加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  // 观察章节位置切换 current；提交进度节流
  const outline = course?.outline || [];
  useEffect(() => {
    if (!outline.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.idx);
          if (Number.isFinite(idx)) setCurrent(idx);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [outline.length]);

  useEffect(() => {
    if (!course || outline.length === 0) return;
    const pct = Math.round(((current + 1) / outline.length) * 100);
    fetch(`/api/training/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress_pct: pct, last_section: current }),
    }).catch(() => {});
  }, [current, id, course, outline.length]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <div className="h-8 w-40 animate-breathe rounded bg-paper-deep" />
        <div className="mt-6 h-80 animate-breathe rounded-card bg-paper-deep" />
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
          {error || '课程不存在'}
        </p>
        <Link href="/app/training/courses" className="mt-4 inline-block text-sm text-clay-deep hover:underline">
          ← 返回课程库
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-10 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <Link href="/app/training/courses" className="hover:text-clay-deep">课程库</Link>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-sage-mist px-2.5 py-0.5 text-[12px] text-sage-deep">
            {domainName(course.category)}
          </span>
          {course.duration_min && (
            <span className="text-[12px] text-ink-faint">{course.duration_min} 分钟</span>
          )}
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">{course.title}</h1>

        {/* 关键要点 */}
        {course.key_takeaways && course.key_takeaways.length > 0 && (
          <div className="mt-6 rounded-card border border-line bg-card px-6 py-5">
            <p className="mb-3 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
              这门课你会掌握
            </p>
            <ul className="space-y-1.5">
              {course.key_takeaways.map((t, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-[1.9] text-ink">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-clay-deep" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 章节内容 + 目录 */}
        {outline.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
            {/* 章节目录（左侧粘性） */}
            <aside className="md:sticky md:top-6 md:self-start">
              <p className="mb-3 text-[12px] font-medium tracking-[0.14em] text-ink-faint">
                章节目录
              </p>
              <ol className="space-y-1">
                {outline.map((s, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={clsx(
                        'block w-full rounded-card px-3 py-2 text-left text-[13px] leading-[1.7] transition-colors',
                        current === i
                          ? 'bg-sage-mist text-sage-deep'
                          : 'text-ink-soft hover:bg-paper-deep hover:text-ink'
                      )}
                    >
                      <span className="mr-2 text-[11px] font-medium tracking-[0.1em] text-ink-faint">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ol>
            </aside>

            {/* 正文 */}
            <div className="min-w-0 space-y-10">
              {outline.map((s, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    sectionRefs.current[i] = el;
                  }}
                  data-idx={i}
                  className="scroll-mt-6"
                >
                  <p className="text-[11px] font-medium tracking-[0.2em] text-clay-deep">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h2 className="mt-1 font-serif text-[22px] text-ink">{s.title}</h2>
                  {s.illust_url && (
                    <div className="relative mt-4 aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-card bg-paper-deep">
                      <Image
                        src={s.illust_url}
                        alt={s.title}
                        fill
                        sizes="420px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <p className="mt-4 whitespace-pre-line text-[15px] leading-[2] text-ink">
                    {s.summary}
                  </p>
                  {s.key_points && s.key_points.length > 0 && (
                    <div className="mt-4 rounded-card bg-paper-deep px-5 py-4">
                      <p className="mb-2 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
                        关键要点
                      </p>
                      <ul className="space-y-1.5">
                        {s.key_points.map((p, j) => (
                          <li key={j} className="flex gap-2 text-[14px] leading-[1.8] text-ink-soft">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-clay-deep" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {/* 底部行动条 */}
              <div className="mt-16 border-t border-line pt-8">
                <p className="text-[13px] text-ink-faint">看完这门课，去检验一下：</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/app/training/quizzes"
                    className="rounded-card bg-clay-deep px-5 py-2.5 text-[14px] font-medium text-paper transition-colors hover:bg-sage-deep"
                  >
                    去做测评 →
                  </Link>
                  <Link
                    href="/app/training/practice"
                    className="rounded-card border border-line bg-card px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-paper-deep"
                  >
                    去练习一次
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-card border border-line bg-card px-6 py-6">
            <p className="text-[14px] text-ink-soft">
              这门课的结构化图文稿正在生成中，稍后再来。
            </p>
            {course.raw_transcript && (
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] text-clay-deep">
                  查看原始逐字稿
                </summary>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-[1.9] text-ink-soft">
                  {course.raw_transcript}
                </p>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
