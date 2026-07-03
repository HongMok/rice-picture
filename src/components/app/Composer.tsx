'use client';

import { useUser } from '~/context/user-context';
import {
  STYLES,
  RATIOS,
  PAGE_COUNTS,
} from '~/data/taxonomy';
import { Button, Textarea } from '~/components/ui';
import {
  PagesIcon,
  RatioIcon,
  SparkleIcon,
  StyleIcon,
} from '~/components/ui/icons';

export type Mode = 'image' | 'book';

export interface ComposerState {
  mode: Mode;
  brief: string;
  styleKey: string;
  ratio: string;
  pageCount: number;
}

export function Composer({
  state,
  setState,
  generating,
  onGenerate,
}: {
  state: ComposerState;
  setState: (patch: Partial<ComposerState>) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  const user = useUser();
  const canSubmit = state.brief.trim().length >= 4 && !generating;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* 标题 */}
      <div className="mb-5 text-center">
        <h1 className="text-2xl tracking-tight text-ink">
          {user?.nickname || user?.username}
          ，今天想创作点{state.mode === 'image' ? '图卡' : '绘本'}？
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          {state.mode === 'image'
            ? '面向特需儿童康复的图卡生成'
            : '面向特需儿童康复的绘本生成'}
        </p>
      </div>

      {/* 输入卡片 */}
      <div className="rounded-section border border-line bg-white p-4">
        <Textarea
          rows={4}
          value={state.brief}
          maxLength={500}
          onChange={(e) => setState({ brief: e.target.value })}
          placeholder={
            state.mode === 'image'
              ? '描述你想要的图卡内容，例如：“小朋友在洗手台前认真洗手”'
              : '描述你想要的故事，例如：“小兔子学会和朋友轮流玩滑梯”，系统会扩写成完整绘本'
          }
          className="border-0 p-1 focus:border-0 focus:ring-0"
        />

        {/* 操作标签行 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {/* 风格 */}
          <TagSelect
            icon={<StyleIcon width={15} height={15} />}
            label="风格"
            value={state.styleKey}
            options={STYLES.map((s) => ({ value: s.key, label: s.name }))}
            onChange={(v) => setState({ styleKey: v })}
          />
          {/* 比例 */}
          <TagSelect
            icon={<RatioIcon width={15} height={15} />}
            label="比例"
            value={state.ratio}
            options={RATIOS.map((r) => ({ value: r.value, label: r.label }))}
            onChange={(v) => setState({ ratio: v })}
          />
          {/* 页数（仅绘本） */}
          {state.mode === 'book' && (
            <TagSelect
              icon={<PagesIcon width={15} height={15} />}
              label="页数"
              value={String(state.pageCount)}
              options={PAGE_COUNTS.map((n) => ({
                value: String(n),
                label: `${n} 页`,
              }))}
              onChange={(v) => setState({ pageCount: Number(v) })}
            />
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-faint">
              {state.brief.length}/500
            </span>
            <Button
              className="gap-1.5 px-5 py-2.5"
              loading={generating}
              disabled={!canSubmit}
              onClick={onGenerate}
            >
              <SparkleIcon width={16} height={16} />
              {generating ? '创作中' : '生成'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 轻量标签式下拉（原生 select 叠一层样式） */
function TagSelect({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value)?.label || '';
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-clay/50">
      <span className="text-ink-faint">{icon}</span>
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium text-ink">{current}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
