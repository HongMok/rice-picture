'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TrainingQuiz } from '~/data/training-types';
import { domainName } from '~/data/training-types';

export function QuizzesPage() {
  const [items, setItems] = useState<TrainingQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/training/quizzes')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setItems(d.items || []);
      })
      .catch(() => setError('测评列表加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-12 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <span>测评中心</span>
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">测评中心</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          选择式追问，非技术用户也会用。答完自动出报告，命中知识点，指路薄弱环节。
        </p>

        <div className="mt-8">
          {loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-breathe rounded-card bg-paper-deep" />
              ))}
            </div>
          )}
          {error && (
            <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</p>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-card border border-line bg-card px-6 py-10 text-center text-[14px] text-ink-faint">
              测评卷正在配置中。
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((q) => (
                <Link
                  key={q.id}
                  href={`/app/training/quizzes/${q.id}`}
                  className="group flex flex-col gap-2 rounded-card border border-line bg-card p-5 transition-colors duration-[450ms] hover:bg-paper-deep"
                >
                  <div className="flex items-start justify-between gap-3">
                    {q.category && (
                      <span className="rounded-full bg-sage-mist px-2.5 py-0.5 text-[11px] font-medium text-sage-deep">
                        {domainName(q.category)}
                      </span>
                    )}
                    <span className="text-[11px] text-ink-faint">
                      {q.question_count} 题
                      {q.duration_min ? ` · 约 ${q.duration_min} 分钟` : ''}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-medium text-ink">{q.title}</h3>
                  {q.description && (
                    <p className="text-[13px] leading-[1.8] text-ink-faint">{q.description}</p>
                  )}
                  <span className="mt-1 text-[13px] text-clay-deep">开始测评 →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
