'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { AbilityProfile, CompetencyScore, DomainCoverage } from '~/data/training-types';
import { HistoryPanel } from '~/components/app/training/HistoryPage';
import { CheckIcon, WorksIcon } from '~/components/ui/icons';

type Tab = 'overview' | 'history';

export function ProfilePage() {
  const router = useRouter();
  const search = useSearchParams();
  const activeTab: Tab = (search?.get('tab') as Tab) === 'history' ? 'history' : 'overview';

  function setTab(t: Tab) {
    const q = new URLSearchParams(search?.toString());
    if (t === 'overview') q.delete('tab');
    else q.set('tab', t);
    const qs = q.toString();
    router.replace(`/app/training/profile${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-6 py-12 md:px-10">
        <div className="mb-2 text-[13px] text-ink-faint">
          <Link href="/app/training" className="hover:text-clay-deep">培训测评</Link>
          <span className="mx-1.5">/</span>
          <span>能力画像</span>
        </div>
        <h1 className="font-serif text-[32px] font-normal text-ink">能力画像</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          综合六大岗位能力和 12 个知识领域评估你的康复水平；同时可以查看每一次测评和练习的历史记录。
        </p>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-line">
          <TabButton active={activeTab === 'overview'} onClick={() => setTab('overview')}>
            <WorksIcon width={14} height={14} />
            概览
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setTab('history')}>
            <CheckIcon width={14} height={14} />
            历史记录
          </TabButton>
        </div>

        {activeTab === 'overview' ? <OverviewPanel /> : <HistoryPanel />}
      </div>
    </div>
  );
}

function TabButton({
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
        'relative -mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[14px] transition-colors',
        active
          ? 'border-clay-deep text-clay-deep font-medium'
          : 'border-transparent text-ink-soft hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function OverviewPanel() {
  const [profile, setProfile] = useState<AbilityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/training/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setProfile(d.profile);
      })
      .catch(() => setError('能力画像加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mt-6 h-80 animate-breathe rounded-card bg-paper-deep" />;
  if (error) return <p className="mt-6 rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</p>;
  if (!profile) return null;

  return (
    <div className="mt-6 space-y-6">
      {/* 关键项警告 */}
      {profile.competencies.some((c) => c.critical_failed) && (
        <div className="rounded-card border border-clay bg-clay-mist px-5 py-3">
          <p className="text-[13px] font-medium text-clay">
            ⚠ 你在职业伦理（C4 关键项）上有答错题目。伦理题错误可能影响整卷通过——建议重新学习相关课程。
          </p>
        </div>
      )}

      {/* 综合分 + 六维雷达 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_360px]">
        <div className="rounded-card border border-line bg-card p-8">
          <p className="text-[13px] text-ink-faint">综合掌握</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-serif text-[64px] font-medium leading-none text-clay-deep">
              {profile.overall}
            </span>
            <span className="pb-3 text-[16px] text-ink-soft">/ 100</span>
          </div>
          <p className="mt-4 text-[13px] leading-[1.9] text-ink-soft">
            {profile.overall === 0
              ? '你还没有答题记录。先做一份测评开始吧。'
              : profile.overall >= 80
              ? '你已经掌握了大部分核心内容，可以挑战更复杂的场景。'
              : profile.overall >= 60
              ? '基础已经打牢，重点补齐薄弱的能力项。'
              : '刚起步。系统地过一遍课程，再来做测评。'}
          </p>
        </div>
        <RadarChart items={profile.competencies} />
      </div>

      {/* 岗位能力详情 C1-C6 */}
      <div className="rounded-card border border-line bg-card p-6">
        <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
          岗位能力详情
        </p>
        <div className="space-y-4">
          {profile.competencies.map((c) => (
            <CompetencyRow key={c.key} c={c} />
          ))}
        </div>
      </div>

      {/* 领域覆盖热力 */}
      <div className="rounded-card border border-line bg-card p-6">
        <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
          领域覆盖热力
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {profile.domains.map((d) => (
            <DomainCell key={d.key} d={d} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          色深表示答题量，色调表示正确率；灰色 = 尚未答过。
        </p>
      </div>

      {/* 强项 / 弱项 / 推荐 */}
      {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profile.strengths.length > 0 && (
            <div className="rounded-card border border-line bg-card p-6">
              <p className="mb-3 text-[12px] font-medium text-sage-deep">强项</p>
              <ul className="space-y-2">
                {profile.strengths.map((s) => (
                  <li key={s.key} className="flex items-center justify-between text-[14px]">
                    <span className="text-ink">{s.name}</span>
                    <span className="font-medium text-sage-deep">{s.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile.weaknesses.length > 0 && (
            <div className="rounded-card border border-line bg-card p-6">
              <p className="mb-3 text-[12px] font-medium text-clay">薄弱环节</p>
              <ul className="space-y-2">
                {profile.weaknesses.map((w) => (
                  <li key={w.key} className="flex items-center justify-between text-[14px]">
                    <span className="text-ink">{w.name}</span>
                    <span className="font-medium text-clay">{w.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {profile.recommendations.length > 0 && (
        <div className="rounded-card border border-line bg-card p-6">
          <p className="mb-4 text-[12px] font-medium tracking-[0.14em] text-clay-deep">
            推荐你下一步
          </p>
          <div className="space-y-2">
            {profile.recommendations.map((r, i) => (
              <Link
                key={i}
                href={
                  r.kind === 'course'
                    ? `/app/training/courses/${r.id}`
                    : r.kind === 'quiz'
                    ? `/app/training/quizzes/${r.id}`
                    : `/app/training/practice`
                }
                className="flex items-center gap-3 rounded-card bg-paper px-4 py-3 transition-colors hover:bg-paper-deep"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-ink">{r.title}</p>
                  <p className="text-[12px] text-ink-faint">{r.reason}</p>
                </div>
                <span className="text-[13px] text-clay-deep">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompetencyRow({ c }: { c: CompetencyScore }) {
  const noData = c.question_total === 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] text-ink">
          {c.name}
          {c.is_critical && (
            <span className="rounded-full bg-clay-mist px-2 py-0.5 text-[10px] font-medium text-clay">
              关键项
            </span>
          )}
          {c.critical_failed && (
            <span className="text-[11px] text-clay">⚠ 关键题答错</span>
          )}
        </span>
        <span
          className={clsx(
            'text-[14px] font-medium',
            noData ? 'text-ink-faint' : 'text-clay-deep'
          )}
        >
          {noData ? '—' : c.score}
        </span>
      </div>
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
        <div
          className={clsx('h-full', c.critical_failed ? 'bg-clay' : 'bg-clay-deep')}
          style={{ width: `${noData ? 0 : c.score}%` }}
        />
      </div>
      <p className="text-[11px] text-ink-faint">
        {noData ? '尚未答过相关题目' : `答对 ${c.question_ok}/${c.question_total} 题`}
      </p>
    </div>
  );
}

function DomainCell({ d }: { d: DomainCoverage }) {
  const bg =
    d.answered === 0
      ? 'bg-paper-deep text-ink-faint'
      : d.accuracy >= 80
      ? 'bg-sage-deep text-paper'
      : d.accuracy >= 60
      ? 'bg-clay-deep text-paper'
      : 'bg-clay text-paper';
  return (
    <div className={clsx('rounded-card px-3 py-2', bg)}>
      <p className="text-[11px] font-medium">{d.key}</p>
      <p className="mt-0.5 truncate text-[12px] leading-tight">{d.name}</p>
      <p className="mt-0.5 text-[10px] opacity-80">
        {d.answered === 0
          ? `${d.total_available} 题待答`
          : `${d.answered} 题 · ${d.accuracy}%`}
      </p>
    </div>
  );
}

/** 六维雷达图 SVG（无依赖） */
function RadarChart({ items }: { items: CompetencyScore[] }) {
  const active = items.filter((i) => i.question_total > 0);
  if (active.length < 3) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-card border border-line bg-card px-6 text-center text-[13px] text-ink-faint">
        答完至少 3 个能力维度的题目
        <br />
        才能看到雷达图
      </div>
    );
  }
  const N = items.length;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 105;
  const angles = items.map((_, i) => (Math.PI * 2 * i) / N - Math.PI / 2);
  const gridLevels = [20, 40, 60, 80, 100];
  const gridPolys = gridLevels.map((lvl) =>
    angles
      .map((a) => {
        const r = (R * lvl) / 100;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(' ')
  );
  const dataPoly = angles
    .map((a, i) => {
      const r = (R * Math.max(0, Math.min(100, items[i].score))) / 100;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    })
    .join(' ');
  const labels = items.map((c, i) => {
    const a = angles[i];
    const lr = R + 26;
    return {
      x: cx + lr * Math.cos(a),
      y: cy + lr * Math.sin(a),
      text: c.name,
      score: c.score,
      hasData: c.question_total > 0,
      isCritical: c.is_critical,
      anchor: Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end',
    };
  });
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <svg viewBox={`0 0 ${size} ${size + 20}`} className="w-full">
        {gridPolys.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="#EAF0E8" strokeWidth={1} />
        ))}
        {angles.map((a, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + R * Math.cos(a)}
            y2={cy + R * Math.sin(a)}
            stroke="#EAF0E8"
            strokeWidth={1}
          />
        ))}
        <polygon
          points={dataPoly}
          fill="rgba(127, 169, 139, 0.28)"
          stroke="#5E8A6E"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        {angles.map((a, i) => {
          const r = (R * Math.max(0, Math.min(100, items[i].score))) / 100;
          return (
            <circle
              key={i}
              cx={cx + r * Math.cos(a)}
              cy={cy + r * Math.sin(a)}
              r={3}
              fill="#5E8A6E"
            />
          );
        })}
        {labels.map((l, i) => (
          <g key={i}>
            <text
              x={l.x}
              y={l.y - 5}
              textAnchor={l.anchor as any}
              className="fill-ink text-[11px]"
              style={{ fontSize: 11 }}
            >
              {l.text}
              {l.isCritical ? ' *' : ''}
            </text>
            <text
              x={l.x}
              y={l.y + 8}
              textAnchor={l.anchor as any}
              className={l.hasData ? 'fill-clay-deep' : 'fill-ink-faint'}
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {l.hasData ? l.score : '—'}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
