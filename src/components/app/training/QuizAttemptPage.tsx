'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { TrainingQuiz, TrainingQuestion } from '~/data/training-types';

type SafeQuestion = Omit<TrainingQuestion, 'options'> & {
  options: { key: string; text: string }[];
};

export function QuizAttemptPage({ id }: { id: number }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<TrainingQuiz | null>(null);
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    fetch(`/api/training/quizzes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setQuiz(d.quiz);
          setQuestions(d.questions || []);
          startedAt.current = Date.now();
        }
      })
      .catch(() => setError('测评加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  const current = questions[idx];
  const answered = current ? (answers[current.id]?.length ?? 0) > 0 : false;

  function toggle(key: string) {
    if (!current) return;
    setAnswers((prev) => {
      const prevChosen = prev[current.id] || [];
      // 多选：切换 chosen 集合；单选/判断/排序/案例：直接替换
      if (current.type === 'multi') {
        const next = prevChosen.includes(key)
          ? prevChosen.filter((k) => k !== key)
          : [...prevChosen, key];
        return { ...prev, [current.id]: next };
      }
      return { ...prev, [current.id]: [key] };
    });
  }

  async function submit() {
    if (!quiz) return;
    setSubmitting(true);
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`/api/training/quizzes/${quiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            question_id: q.id,
            chosen: answers[q.id] || [],
          })),
          duration_sec: durationSec,
        }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        setSubmitting(false);
        return;
      }
      router.replace(`/app/training/reports/${d.attempt.id}`);
    } catch (e) {
      setError('提交失败，请重试');
      setSubmitting(false);
    }
  }

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [questions, answers]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <div className="h-6 w-40 animate-breathe rounded bg-paper-deep" />
        <div className="mt-6 h-64 animate-breathe rounded-card bg-paper-deep" />
      </div>
    );
  }
  if (error || !quiz || !current) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
          {error || '测评加载失败'}
        </p>
        <Link
          href="/app/training/quizzes"
          className="mt-4 inline-block text-sm text-clay-deep hover:underline"
        >
          ← 返回测评中心
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-6 py-10">
        {/* 顶部：卷名 + 进度 */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-[13px] text-ink-faint">
            <Link href="/app/training/quizzes" className="hover:text-clay-deep">
              ← {quiz.title}
            </Link>
            <span>已答 {answeredCount} / {questions.length}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full bg-clay-deep transition-all duration-[350ms]"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="rounded-card border border-line bg-card px-6 py-6">
          <div className="mb-3 flex items-center gap-2 text-[12px] text-ink-faint">
            <span className="font-medium text-clay-deep">
              第 {idx + 1} 题 / 共 {questions.length}
            </span>
            <span>·</span>
            <span>{questionTypeLabel(current.type)}</span>
            <span>·</span>
            <span>{difficultyLabel(current.difficulty)}</span>
          </div>
          <p className="text-[16px] leading-[1.9] text-ink">{current.stem}</p>
          {current.type === 'multi' && (
            <p className="mt-2 text-[12px] text-clay-deep">
              多选题：漏选或多选均不得分
            </p>
          )}

          <div className="mt-6 space-y-2.5">
            {current.options.map((opt) => {
              const chosen = (answers[current.id] || []).includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors duration-[200ms]',
                    chosen
                      ? 'border-clay-deep bg-sage-mist'
                      : 'border-line bg-paper hover:bg-paper-deep'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium',
                      chosen ? 'bg-clay-deep text-paper' : 'bg-paper-deep text-ink-soft'
                    )}
                  >
                    {opt.key}
                  </span>
                  <span className="pt-0.5 text-[15px] leading-[1.7] text-ink">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 底部：切题 + 提交 */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-card border border-line bg-card px-4 py-2 text-[14px] text-ink transition-colors hover:bg-paper-deep disabled:opacity-40"
          >
            ← 上一题
          </button>

          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              disabled={!answered}
              className="rounded-card bg-clay-deep px-5 py-2 text-[14px] font-medium text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
            >
              下一题 →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || answeredCount < questions.length}
              className="rounded-card bg-clay-deep px-5 py-2 text-[14px] font-medium text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
            >
              {submitting ? '提交中…' : '交卷'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function questionTypeLabel(t: string): string {
  switch (t) {
    case 'single': return '单选';
    case 'multi':  return '多选';
    case 'judge':  return '判断';
    case 'order':  return '排序';
    case 'case':   return '案例分析';
    default:       return t;
  }
}
function difficultyLabel(d: string): string {
  switch (d) {
    case 'entry':    return '入职';
    case 'advanced': return '进阶';
    case 'expert':   return '熟练';
    // 兼容老命名
    case 'easy':     return '简单';
    case 'medium':   return '中等';
    case 'hard':     return '困难';
    default:         return d;
  }
}
