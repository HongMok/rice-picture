'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TemplateSelector } from '~/components/app/lesson-plan/TemplateSelector';
import {
  defaultSkeleton,
  type LessonPlanSkeleton,
} from '~/data/lesson-plan-types';
import { AttachIcon, CloseIcon, SparkleIcon } from '~/components/ui/icons';

const MAX_CHAT_LEN = 2000;
const MAX_KNOWLEDGE_LEN = 500;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_AIDS = 20;

type InputSource = 'attachment' | 'knowledge';

const SKILL_PRESETS = [
  '配对',
  '模仿',
  '命名',
  '分类',
  '匹配',
  '指认',
  '仿说',
  '其它',
] as const;

interface ChildRow {
  id: number;
  nickname: string;
  age: number | null;
}

export function LessonPlanGenerator() {
  const router = useRouter();

  // 参数
  const [childId, setChildId] = useState<number | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [targetSkill, setTargetSkill] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [source, setSource] = useState<InputSource>('knowledge');
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [aids, setAids] = useState<string[]>([]);
  const [aidDraft, setAidDraft] = useState('');
  const [lessonMinutes, setLessonMinutes] = useState(30);
  const [chatPrompt, setChatPrompt] = useState('');

  // 模板
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [templateSkeleton, setTemplateSkeleton] = useState<LessonPlanSkeleton | null>(null);

  // 状态
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载孩子列表
  useEffect(() => {
    fetch('/api/children')
      .then((r) => r.json())
      .then((d) => Array.isArray(d.children) && setChildren(d.children))
      .catch(() => {});
  }, []);

  const skillResolved = targetSkill === '其它' ? customSkill.trim() : targetSkill.trim();
  const hasAttachment = source === 'attachment' && files.length > 0;
  const hasKnowledge = source === 'knowledge' && knowledgePoint.trim().length > 0;
  const hasInputSource = hasAttachment || hasKnowledge;
  const canGenerate = !!skillResolved && hasInputSource && !generating;
  const disabledReason = !skillResolved
    ? '请先选择「目标能力」'
    : !hasInputSource
    ? source === 'knowledge'
      ? '请填写「知识点」'
      : '请上传「教材附件」'
    : '';

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError('');
    const incoming = Array.from(list);
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        setFileError('最多可上传 10 个文件。');
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`「${f.name}」超过 20MB，未添加。`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function commitAidDraft() {
    const parts = aidDraft
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...aids];
    for (const p of parts) {
      if (next.length >= MAX_AIDS) break;
      if (!next.includes(p)) next.push(p);
    }
    setAids(next);
    setAidDraft('');
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError('');

    // 把孩子背景 + 用户描述合并成最终 chatPrompt
    const child = children.find((c) => c.id === childId);
    const childHint = child
      ? `【孩子背景】${child.nickname}${child.age ? `，${child.age} 岁` : ''}。`
      : '';
    const finalChat = [childHint, chatPrompt.trim()].filter(Boolean).join('\n');

    try {
      const res = await fetch('/api/lesson-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatPrompt: finalChat,
          knowledgePoint: source === 'knowledge' ? knowledgePoint : '',
          hasMaterialAttachment: hasAttachment,
          targetSkill: skillResolved,
          phaseLabel: phaseLabel || undefined,
          ownedAids: aids,
          lessonMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');

      const createRes = await fetch('/api/lesson-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skeleton: data.skeleton, source: data.source }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || '保存失败');

      router.push(`/app/lesson-plan/${createData.plan.id}`);
    } catch (err: any) {
      setError(err?.message || '生成失败，请重试');
      setGenerating(false);
    }
  }

  async function handleUseTemplate() {
    const skeleton = templateSkeleton || defaultSkeleton('新教案');
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/lesson-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skeleton, source: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/app/lesson-plan/${data.plan.id}`);
    } catch (err: any) {
      setError(err?.message || '创建失败，请重试');
      setGenerating(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-6 pb-[160px] pt-10 md:px-10">
          {/* Header */}
          <button
            onClick={() => router.back()}
            className="mb-3 text-sm text-ink-faint transition-colors hover:text-ink"
          >
            ← 返回
          </button>
          <h1 className="font-serif text-[28px] font-normal leading-tight text-ink">生成教案</h1>
          <p className="mt-2 text-sm leading-[1.9] text-ink-soft">
            按顺序填几项参数，AI 会起草一份 DTT 教案初稿，你再逐字打磨。
          </p>

          {error && (
            <div className="mt-6 rounded-card border border-[#F4D3D3] bg-[#FBF1F1] px-4 py-3 text-sm text-[#C0524B]">
              {error}
            </div>
          )}

          {/* 1. 孩子（可选） */}
          <Step index={1} label="给谁的教案" optional>
            {children.length === 0 ? (
              <p className="text-xs text-ink-faint">
                还没添加过孩子。可以先跳过，稍后在个案里补齐。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <ChipButton active={childId === null} onClick={() => setChildId(null)}>
                  暂不指定
                </ChipButton>
                {children.map((c) => (
                  <ChipButton
                    key={c.id}
                    active={childId === c.id}
                    onClick={() => setChildId(c.id)}
                  >
                    {c.nickname}
                    {c.age ? ` · ${c.age}岁` : ''}
                  </ChipButton>
                ))}
              </div>
            )}
          </Step>

          {/* 2. 目标能力 */}
          <Step index={2} label="目标能力" required>
            <div className="flex flex-wrap gap-2">
              {SKILL_PRESETS.map((s) => (
                <ChipButton
                  key={s}
                  active={targetSkill === s}
                  onClick={() => setTargetSkill(s)}
                >
                  {s}
                </ChipButton>
              ))}
            </div>
            {targetSkill === '其它' && (
              <input
                autoFocus
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                placeholder="如：仿画、听指令"
                className="mt-3 w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
              />
            )}
          </Step>

          {/* 3. 输入源 */}
          <Step index={3} label="教学素材来源" required>
            <div className="flex gap-2">
              <ChipButton
                active={source === 'knowledge'}
                onClick={() => setSource('knowledge')}
              >
                指定知识点
              </ChipButton>
              <ChipButton
                active={source === 'attachment'}
                onClick={() => setSource('attachment')}
              >
                教材附件
              </ChipButton>
            </div>
            <div className="mt-3">
              {source === 'knowledge' ? (
                <input
                  value={knowledgePoint}
                  onChange={(e) => setKnowledgePoint(e.target.value.slice(0, MAX_KNOWLEDGE_LEN))}
                  placeholder="如：不完全相同物品的配对"
                  className="w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
                />
              ) : (
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:bg-paper-deep"
                  >
                    <AttachIcon width={15} height={15} />
                    上传 PDF 或图片
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    hidden
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  {fileError && <p className="mt-2 text-xs text-[#C0524B]">{fileError}</p>}
                  {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1.5 rounded-full bg-paper-deep px-3 py-1 text-xs text-ink-soft"
                        >
                          {f.name}
                          <button
                            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            aria-label="移除文件"
                          >
                            <CloseIcon width={12} height={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Step>

          {/* 4. 阶段 */}
          <Step index={4} label="阶段" optional>
            <input
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
              placeholder="如：3D&3D 不完全相同物品配对"
              className="w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
          </Step>

          {/* 5. 持有教具 */}
          <Step index={5} label="手头有的教具" optional>
            <div className="rounded-input border border-line bg-paper px-3 py-2 focus-within:border-sage">
              <div className="flex flex-wrap items-center gap-2">
                {aids.map((a, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full bg-sage-mist px-3 py-0.5 text-xs text-sage-deep"
                  >
                    {a}
                    <button
                      onClick={() => setAids((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="删除教具"
                    >
                      <CloseIcon width={11} height={11} />
                    </button>
                  </span>
                ))}
                <input
                  value={aidDraft}
                  onChange={(e) => setAidDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
                      e.preventDefault();
                      commitAidDraft();
                    } else if (e.key === 'Backspace' && !aidDraft && aids.length > 0) {
                      setAids((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={commitAidDraft}
                  placeholder={aids.length === 0 ? '如：积木、卡片、小汽车（回车分隔）' : ''}
                  className="min-w-[100px] flex-1 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              最多 {MAX_AIDS} 项。AI 会尝试用你手头的教具设计玩法。
            </p>
          </Step>

          {/* 6. 时长 */}
          <Step index={6} label="一节课时长" optional>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={lessonMinutes}
                onChange={(e) => setLessonMinutes(Number(e.target.value))}
                className="flex-1 accent-sage"
              />
              <span className="w-16 text-right text-sm font-medium text-ink">
                {lessonMinutes} 分钟
              </span>
            </div>
          </Step>

          {/* 7. 补充描述 */}
          <Step index={7} label="补充说明" optional>
            <textarea
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value.slice(0, MAX_CHAT_LEN))}
              rows={3}
              placeholder="有想补充的背景、孩子偏好或具体要求？在这里说说，AI 会一并参考。"
              className="w-full resize-none rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
            <p className="mt-1 text-right text-[11px] text-ink-faint">
              {chatPrompt.length} / {MAX_CHAT_LEN}
            </p>
          </Step>

          {/* 模板 */}
          <div className="mt-12 border-t border-line pt-8">
            <p className="text-sm font-medium text-ink">或者，从模板开始</p>
            <p className="mt-1 text-xs text-ink-faint">选一个内置或已保存的模板，一键新建。</p>
            <div className="mt-4">
              <TemplateSelector
                selectedKey={templateKey}
                onSelect={(key, skeleton) => {
                  setTemplateKey(key);
                  setTemplateSkeleton(skeleton);
                }}
              />
            </div>
            <button
              onClick={handleUseTemplate}
              disabled={generating}
              className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-40"
            >
              {templateSkeleton ? '使用所选模板新建' : '使用默认模板新建'}
            </button>
          </div>
        </div>
      </div>

      {/* 吸底 CTA */}
      <div className="border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center gap-4 px-6 py-4 md:px-10">
          <div className="min-w-0 flex-1 text-xs text-ink-faint">
            {disabledReason || '参数就位，AI 大约 30 秒起草完成。'}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-sage px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SparkleIcon width={16} height={16} />
            {generating ? '起草中…' : '生成教案初稿'}
          </button>
        </div>
      </div>

      {/* 生成中蒙层 */}
      {generating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-paper/70 backdrop-blur-sm">
          <div className="rounded-section bg-card px-10 py-8 text-center shadow-xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sage border-t-transparent" />
            <p className="mt-4 font-serif text-[17px] text-ink">AI 正在起草教案</p>
            <p className="mt-1 text-xs text-ink-faint">
              大约 30 秒完成，请稍候…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  index,
  label,
  required,
  optional,
  children,
}: {
  index: number;
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-ink text-[11.5px] font-semibold text-paper">
          {index}
        </span>
        <h2 className="text-[14.5px] font-medium text-ink">{label}</h2>
        {required && <span className="text-[11px] text-[#C0524B]">* 必填</span>}
        {optional && <span className="text-[11px] text-ink-faint">选填</span>}
      </div>
      <div className="pl-[32px]">{children}</div>
    </section>
  );
}

function ChipButton({
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
        'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
        active
          ? 'border-sage-deep bg-sage-deep text-paper'
          : 'border-line bg-card text-ink-soft hover:border-sage hover:bg-paper-deep'
      )}
    >
      {children}
    </button>
  );
}
