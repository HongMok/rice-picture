'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, FieldLabel, Spinner } from '~/components/ui';
import { SparkleIcon, PlusIcon, CheckIcon } from '~/components/ui/icons';
import { GamePlayer, unlockTts } from '~/components/app/GamePlayer';
import {
  DIAGNOSES,
  SEVERITIES,
  ABILITY_TAGS,
  INTEREST_TAGS,
  GAME_META,
  type GameType,
  type GameData,
} from '~/data/game-types';

interface Child {
  id: number;
  nickname: string;
  age: number | null;
  gender: string | null;
  diagnosis: string | null;
  severity: string | null;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
}

type View =
  | { kind: 'list' }
  | { kind: 'new-child' }
  | { kind: 'edit-child'; child: Child }
  | { kind: 'compose'; child: Child | null }
  | { kind: 'building'; label: string }
  | { kind: 'play'; game: GameData };

export function GameStudio() {
  const [children, setChildren] = useState<Child[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    const r = await fetch('/api/children');
    if (r.ok) {
      const d = await r.json();
      setChildren(d.children || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  if (view.kind === 'play') {
    return (
      <GamePlayer game={view.game} onExit={() => setView({ kind: 'list' })} />
    );
  }

  if (view.kind === 'building') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-cream-line bg-white p-10 text-center shadow-soft">
        <Spinner className="h-8 w-8 text-clay" />
        <p className="mt-3 text-sm text-ink-soft">{view.label}</p>
        <p className="mt-1 text-xs text-ink-muted">
          正在按孩子的情况定制题目、准备图片，首次可能需要 20～60 秒
        </p>
      </div>
    );
  }

  if (view.kind === 'new-child') {
    return (
      <ChildForm
        onCancel={() => setView({ kind: 'list' })}
        onSaved={async (c) => {
          await loadChildren();
          setView({ kind: 'compose', child: c });
        }}
      />
    );
  }

  if (view.kind === 'edit-child') {
    return (
      <ChildForm
        initial={view.child}
        onCancel={() => setView({ kind: 'list' })}
        onSaved={async () => {
          await loadChildren();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'compose') {
    return (
      <GameComposer
        child={view.child}
        onBack={() => setView({ kind: 'list' })}
        onBuild={async (gameType) => {
          setView({ kind: 'building', label: '正在出题…' });
          try {
            const res = await fetch('/api/games', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                childId: view.child?.id,
                gameType,
              }),
            });
            const d = await res.json();
            if (!res.ok) {
              alert(d.error || '出题失败');
              setView({ kind: 'compose', child: view.child });
              return;
            }
            // 拉取完整题目
            const gr = await fetch(`/api/games/${d.gameId}`);
            const gd = await gr.json();
            const g = gd.game;
            setView({
              kind: 'play',
              game: {
                id: g.id,
                gameType: g.game_type,
                title: g.title,
                status: g.status,
                rounds: g.rounds || [],
              },
            });
          } catch {
            alert('网络错误');
            setView({ kind: 'compose', child: view.child });
          }
        }}
      />
    );
  }

  // list
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">互动游戏</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            选一个孩子，按他的情况定制专属训练游戏
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setView({ kind: 'new-child' })}>
          <PlusIcon />
          新建个案
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-line bg-white/50 p-10 text-center">
          <p className="text-sm text-ink-muted">
            还没有孩子个案。
            <br />
            先「新建个案」，填写诊断和能力情况，就能定制出题啦。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setView({ kind: 'compose', child: null })}
            className="flex w-full items-center gap-3 rounded-2xl border border-cream-line bg-white p-4 text-left transition-colors hover:border-clay"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-xl">
              🎲
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">通用游戏（不指定孩子）</p>
              <p className="text-xs text-ink-muted">按轻度难度快速出一套题</p>
            </div>
          </button>
          {children.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-cream-line bg-white p-4 transition-colors hover:border-clay"
            >
              <button
                onClick={() => setView({ kind: 'compose', child: c })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-lg font-bold text-clay">
                  {c.nickname.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {c.nickname}
                    {c.age ? ` · ${c.age}岁` : ''}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {[
                      c.diagnosis,
                      c.weaknesses.length && `重点：${c.weaknesses.join('/')}`,
                      c.interests.length && `偏好物：${c.interests.join('/')}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '未填写详情'}
                  </p>
                </div>
              </button>
              <button
                onClick={() => setView({ kind: 'edit-child', child: c })}
                className="shrink-0 rounded-lg border border-cream-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-clay hover:text-clay"
                title="编辑个案"
              >
                编辑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 多选标签 ---------------- */
function TagPicker({
  options,
  value,
  onChange,
  allowCustom,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const on = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
              (on
                ? 'border-clay bg-clay-soft text-clay'
                : 'border-cream-line bg-white text-ink-soft hover:border-clay')
            }
          >
            {on && '✓ '}
            {t}
          </button>
        );
      })}
      {/* 已添加的自定义标签（不在预设里）：点击可取消 */}
      {value
        .filter((t) => !options.includes(t))
        .map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            title="点击取消"
            className="rounded-full border border-clay bg-clay-soft px-3 py-1.5 text-xs font-medium text-clay"
          >
            ✓ {t} ✕
          </button>
        ))}
      {allowCustom && (
        <span className="inline-flex items-center gap-1">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="输入后按+添加"
            className="w-32 rounded-full border border-dashed border-cream-line px-3 py-1.5 text-xs outline-none focus:border-clay"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="rounded-full bg-clay px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-clay/90 disabled:opacity-40"
            title="添加"
          >
            +
          </button>
        </span>
      )}
    </div>
  );

  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setCustom('');
  }
}

/* ---------------- 个案表单（新建 / 编辑共用） ---------------- */
function ChildForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Child;
  onCancel: () => void;
  onSaved: (c: Child, isEdit: boolean) => void;
}) {
  const isEdit = !!initial;
  const [nickname, setNickname] = useState(initial?.nickname || '');
  const [age, setAge] = useState(initial?.age ? String(initial.age) : '');
  const [gender, setGender] = useState(initial?.gender || '');
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis || '');
  const [severity, setSeverity] = useState(initial?.severity || '');
  const [strengths, setStrengths] = useState<string[]>(initial?.strengths || []);
  const [weaknesses, setWeaknesses] = useState<string[]>(initial?.weaknesses || []);
  const [interests, setInterests] = useState<string[]>(initial?.interests || []);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nickname.trim()) {
      alert('请填写孩子的称呼');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/children/${initial!.id}` : '/api/children',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname: nickname.trim(),
            age: age ? Number(age) : null,
            gender,
            diagnosis,
            severity,
            strengths,
            weaknesses,
            interests,
          }),
        }
      );
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || '保存失败');
        return;
      }
      onSaved(d.child, isEdit);
    } catch {
      alert('网络错误');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in rounded-2xl border border-cream-line bg-white p-6 shadow-soft">
      <h2 className="mb-1 text-xl font-bold text-ink">
        {isEdit ? `编辑「${initial!.nickname}」的个案` : '新建孩子个案'}
      </h2>
      <p className="mb-5 text-sm text-ink-muted">
        这些信息只用于定制出题：能力偏弱决定训练重点，兴趣（偏好物）决定题目主角与画面。
      </p>

      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>称呼 / 化名</FieldLabel>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="如：小宇" />
          </div>
          <div>
            <FieldLabel>年龄</FieldLabel>
            <Input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="如：6" inputMode="numeric" />
          </div>
        </div>

        <div>
          <FieldLabel>性别</FieldLabel>
          <div className="flex gap-2">
            {[
              ['boy', '男孩'],
              ['girl', '女孩'],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setGender(gender === v ? '' : v)}
                className={
                  'rounded-xl border px-4 py-2 text-sm transition-colors ' +
                  (gender === v ? 'border-clay bg-clay-soft text-clay' : 'border-cream-line text-ink-soft hover:border-clay')
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>诊断类型</FieldLabel>
            <Select value={diagnosis} onChange={setDiagnosis} options={DIAGNOSES} placeholder="请选择" />
          </div>
          <div>
            <FieldLabel>程度</FieldLabel>
            <Select value={severity} onChange={setSeverity} options={SEVERITIES} placeholder="请选择" />
          </div>
        </div>

        <div>
          <FieldLabel>能力较强（可多选）</FieldLabel>
          <TagPicker options={ABILITY_TAGS} value={strengths} onChange={setStrengths} />
        </div>
        <div>
          <FieldLabel>重点训练 / 偏弱方向（可多选）</FieldLabel>
          <TagPicker options={ABILITY_TAGS} value={weaknesses} onChange={setWeaknesses} />
        </div>
        <div>
          <FieldLabel>兴趣偏好 / 偏好物（可多选、可自定义）</FieldLabel>
          <TagPicker options={INTEREST_TAGS} value={interests} onChange={setInterests} allowCustom />
          <p className="mt-1.5 text-xs text-ink-muted">
            第一个偏好物会作为「演示角色」：如填「小猪佩奇」，情绪题就用小猪佩奇来表演各种表情。
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button className="gap-1.5" loading={saving} onClick={submit}>
          <CheckIcon />
          {isEdit ? '保存修改' : '保存并出题'}
        </Button>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-cream-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-clay"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/* ---------------- 游戏类型选择 ---------------- */
function GameComposer({
  child,
  onBack,
  onBuild,
}: {
  child: Child | null;
  onBack: () => void;
  onBuild: (gameType: GameType) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <button onClick={onBack} className="mb-4 text-sm text-ink-muted hover:text-ink">
        ← 返回
      </button>
      <h2 className="text-xl font-bold text-ink">
        {child ? `为「${child.nickname}」选一个游戏` : '选一个游戏'}
      </h2>
      {child && (child.weaknesses.length > 0 || child.interests.length > 0) && (
        <p className="mt-1 text-sm text-ink-muted">
          将按
          {child.weaknesses.length > 0 && `「${child.weaknesses.join('/')}」重点训练`}
          {child.interests.length > 0 && `，结合兴趣「${child.interests.join('/')}」`}
          出题
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {(Object.keys(GAME_META) as GameType[]).map((gt) => {
          const m = GAME_META[gt];
          return (
            <button
              key={gt}
              onClick={() => {
                unlockTts(); // 在真实手势栈内解锁 TTS，后续进题自动朗读才有声
                onBuild(gt);
              }}
              className="flex items-center gap-4 rounded-2xl border-2 border-cream-line bg-white p-4 text-left transition-all hover:border-clay active:scale-[.98]"
            >
              <span
                className={
                  'flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ' +
                  (gt === 'emotion' ? 'bg-clay-soft' : 'bg-sage-soft')
                }
              >
                {m.emoji}
              </span>
              <div className="flex-1">
                <p className="text-base font-bold text-ink">{m.name}</p>
                <p className="text-xs text-ink-muted">{m.subtitle}</p>
              </div>
              <SparkleIcon className="text-clay" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
