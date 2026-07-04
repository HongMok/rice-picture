'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type {
  QuizAttempt,
  TrainingQuestion,
  TrainingQuiz,
  Competency,
  Domain,
  CognitiveLevel,
} from '~/data/training-types';
import {
  COMPETENCIES,
  DOMAINS,
  COGNITIVE_LEVELS,
  domainShort,
  competencyName,
} from '~/data/training-types';

export function ReportPage({ id }: { id: number }) {
  const [data, setData] = useState<{
    attempt: QuizAttempt;
    quiz: TrainingQuiz;
    questions: TrainingQuestion[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandOnlyWrong, setExpandOnlyWrong] = useState(true);

  useEffect(() => {
    fetch(`/api/training/attempts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('报告加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.quiz.question_ids.length;
    const correct = data.attempt.answers.filter((a) => a.correct).length;
    const wrongIds = new Set(
      data.attempt.answers.filter((a) => !a.correct).map((a) => a.question_id)
    );

    // 岗位能力 C1-C6 得分
    const compAgg = new Map<Competency, { total: number; ok: number; failedCritical: boolean }>();
    for (const c of COMPETENCIES) compAgg.set(c.key, { total: 0, ok: 0, failedCritical: false });

    // 领域 × 认知层级 矩阵
    const matrix = new Map<string, { total: number; ok: number }>();

    // 关键项统计
    let keyItemTotal = 0;
    let keyItemFailed = 0;

    data.questions.forEach((q) => {
      const ans = data.attempt.answers.find((a) => a.question_id === q.id);
      const ok = !!ans?.correct;
      const comps: Competency[] = (q.competencies as Competency[]) || [];
      for (const c of comps) {
        const m = compAgg.get(c);
        if (!m) continue;
        m.total += 1;
        if (ok) m.ok += 1;
        else if (q.is_key_item && c === 'C4') m.failedCritical = true;
      }
      if (q.cognitive_level && q.category) {
        const cellKey = `${q.category}|${q.cognitive_level}`;
        const cell = matrix.get(cellKey) || { total: 0, ok: 0 };
        cell.total += 1;
        if (ok) cell.ok += 1;
        matrix.set(cellKey, cell);
      }
      if (q.is_key_item) {
        keyItemTotal += 1;
        if (!ok) keyItemFailed += 1;
      }
    });

    const competencies = COMPETENCIES.map((c) => {
      const m = compAgg.get(c.key)!;
      return {
        key: c.key,
        name: c.name,
        is_critical: !!c.is_critical,
        total: m.total,
        ok: m.ok,
        pct: m.total > 0 ? Math.round((m.ok / m.total) * 100) : 0,
        critical_failed: m.failedCritical,
      };
    }).filter((c) => c.total > 0);

    // 只保留出现过的领域/层级，避免大量空格子
    const activeDomains = Array.from(
      new Set(data.questions.map((q) => q.category).filter(Boolean) as Domain[])
    ).sort();
    const activeLevels = Array.from(
      new Set(
        data.questions.map((q) => q.cognitive_level).filter(Boolean) as CognitiveLevel[]
      )
    ).sort();

    return {
      total,
      correct,
      wrongIds,
      competencies,
      matrix,
      activeDomains,
      activeLevels,
      keyItemTotal,
      keyItemFailed,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[820px] px-6 py-12">
        <div className="h-40 animate-breathe rounded-card bg-paper-deep" />
      </div>
    );
  }
  if (error || !data || !stats) {
    return (
      <div className="mx-auto max-w-[820px] px-6 py-12">
        <p className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
          {error || '报告不存在'}
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

  const { attempt, quiz, questions } = data;
  const score = attempt.score ?? 0;
  const passed = score >= quiz.pass_score;
  const answersById = new Map(attempt.answers.map((a) => [a.question_id, a]));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-6 py-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <Link href="/app/training/quizzes" className="hover:text-clay-deep">测评中心</Link>
          <span className="mx-1.5">/</span>
          <span>报告</span>
        </div>

        {/* 大标题 + 得分 */}
        <div className="rounded-card border border-line bg-card p-8">
          <p className="text-[13px] text-ink-faint">{quiz.title}</p>
          <div className="mt-2 flex items-end gap-3">
            <span
              className={clsx(
                'font-serif text-[56px] font-medium leading-none',
                passed ? 'text-clay-deep' : 'text-clay'
              )}
            >
              {score}
            </span>
            <span className="pb-2 text-[16px] text-ink-soft">/ 100</span>
            <span
              className={clsx(
                'ml-2 pb-2 rounded-full px-3 py-1 text-[12px] font-medium',
                passed ? 'bg-sage-mist text-sage-deep' : 'bg-clay-mist text-clay'
              )}
            >
              {passed ? '已通过' : '未达标'}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-ink-faint">
            答对 {stats.correct} / {stats.total} 题
            {attempt.duration_sec ? ` · 用时 ${formatDuration(attempt.duration_sec)}` : ''}
          </p>
        </div>

        {/* 关键项预警 */}
        {stats.keyItemFailed > 0 && (
          <div className="mt-6 rounded-card border border-clay bg-clay-mist px-5 py-4">
            <p className="text-[13px] font-medium text-clay">
              ⚠ 你在关键项（职业伦理）上有 {stats.keyItemFailed} / {stats.keyItemTotal} 题答错
            </p>
            <p className="mt-1 text-[12px] leading-[1.8] text-clay">
              关键项即使总分达标也可能不通过本次测评。请重新学习相关内容后再挑战。
            </p>
          </div>
        )}

        {/* 岗位能力得分（C1-C6） */}
        {stats.competencies.length > 0 && (
          <div className="mt-6 rounded-card border border-line bg-card p-6">
            <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
              岗位能力得分
            </p>
            <div className="space-y-3">
              {stats.competencies.map((c) => (
                <div key={c.key}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-ink">
                      {c.name}
                      {c.is_critical && (
                        <span className="rounded-full bg-clay-mist px-2 py-0.5 text-[10px] font-medium text-clay">
                          关键项
                        </span>
                      )}
                    </span>
                    <span className="text-ink-soft">
                      {c.ok}/{c.total} · {c.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-paper-deep">
                    <div
                      className={clsx(
                        'h-full',
                        c.critical_failed
                          ? 'bg-clay'
                          : c.pct >= 80
                          ? 'bg-sage-deep'
                          : c.pct >= 60
                          ? 'bg-clay-deep'
                          : 'bg-clay'
                      )}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 领域 × 认知层级 矩阵 */}
        {stats.activeDomains.length > 0 && stats.activeLevels.length > 0 && (
          <div className="mt-6 rounded-card border border-line bg-card p-6">
            <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
              领域 × 认知层级 矩阵
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="border-b border-line py-2 pr-2 text-left text-ink-faint">
                      领域 \ 层级
                    </th>
                    {stats.activeLevels.map((l) => (
                      <th
                        key={l}
                        className="border-b border-line px-2 py-2 text-center text-ink-faint"
                      >
                        {l}
                        <span className="ml-1 text-[10px] opacity-70">
                          {COGNITIVE_LEVELS.find((x) => x.key === l)?.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.activeDomains.map((d) => (
                    <tr key={d}>
                      <td className="border-b border-line py-2 pr-2 text-ink">
                        <span className="mr-1 text-[10px] font-medium tracking-[0.1em] text-clay-deep">
                          {d}
                        </span>
                        {domainShort(d)}
                      </td>
                      {stats.activeLevels.map((l) => {
                        const cell = stats.matrix.get(`${d}|${l}`);
                        if (!cell) {
                          return (
                            <td
                              key={l}
                              className="border-b border-line px-2 py-2 text-center text-ink-faint"
                            >
                              —
                            </td>
                          );
                        }
                        const pct = Math.round((cell.ok / cell.total) * 100);
                        return (
                          <td
                            key={l}
                            className={clsx(
                              'border-b border-line px-2 py-2 text-center font-medium',
                              pct === 100 ? 'text-sage-deep' : pct >= 50 ? 'text-clay-deep' : 'text-clay'
                            )}
                          >
                            {cell.ok}/{cell.total}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              绿色 = 全对；橙色 = 部分对；红色 = 半数以上错。
            </p>
          </div>
        )}

        {/* 题目回顾 */}
        <div className="mt-6 rounded-card border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[12px] font-medium tracking-[0.14em] text-clay-deep">
              题目回顾
            </p>
            <button
              onClick={() => setExpandOnlyWrong((v) => !v)}
              className="text-[12px] text-ink-soft hover:text-clay-deep"
            >
              {expandOnlyWrong ? '显示全部' : '只看错题'}
            </button>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const ans = answersById.get(q.id);
              const isWrong = ans && !ans.correct;
              if (expandOnlyWrong && !isWrong) return null;
              return (
                <QuestionReview
                  key={q.id}
                  index={i}
                  q={q}
                  chosen={ans?.chosen || []}
                  correct={!!ans?.correct}
                />
              );
            })}
          </div>
        </div>

        {/* 行动条 */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/training/quizzes"
            className="rounded-card border border-line bg-card px-5 py-2.5 text-[14px] text-ink hover:bg-paper-deep"
          >
            ← 返回测评中心
          </Link>
          <Link
            href="/app/training/profile"
            className="rounded-card bg-clay-deep px-5 py-2.5 text-[14px] font-medium text-paper hover:bg-sage-deep"
          >
            查看能力画像 →
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuestionReview({
  index,
  q,
  chosen,
  correct,
}: {
  index: number;
  q: TrainingQuestion;
  chosen: string[];
  correct: boolean;
}) {
  const correctKeys = q.options.filter((o) => o.is_correct).map((o) => o.key);
  return (
    <div className="rounded-card border border-line bg-paper px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-[12px]">
        <span className="text-clay-deep">第 {index + 1} 题</span>
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 font-medium',
            correct ? 'bg-sage-mist text-sage-deep' : 'bg-clay-mist text-clay'
          )}
        >
          {correct ? '答对' : '答错'}
        </span>
      </div>
      <p className="text-[14px] leading-[1.9] text-ink">{q.stem}</p>
      <div className="mt-3 space-y-1.5">
        {q.options.map((opt) => {
          const isChosen = chosen.includes(opt.key);
          const isCorrect = opt.is_correct;
          return (
            <div
              key={opt.key}
              className={clsx(
                'flex items-start gap-2 rounded-card px-3 py-2 text-[13px]',
                isCorrect && 'bg-sage-mist',
                !isCorrect && isChosen && 'bg-clay-mist'
              )}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                  isCorrect
                    ? 'bg-sage-deep text-paper'
                    : isChosen
                    ? 'bg-clay text-paper'
                    : 'bg-paper-deep text-ink-soft'
                )}
              >
                {opt.key}
              </span>
              <span className="flex-1 text-ink">{opt.text}</span>
              {isCorrect && <span className="text-[11px] text-sage-deep">正确答案</span>}
              {!isCorrect && isChosen && <span className="text-[11px] text-clay">你的选择</span>}
            </div>
          );
        })}
      </div>
      {/* 解析：从正确选项拼出解释 */}
      {q.options.some((o) => o.is_correct && o.explain) && (
        <div className="mt-3 rounded-card bg-paper-deep px-4 py-3">
          <p className="mb-1 text-[11px] font-medium tracking-[0.14em] text-clay-deep">解析</p>
          {q.options
            .filter((o) => o.is_correct && o.explain)
            .map((o) => (
              <p key={o.key} className="text-[13px] leading-[1.8] text-ink-soft">
                {o.explain}
              </p>
            ))}
        </div>
      )}
      {(q.knowledge_item_codes?.length > 0 || q.knowledge_points.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {q.knowledge_item_codes?.map((code) => (
            <span
              key={code}
              className="rounded-full bg-sage-mist px-2 py-0.5 text-[11px] font-medium text-sage-deep"
            >
              {code}
            </span>
          ))}
          {q.knowledge_points.map((kp) => (
            <span
              key={kp}
              className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] text-ink-soft"
            >
              # {kp}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}
