'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { LessonPlanSkeleton } from '~/data/lesson-plan-types';
import { BUILTIN_TEMPLATES } from '~/data/lesson-plan-builtin-templates';
import { CheckIcon } from '~/components/ui/icons';

interface TemplateRow {
  id: number;
  name: string;
  skill: string | null;
  content: LessonPlanSkeleton;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; builtin: TemplateRow[]; mine: TemplateRow[] };

export function TemplateSelector({
  selectedKey,
  onSelect,
}: {
  selectedKey: string | null;
  onSelect: (key: string, skeleton: LessonPlanSkeleton) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/lesson-plan-templates');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setState({ kind: 'ready', builtin: data.builtin, mine: data.mine });
    } catch {
      setState({ kind: 'error' });
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-breathe rounded-card bg-paper-deep" />
        ))}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
        模板列表暂时加载不出来。
        <button onClick={load} className="ml-2 underline">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs text-ink-faint">内置模板</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {state.builtin.map((t) => {
            const builtinDef = BUILTIN_TEMPLATES.find((b) => b.name === t.name);
            return (
              <TemplateCard
                key={`builtin-${t.id}`}
                name={t.name}
                skill={t.skill || builtinDef?.skill}
                active={selectedKey === `builtin-${t.id}`}
                onClick={() => onSelect(`builtin-${t.id}`, t.content)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-ink-faint">我的模板</p>
        {state.mine.length === 0 ? (
          <p className="rounded-card bg-paper-deep px-4 py-3 text-sm text-ink-faint">
            还没有自定义模板，编辑教案后可以另存一个。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {state.mine.map((t) => (
              <TemplateCard
                key={`mine-${t.id}`}
                name={t.name}
                skill={t.skill}
                active={selectedKey === `mine-${t.id}`}
                onClick={() => onSelect(`mine-${t.id}`, t.content)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  name,
  skill,
  active,
  onClick,
}: {
  name: string;
  skill?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-between rounded-card border px-4 py-3 text-left transition-colors duration-[450ms] ease-out',
        active ? 'border-sage bg-sage-mist' : 'border-line bg-card hover:bg-paper-deep'
      )}
    >
      <div>
        <p className="text-sm text-ink">{name}</p>
        {skill && <p className="mt-0.5 text-xs text-ink-faint">{skill}</p>}
      </div>
      {active && <CheckIcon width={16} height={16} className="text-sage-deep" />}
    </button>
  );
}
