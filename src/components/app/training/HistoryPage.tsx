'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type {
  PracticeSession,
  QuizAttempt,
  TrainingScenario,
} from '~/data/training-types';
import { CheckIcon, ChatIcon } from '~/components/ui/icons';

type Tab = 'quiz' | 'practice';

interface QuizAttemptItem extends QuizAttempt {
  quiz_title: string;
  quiz_pass_score: number;
}

/**
 * 内嵌面板：不带页头/面包屑，用于嵌入能力画像页的 Tab
 */
export function HistoryPanel() {
  const [tab, setTab] = useState<Tab>('quiz');
  const [attempts, setAttempts] = useState<QuizAttemptItem[]>([]);
  const [practices, setPractices] = useState<PracticeSession[]>([]);
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/training/attempts').then((r) => r.json()),
      fetch('/api/training/practice').then((r) => r.json()),
      fetch('/api/training/scenarios').then((r) => r.json()),
    ])
      .then(([a, p, s]) => {
        if (a.error || p.error || s.error) setError(a.error || p.error || s.error);
        else {
          setAttempts(a.items || []);
          setPractices(p.items || []);
          setScenarios(s.items || []);
        }
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const scenarioMap = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);

  return (
    <div className="mt-6">
      {/* 内部小 Tabs（切换测评/练习） */}
      <div className="mb-4 flex gap-2">
        <InnerTabButton active={tab === 'quiz'} onClick={() => setTab('quiz')}>
          <CheckIcon width={13} height={13} />
          测评
          {attempts.length > 0 && (
            <span className="ml-1 rounded-full bg-paper-deep px-1.5 text-[11px] text-ink-soft">
              {attempts.length}
            </span>
          )}
        </InnerTabButton>
        <InnerTabButton active={tab === 'practice'} onClick={() => setTab('practice')}>
          <ChatIcon width={13} height={13} />
          练习
          {practices.length > 0 && (
            <span className="ml-1 rounded-full bg-paper-deep px-1.5 text-[11px] text-ink-soft">
              {practices.length}
            </span>
          )}
        </InnerTabButton>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-breathe rounded-card bg-paper-deep" />
          ))}
        </div>
      )}
      {error && <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</p>}

      {!loading && !error && tab === 'quiz' && <QuizList attempts={attempts} />}
      {!loading && !error && tab === 'practice' && (
        <PracticeList practices={practices} scenarioMap={scenarioMap} />
      )}
    </div>
  );
}

/**
 * 独立整页（保留作为 /app/training/history 的 deep link）
 */
export function HistoryPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-6 py-12 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <Link href="/app/training/profile" className="hover:text-clay-deep">能力画像</Link>
          <span className="mx-1.5">/</span>
          <span>我的记录</span>
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">我的记录</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          回看历次测评的得分和练习的复盘，随时查看当时答错的题、AI 给的反馈。
        </p>

        <HistoryPanel />

        <div className="mt-8">
          <Link
            href="/app/training/profile"
            className="text-[13px] text-clay-deep hover:underline"
          >
            ← 查看能力画像
          </Link>
        </div>
      </div>
    </div>
  );
}

function InnerTabButton({
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
        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-clay-deep text-paper'
          : 'bg-card text-ink-soft hover:bg-paper-deep hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function QuizList({ attempts }: { attempts: QuizAttemptItem[] }) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-card border border-line bg-card px-6 py-10 text-center">
        <p className="text-[14px] text-ink-faint">还没有测评记录。</p>
        <Link
          href="/app/training/quizzes"
          className="mt-3 inline-block text-[13px] text-clay-deep hover:underline"
        >
          去做一份测评 →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {attempts.map((a) => {
        const passed = (a.score ?? 0) >= a.quiz_pass_score;
        return (
          <Link
            key={a.id}
            href={`/app/training/reports/${a.id}`}
            className="flex items-center gap-4 rounded-card border border-line bg-card px-5 py-4 transition-colors hover:bg-paper-deep"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{a.quiz_title}</p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                {formatDate(a.created_at)}
                {a.duration_sec != null && ` · 用时 ${formatDuration(a.duration_sec)}`}
                {` · 答 ${Array.isArray(a.answers) ? a.answers.length : 0} 题`}
              </p>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={clsx(
                  'font-serif text-[28px] font-medium leading-none',
                  passed ? 'text-clay-deep' : 'text-clay'
                )}
              >
                {a.score ?? '—'}
              </span>
              <span className="text-[12px] text-ink-soft">/100</span>
            </div>
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                passed ? 'bg-sage-mist text-sage-deep' : 'bg-clay-mist text-clay'
              )}
            >
              {passed ? '已通过' : '未达标'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PracticeList({
  practices,
  scenarioMap,
}: {
  practices: PracticeSession[];
  scenarioMap: Map<number, TrainingScenario>;
}) {
  if (practices.length === 0) {
    return (
      <div className="rounded-card border border-line bg-card px-6 py-10 text-center">
        <p className="text-[14px] text-ink-faint">还没有练习记录。</p>
        <Link
          href="/app/training/practice"
          className="mt-3 inline-block text-[13px] text-clay-deep hover:underline"
        >
          去开始一次练习 →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {practices.map((s) => {
        const scenario = scenarioMap.get(s.scenario_id);
        const userMsgs = s.messages.filter((m) => m.role === 'user').length;
        const done = s.status === 'completed';
        return (
          <Link
            key={s.id}
            href={`/app/training/practice/${s.id}`}
            className="flex items-center gap-4 rounded-card border border-line bg-card px-5 py-4 transition-colors hover:bg-paper-deep"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">
                {scenario?.title || `场景 ${s.scenario_id}`}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                {formatDate(s.updated_at)}
                {` · 对话 ${userMsgs} 轮`}
                {scenario?.role_persona?.who && ` · AI 扮演 ${scenario.role_persona.who}`}
              </p>
            </div>
            {done && s.evaluation ? (
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[28px] font-medium leading-none text-clay-deep">
                  {s.evaluation.overall}
                </span>
                <span className="text-[12px] text-ink-soft">/100</span>
              </div>
            ) : null}
            <span
              className={
                done
                  ? 'rounded-full bg-sage-mist px-2.5 py-0.5 text-[11px] text-sage-deep font-medium'
                  : 'rounded-full bg-paper-deep px-2.5 py-0.5 text-[11px] text-ink-soft'
              }
            >
              {done ? '已完成' : '进行中'}
            </span>
          </Link>
        );
      })}
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

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}
