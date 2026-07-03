'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TemplateSelector } from '~/components/app/lesson-plan/TemplateSelector';
import {
  defaultSkeleton,
  type LessonPlanSkeleton,
  type LessonPlanSource,
} from '~/data/lesson-plan-types';
import { AttachIcon, CloseIcon, SparkleIcon } from '~/components/ui/icons';

const MAX_CHAT_LEN = 2000;
const MAX_KNOWLEDGE_LEN = 500;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_AIDS = 20;

type InputSource = 'attachment' | 'knowledge';

export function LessonPlanGenerator() {
  const router = useRouter();
  const [chatPrompt, setChatPrompt] = useState('');
  const [source, setSource] = useState<InputSource>('knowledge');
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [targetSkill, setTargetSkill] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [aidsText, setAidsText] = useState('');
  const [lessonMinutes, setLessonMinutes] = useState(30);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [templateSkeleton, setTemplateSkeleton] = useState<LessonPlanSkeleton | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAttachment = source === 'attachment' && files.length > 0;
  const hasKnowledge = source === 'knowledge' && knowledgePoint.trim().length > 0;
  const hasInputSource = hasAttachment || hasKnowledge;
  const canGenerate = hasInputSource && targetSkill.trim().length > 0 && !generating;

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
        setFileError(`「${f.name}」超过 20MB，没有添加。`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError('');

    const ownedAids = aidsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_AIDS);

    try {
      const res = await fetch('/api/lesson-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatPrompt,
          knowledgePoint: source === 'knowledge' ? knowledgePoint : '',
          hasMaterialAttachment: hasAttachment,
          targetSkill,
          phaseLabel: phaseLabel || undefined,
          ownedAids,
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
    } finally {
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
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-6 pb-[140px] pt-12 md:px-10">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-ink-faint transition-colors hover:text-ink"
      >
        ← 返回
      </button>
      <h1 className="font-serif text-[26px] font-normal text-ink">生成教案</h1>
      <p className="mt-2 text-sm leading-[1.9] text-ink-soft">
        先勾选参数，再在底部补充描述（可选），点「生成教案初稿」即可。
      </p>

      {error && (
        <div className="mt-6 rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">{error}</div>
      )}

      {/* 结构化参数 */}
      <div className="mt-8 rounded-section border border-line bg-card p-6">
        <p className="text-sm font-medium text-ink">结构化参数</p>

        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-soft">输入源（至少选一种）</p>
          <div className="flex gap-2">
            <SourceTab active={source === 'knowledge'} onClick={() => setSource('knowledge')}>
              指定知识点
            </SourceTab>
            <SourceTab active={source === 'attachment'} onClick={() => setSource('attachment')}>
              教材附件
            </SourceTab>
          </div>

          {source === 'knowledge' ? (
            <input
              value={knowledgePoint}
              onChange={(e) => setKnowledgePoint(e.target.value.slice(0, MAX_KNOWLEDGE_LEN))}
              maxLength={MAX_KNOWLEDGE_LEN}
              placeholder="例如：不完全相同物品的配对"
              className="mt-3 w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
          ) : (
            <div className="mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors duration-[450ms] ease-out hover:bg-paper-deep"
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
              {fileError && <p className="mt-2 text-xs text-clay">{fileError}</p>}
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 rounded-full bg-paper-deep px-3 py-1 text-xs text-ink-soft"
                    >
                      {f.name}
                      <button onClick={() => removeFile(i)} aria-label="移除文件">
                        <CloseIcon width={12} height={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="目标能力">
            <input
              value={targetSkill}
              onChange={(e) => setTargetSkill(e.target.value)}
              placeholder="如：配对 / 模仿 / 命名"
              className="w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
          </Field>
          <Field label="阶段（可选）">
            <input
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
              placeholder="如：3D&3D 不完全相同物品配对"
              className="w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
          </Field>
          <Field label="持有教具（可选，逗号分隔，最多 20 项）">
            <input
              value={aidsText}
              onChange={(e) => setAidsText(e.target.value)}
              placeholder="如：积木、卡片、小汽车"
              className="w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
            />
          </Field>
          <Field label={`预计时长：${lessonMinutes} 分钟`}>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={lessonMinutes}
              onChange={(e) => setLessonMinutes(Number(e.target.value))}
              className="w-full accent-sage"
            />
          </Field>
        </div>
      </div>

      {/* 对话描述（补充信息，可选） */}
      <div className="mt-6 rounded-section border border-line bg-card p-6">
        <p className="text-sm font-medium text-ink">补充描述（可选）</p>
        <p className="mt-1 text-xs text-ink-faint">
          有想补充的背景、孩子偏好或具体要求？在这里说说，AI 会一并参考。
        </p>
        <textarea
          value={chatPrompt}
          onChange={(e) => setChatPrompt(e.target.value.slice(0, MAX_CHAT_LEN))}
          maxLength={MAX_CHAT_LEN}
          rows={3}
          placeholder="例如：想给一个 4 岁自闭症孩子做配对训练，他喜欢小汽车…"
          className="mt-3 w-full resize-none rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-sage"
        />
        <p className="mt-1 text-right text-xs text-ink-faint">{chatPrompt.length}/{MAX_CHAT_LEN}</p>
      </div>

      {/* 或使用模板 */}
      <div className="mt-12 border-t border-line pt-8">
        <p className="text-sm font-medium text-ink">或者，从模板开始</p>
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
          className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors duration-[450ms] ease-out hover:bg-paper-deep disabled:opacity-40"
        >
          {templateSkeleton ? '使用所选模板新建' : '使用默认模板新建'}
        </button>
      </div>
        </div>
      </div>

      {/* 吸底生成栏 */}
      <div className="border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center gap-4 px-6 py-4 md:px-10">
          <div className="min-w-0 flex-1 text-xs text-ink-faint">
            {!hasInputSource
              ? '请先在上方选择一种输入源（教材附件或指定知识点）'
              : !targetSkill.trim()
              ? '还需要填写「目标能力」'
              : '准备就绪，可以生成初稿。'}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-sage px-6 py-3 text-sm font-medium text-paper transition-colors duration-[450ms] ease-out hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SparkleIcon width={16} height={16} />
            {generating ? '生成中…' : '生成教案初稿'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceTab({
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
        'rounded-full px-4 py-1.5 text-xs transition-colors duration-[450ms] ease-out',
        active ? 'bg-sage-mist text-sage-deep' : 'text-ink-faint hover:bg-paper-deep'
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-soft">{label}</p>
      {children}
    </div>
  );
}
