'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PracticeSession, TrainingScenario } from '~/data/training-types';
import { domainName } from '~/data/training-types';

export function PracticePage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/training/scenarios').then((r) => r.json()),
      fetch('/api/training/practice').then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (a.error || b.error) setError(a.error || b.error);
        else {
          setScenarios(a.items || []);
          setSessions(b.items || []);
        }
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  async function startPractice(scenarioId: number) {
    setStarting(scenarioId);
    try {
      const res = await fetch('/api/training/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        setStarting(null);
        return;
      }
      router.push(`/app/training/practice/${d.session.id}`);
    } catch {
      setError('创建练习失败');
      setStarting(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-12 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <span>情景练习</span>
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">情景练习</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          AI 扮演家长、督导、孩子等角色。练完出复盘报告，帮你看清哪些话说得好、哪些还可以更好。
        </p>

        {error && (
          <p className="mt-6 rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</p>
        )}

        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-breathe rounded-card bg-paper-deep" />
            ))}
          </div>
        ) : (
          <>
            {/* 场景列表 */}
            <div className="mt-8">
              <h2 className="mb-4 text-[13px] font-medium tracking-[0.14em] text-clay-deep">
                选一个场景开始
              </h2>
              {scenarios.length === 0 ? (
                <div className="rounded-card border border-line bg-card px-6 py-10 text-center text-[14px] text-ink-faint">
                  情景练习正在配置中。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {scenarios.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col rounded-card border border-line bg-card p-5"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span className="rounded-full bg-sage-mist px-2.5 py-0.5 text-[11px] font-medium text-sage-deep">
                          {domainName(s.category)}
                        </span>
                        {s.role_persona?.who && (
                          <span className="text-[11px] text-ink-faint">
                            AI 扮演：{s.role_persona.who}
                          </span>
                        )}
                      </div>
                      <h3 className="text-[16px] font-medium text-ink">{s.title}</h3>
                      {s.role_persona?.background && (
                        <p className="mt-2 text-[13px] leading-[1.8] text-ink-faint">
                          {s.role_persona.background}
                        </p>
                      )}
                      <button
                        onClick={() => startPractice(s.id)}
                        disabled={starting === s.id}
                        className="mt-auto self-start rounded-card bg-clay-deep px-4 py-2 pt-3 text-[13px] font-medium text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
                      >
                        {starting === s.id ? '准备中…' : '开始练习 →'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 我的练习记录 */}
            {sessions.length > 0 && (
              <div className="mt-12">
                <h2 className="mb-4 text-[13px] font-medium tracking-[0.14em] text-clay-deep">
                  我的练习记录
                </h2>
                <div className="space-y-2">
                  {sessions.map((s) => {
                    const scenario = scenarios.find((x) => x.id === s.scenario_id);
                    return (
                      <Link
                        key={s.id}
                        href={`/app/training/practice/${s.id}`}
                        className="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3 transition-colors hover:bg-paper-deep"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] text-ink">
                            {scenario?.title || `场景 ${s.scenario_id}`}
                          </p>
                          <p className="text-[12px] text-ink-faint">
                            {formatDate(s.updated_at)}
                            {' · '}
                            {s.messages.length} 轮对话
                          </p>
                        </div>
                        <span
                          className={
                            s.status === 'completed'
                              ? 'rounded-full bg-sage-mist px-2 py-0.5 text-[11px] text-sage-deep'
                              : 'rounded-full bg-paper-deep px-2 py-0.5 text-[11px] text-ink-soft'
                          }
                        >
                          {s.status === 'completed'
                            ? s.evaluation
                              ? `${s.evaluation.overall} 分`
                              : '已结束'
                            : '进行中'}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
