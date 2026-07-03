'use client';

import { useState } from 'react';
import { Button, Input, FieldLabel } from '~/components/ui';
import { CheckIcon } from '~/components/ui/icons';
import {
  DIAGNOSES,
  SEVERITIES,
  ABILITY_TAGS,
  INTEREST_TAGS,
} from '~/data/game-types';

export interface Child {
  id: number;
  nickname: string;
  age: number | null;
  gender: string | null;
  diagnosis: string | null;
  severity: string | null;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
  total_points?: number;
}

interface ChildFormProps {
  initial?: Child;
  onCancel: () => void;
  onSaved: (c: Child, isEdit: boolean) => void;
  /** 保存按钮文案，默认「保存」/「保存修改」 */
  submitLabel?: { create?: string; edit?: string };
  /** 顶部主标题，默认「新建孩子个案」/「编辑「昵称」的个案」 */
  title?: { create?: string; edit?: (nickname: string) => string };
  /** 顶部副标题描述 */
  subtitle?: string;
  /** 兴趣偏好下方的提示，可传空字符串隐藏 */
  interestsHint?: string;
}

export function ChildForm({
  initial,
  onCancel,
  onSaved,
  submitLabel,
  title,
  subtitle,
  interestsHint,
}: ChildFormProps) {
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

  const headerTitle = isEdit
    ? title?.edit?.(initial!.nickname) ?? `编辑「${initial!.nickname}」的个案`
    : title?.create ?? '新建孩子个案';

  const headerSubtitle =
    subtitle ??
    '这些信息只用于定制出题：能力偏弱决定训练重点，兴趣（偏好物）决定题目主角与画面。';

  const hint =
    interestsHint ??
    '第一个偏好物会作为「演示角色」：如填「小猪佩奇」，情绪题就用小猪佩奇来表演各种表情。';

  const btnCreate = submitLabel?.create ?? '保存';
  const btnEdit = submitLabel?.edit ?? '保存修改';

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
    <div className="mx-auto max-w-2xl animate-fade-in rounded-section border border-line bg-white p-6">
      <h2 className="mb-1 text-xl text-ink">{headerTitle}</h2>
      <p className="mb-5 text-sm text-ink-faint">{headerSubtitle}</p>

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
                  'rounded-card border px-4 py-2 text-sm transition-colors duration-[450ms] ' +
                  (gender === v ? 'border-clay bg-clay-mist text-clay' : 'border-line text-ink-soft hover:border-clay')
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
          {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button className="gap-1.5" loading={saving} onClick={submit}>
          <CheckIcon />
          {isEdit ? btnEdit : btnCreate}
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
      className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors duration-[450ms] focus:border-clay"
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
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-[450ms] ' +
              (on
                ? 'border-clay bg-clay-mist text-clay'
                : 'border-line bg-white text-ink-soft hover:border-clay')
            }
          >
            {on && '✓ '}
            {t}
          </button>
        );
      })}
      {value
        .filter((t) => !options.includes(t))
        .map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            title="点击取消"
            className="rounded-full border border-clay bg-clay-mist px-3 py-1.5 text-xs font-medium text-clay"
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
            className="w-32 rounded-full border border-dashed border-line px-3 py-1.5 text-xs outline-none focus:border-clay"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="rounded-full bg-clay px-2.5 py-1.5 text-xs font-medium text-white transition-colors duration-[450ms] hover:bg-clay/90 disabled:opacity-40"
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
