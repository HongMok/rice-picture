'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  emptyPhase,
  emptySTO,
  genLocalId,
  type GoalChecklistItem,
  type LessonPlan,
  type Phase,
  type ShortTermObjective,
} from '~/data/lesson-plan-types';
import { PlusIcon, CloseIcon } from '~/components/ui/icons';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function LessonPlanPoster({ initialPlan }: { initialPlan: LessonPlan }) {
  const router = useRouter();
  const [plan, setPlan] = useState<LessonPlan>(initialPlan);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmDelete, setConfirmDelete] = useState<
    | null
    | { kind: 'phase'; phaseId: string }
    | { kind: 'sto'; phaseId: string; stoId: string }
  >(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  const [validationError, setValidationError] = useState('');

  const phases = plan.goalHierarchy.lto.phases;
  const currentPhaseIdx = phases.length > 0 ? phases.length - 1 : -1;

  function patch(mutator: (p: LessonPlan) => LessonPlan) {
    setPlan((prev) => mutator(structuredClone(prev)));
  }

  async function save() {
    const emptySto = phases.flatMap((ph) => ph.stos).find((s) => !s.description.trim());
    if (emptySto) {
      setValidationError('有短期目标（STO）还没填写行为描述。');
      return;
    }
    setValidationError('');
    setSaveState('saving');
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: plan.type,
          title: plan.title,
          source: plan.source,
          duration: plan.duration,
          goalHierarchy: plan.goalHierarchy,
          teachingSetup: plan.teachingSetup,
          abcProcedure: plan.abcProcedure,
          goalChecklist: plan.goalChecklist,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setPlan(data.plan);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  }

  function addPhase() {
    patch((p) => {
      const order = p.goalHierarchy.lto.phases.length + 1;
      p.goalHierarchy.lto.phases.push(emptyPhase(order));
      return p;
    });
  }

  function updatePhase(phaseId: string, field: keyof Phase, value: any) {
    patch((p) => {
      const phase = p.goalHierarchy.lto.phases.find((ph) => ph.id === phaseId);
      if (phase) (phase as any)[field] = value;
      return p;
    });
  }

  function removePhase(phaseId: string) {
    patch((p) => {
      p.goalHierarchy.lto.phases = p.goalHierarchy.lto.phases.filter((ph) => ph.id !== phaseId);
      return p;
    });
    setConfirmDelete(null);
  }

  function addSTO(phaseId: string) {
    patch((p) => {
      const phase = p.goalHierarchy.lto.phases.find((ph) => ph.id === phaseId);
      phase?.stos.push(emptySTO());
      return p;
    });
  }

  function updateSTO(phaseId: string, stoId: string, field: keyof ShortTermObjective, value: any) {
    patch((p) => {
      const phase = p.goalHierarchy.lto.phases.find((ph) => ph.id === phaseId);
      const sto = phase?.stos.find((s) => s.id === stoId);
      if (sto) (sto as any)[field] = value;
      return p;
    });
  }

  function removeSTO(phaseId: string, stoId: string) {
    patch((p) => {
      const phase = p.goalHierarchy.lto.phases.find((ph) => ph.id === phaseId);
      if (phase) phase.stos = phase.stos.filter((s) => s.id !== stoId);
      return p;
    });
    setConfirmDelete(null);
  }

  function addGoalItem() {
    patch((p) => {
      p.goalChecklist.push({ id: genLocalId('goal'), name: '' });
      return p;
    });
  }

  function updateGoalItem(id: string, field: keyof GoalChecklistItem, value: any) {
    patch((p) => {
      const item = p.goalChecklist.find((g) => g.id === id);
      if (item) (item as any)[field] = value;
      return p;
    });
  }

  function removeGoalItem(id: string) {
    patch((p) => {
      p.goalChecklist = p.goalChecklist.filter((g) => g.id !== id);
      return p;
    });
  }

  async function saveAsTemplate() {
    setTemplateError('');
    const name = templateName.trim();
    if (name.length < 1 || name.length > 50) {
      setTemplateError('模板名称需为 1 到 50 个字符');
      return;
    }
    try {
      const res = await fetch('/api/lesson-plan-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          content: {
            type: plan.type,
            title: plan.title,
            duration: plan.duration,
            goalHierarchy: plan.goalHierarchy,
            teachingSetup: plan.teachingSetup,
            abcProcedure: plan.abcProcedure,
            goalChecklist: plan.goalChecklist,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setTemplateSaved(true);
      setTimeout(() => {
        setSaveAsOpen(false);
        setTemplateSaved(false);
        setTemplateName('');
      }, 1500);
    } catch (err: any) {
      setTemplateError(err?.message || '保存失败，请重试');
    }
  }

  const lessonMinutes = plan.duration?.lessonMinutes;
  const trialWindow = plan.duration?.trialWindowSec ?? plan.abcProcedure.behavior.responseWindowSec;

  return (
    <div className="relative flex h-full flex-col">
      {/* 可滚动海报 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[860px] px-6 pb-24 pt-8 md:px-10 md:pt-10">
          {/* 返回条 */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="text-sm text-ink-faint transition-colors hover:text-ink"
            >
              ← 返回
            </button>
            <span className="ml-auto flex items-center gap-2">
              {validationError && <span className="text-xs text-clay">{validationError}</span>}
              {saveState === 'error' && <span className="text-xs text-clay">保存失败</span>}
              {saveState === 'saved' && <span className="text-xs text-sage-deep">已保存 ✓</span>}
              <button
                onClick={() => setSaveAsOpen(true)}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-paper-deep"
              >
                另存为模板
              </button>
              <button
                onClick={save}
                disabled={saveState === 'saving'}
                className="rounded-full bg-sage px-4 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
              >
                {saveState === 'saving' ? '保存中…' : '保存'}
              </button>
            </span>
          </div>

          {/* Header：小 kicker + 大标题 + 副行 */}
          <p className="text-[12.5px] tracking-[1px] text-ink-faint">
            DTT 教案 · ABA 回合式教学
          </p>
          <input
            value={plan.title}
            onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
            placeholder="教案标题"
            className="mt-1.5 w-full bg-transparent font-serif text-[30px] font-normal leading-tight text-ink outline-none placeholder:text-ink-faint"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13.5px] text-ink-soft">
            <span>
              <span className="text-ink-faint">情景 </span>
              <b className="font-medium text-ink">
                {plan.teachingSetup.scenario || '—'}
              </b>
            </span>
            <span>
              <span className="text-ink-faint">范式 </span>
              <b className="font-medium text-ink">ABA–DTT</b>
            </span>
            <span>
              <span className="text-ink-faint">预计时长 </span>
              <b className="font-medium text-ink">
                一节课 · {lessonMinutes || '—'} 分钟
              </b>
            </span>
          </div>

          {/* KPI 三卡 */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="通过标准">
              <input
                value={plan.goalHierarchy.lto.mastery.raw}
                onChange={(e) =>
                  patch((p) => {
                    p.goalHierarchy.lto.mastery.raw = e.target.value;
                    return p;
                  })
                }
                className="w-full bg-transparent text-[18px] font-semibold text-ink outline-none"
              />
            </KpiCard>
            <KpiCard label="当前阶段">
              <p className="truncate text-[18px] font-semibold text-ink">
                {phases[currentPhaseIdx]?.label || '尚未添加'}
              </p>
            </KpiCard>
            <KpiCard label="单回合时限">
              <div className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={trialWindow}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 3;
                    patch((p) => {
                      p.duration = { ...(p.duration || {}), trialWindowSec: v };
                      p.abcProcedure.behavior.responseWindowSec = v;
                      return p;
                    });
                  }}
                  className="w-14 bg-transparent text-[18px] font-semibold text-ink outline-none"
                />
                <span className="text-[13px] text-ink-soft">秒</span>
              </div>
            </KpiCard>
          </div>

          {/* ① 目标体系 */}
          <Section
            num="①"
            title="目标体系"
            action={
              <button
                onClick={addPhase}
                className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-paper-deep"
              >
                <PlusIcon width={12} height={12} />
                新增阶段
              </button>
            }
          >
            {/* LTO：浅灰底大卡 */}
            <div className="rounded-card bg-paper-deep px-5 py-4">
              <p className="text-[11.5px] tracking-wide text-ink-faint">长期目标 LTO</p>
              <textarea
                value={plan.goalHierarchy.lto.description}
                onChange={(e) =>
                  patch((p) => {
                    p.goalHierarchy.lto.description = e.target.value;
                    return p;
                  })
                }
                placeholder="终点行为，如：孩子能够独立进行至少 20 组不完全相同的物品和卡片的配对，正确率达到 80%×3、90%×2。"
                rows={2}
                className="mt-1.5 w-full resize-none bg-transparent text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
              />
            </div>

            {/* Phase 卡 */}
            <div className="mt-3 space-y-3">
              {phases.map((phase, idx) => {
                const current = idx === currentPhaseIdx;
                return (
                  <div
                    key={phase.id}
                    className="rounded-card border border-line bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                          current
                            ? 'bg-[#E88C3D] text-white'
                            : 'bg-paper-deep text-ink-soft'
                        )}
                      >
                        阶段 {phase.order}
                      </span>
                      <input
                        value={phase.label}
                        onChange={(e) => updatePhase(phase.id, 'label', e.target.value)}
                        placeholder="阶段名，如：3D&3D 物品配物品"
                        className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:text-ink-faint"
                      />
                      {current && <span className="flex-shrink-0 text-xs text-ink-faint">进行中</span>}
                      <button
                        onClick={() => setConfirmDelete({ kind: 'phase', phaseId: phase.id })}
                        className="flex-shrink-0 text-ink-faint transition-colors hover:text-clay"
                        aria-label="删除阶段"
                      >
                        <CloseIcon width={14} height={14} />
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {phase.stos.map((sto) => (
                        <div
                          key={sto.id}
                          className="rounded-input bg-paper-deep px-3.5 py-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <StatusPill status={sto.status} />
                            <textarea
                              value={sto.description}
                              onChange={(e) => updateSTO(phase.id, sto.id, 'description', e.target.value)}
                              placeholder="可测量行为描述（必填）"
                              rows={1}
                              className="flex-1 resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                            />
                            <button
                              onClick={() => setConfirmDelete({ kind: 'sto', phaseId: phase.id, stoId: sto.id })}
                              className="flex-shrink-0 text-ink-faint transition-colors hover:text-clay"
                              aria-label="删除 STO"
                            >
                              <CloseIcon width={12} height={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => addSTO(phase.id)}
                        className="text-xs text-sage-deep transition-colors hover:text-sage"
                      >
                        + 新增 STO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ② 教学设置 */}
          <Section num="②" title="教学设置">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SetupCell
                label="教学教材（多重范例，每范例 ≥ 4）"
                hint={(() => {
                  const count = plan.teachingSetup.materials
                    .split(/[、,,\n;；]/)
                    .map((s) => s.trim())
                    .filter(Boolean).length;
                  if (!count) return null;
                  const ok = count >= 4;
                  return (
                    <span className={ok ? 'text-sage-deep' : 'text-[#B47A2B]'}>
                      {count} 项 {ok ? '✓' : '（建议 ≥ 4）'}
                    </span>
                  );
                })()}
              >
                <textarea
                  value={plan.teachingSetup.materials}
                  onChange={(e) =>
                    patch((p) => ({ ...p, teachingSetup: { ...p.teachingSetup, materials: e.target.value } }))
                  }
                  rows={2}
                  placeholder="如：铁碗、塑料碗、瓷碗、橡胶碗；纸杯、塑料杯、保温杯、玻璃杯。"
                  className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                />
              </SetupCell>

              <SetupCell label="策略（提示层级 / 纠错）">
                <textarea
                  value={plan.teachingSetup.strategy}
                  onChange={(e) =>
                    patch((p) => ({ ...p, teachingSetup: { ...p.teachingSetup, strategy: e.target.value } }))
                  }
                  rows={2}
                  placeholder="如：全躯体辅助 → 部分辅助 → 手势 → 独立；错误即时纠正。"
                  className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                />
              </SetupCell>

              <SetupCell label="增强计划">
                <input
                  value={plan.teachingSetup.reinforcement.reinforcer}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      teachingSetup: {
                        ...p.teachingSetup,
                        reinforcement: { ...p.teachingSetup.reinforcement, reinforcer: e.target.value },
                      },
                    }))
                  }
                  placeholder="强化物，如：口头表扬 + 强化物"
                  className="w-full bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                />
                <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-soft">
                  <span className="text-ink-faint">比率</span>
                  <input
                    value={plan.teachingSetup.reinforcement.ratio}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        teachingSetup: {
                          ...p.teachingSetup,
                          reinforcement: { ...p.teachingSetup.reinforcement, ratio: e.target.value },
                        },
                      }))
                    }
                    placeholder="VR2 / 1:1"
                    className="w-20 rounded-input border border-line bg-paper px-2 py-1 text-xs text-ink outline-none focus:border-sage"
                  />
                  <label className="ml-auto flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={plan.teachingSetup.reinforcement.useToken}
                      onChange={(e) =>
                        patch((p) => ({
                          ...p,
                          teachingSetup: {
                            ...p.teachingSetup,
                            reinforcement: { ...p.teachingSetup.reinforcement, useToken: e.target.checked },
                          },
                        }))
                      }
                      className="accent-sage"
                    />
                    代币制
                  </label>
                </div>
              </SetupCell>

              <SetupCell label="情景">
                <div className="flex flex-wrap gap-2">
                  {plan.teachingSetup.scenarioOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() =>
                        patch((p) => ({ ...p, teachingSetup: { ...p.teachingSetup, scenario: opt } }))
                      }
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs transition-colors',
                        plan.teachingSetup.scenario === opt
                          ? 'bg-ink text-paper'
                          : 'bg-paper-deep text-ink-soft hover:bg-line'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </SetupCell>
            </div>
          </Section>

          {/* ③ 教学程序 ABC */}
          <Section num="③" title="教学程序（A → B → C）">
            <AbcStep node="A" title="前因 · 呈现刺激 + 指令">
              <PillField label="呈现刺激">
                <textarea
                  value={plan.abcProcedure.antecedent.presentation}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      abcProcedure: {
                        ...p.abcProcedure,
                        antecedent: { ...p.abcProcedure.antecedent, presentation: e.target.value },
                      },
                    }))
                  }
                  rows={2}
                  placeholder="如何呈现目标物 + 干扰物"
                  className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                />
              </PillField>
              <PillField label="指令">
                <input
                  value={plan.abcProcedure.antecedent.instruction}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      abcProcedure: {
                        ...p.abcProcedure,
                        antecedent: { ...p.abcProcedure.antecedent, instruction: e.target.value },
                      },
                    }))
                  }
                  placeholder='如："xxx 放一起"'
                  className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
                />
              </PillField>
            </AbcStep>

            <AbcStep node="B" title={`行为 · 孩子的反应（${trialWindow} 秒内）`}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BranchBox tone="pos" label="+ 正确">
                  <textarea
                    value={plan.abcProcedure.behavior.correct}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        abcProcedure: {
                          ...p.abcProcedure,
                          behavior: { ...p.abcProcedure.behavior, correct: e.target.value },
                        },
                      }))
                    }
                    rows={2}
                    placeholder="正确反应的描述"
                    className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </BranchBox>
                <BranchBox tone="neg" label="− 错误 / 无反应">
                  <textarea
                    value={plan.abcProcedure.behavior.incorrect}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        abcProcedure: {
                          ...p.abcProcedure,
                          behavior: { ...p.abcProcedure.behavior, incorrect: e.target.value },
                        },
                      }))
                    }
                    rows={2}
                    placeholder="错误 / 未回应的描述"
                    className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </BranchBox>
              </div>
            </AbcStep>

            <AbcStep node="C" title="后果" last>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BranchBox tone="pos" label="+ 后">
                  <textarea
                    value={plan.abcProcedure.consequence.onCorrect}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        abcProcedure: {
                          ...p.abcProcedure,
                          consequence: { ...p.abcProcedure.consequence, onCorrect: e.target.value },
                        },
                      }))
                    }
                    rows={2}
                    placeholder="如：1:1 口头表扬 + 强化物（VR2），或 1:1 给代币"
                    className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </BranchBox>
                <BranchBox tone="neg" label="− 后（纠正程序）">
                  <textarea
                    value={plan.abcProcedure.consequence.onIncorrect}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        abcProcedure: {
                          ...p.abcProcedure,
                          consequence: { ...p.abcProcedure.consequence, onIncorrect: e.target.value },
                        },
                      }))
                    }
                    rows={2}
                    placeholder="重取注意力 → 递物品 → 发指令 → 提示辅助完成"
                    className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </BranchBox>
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-input bg-paper-deep px-3.5 py-2.5 text-[12.5px] text-ink-soft">
                <span>
                  <b className="font-medium text-ink">纠正后不给反馈或强化物</b>
                  <span className="ml-2 text-ink-faint">（ABA 铁律，默认开启）</span>
                </span>
                <input
                  type="checkbox"
                  checked={plan.abcProcedure.consequence.noFeedbackAfterCorrection}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      abcProcedure: {
                        ...p.abcProcedure,
                        consequence: {
                          ...p.abcProcedure.consequence,
                          noFeedbackAfterCorrection: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="accent-sage"
                />
              </label>
            </AbcStep>
          </Section>

          {/* ④ 目标清单 */}
          <Section
            num="④"
            title="目标清单"
            action={
              <button
                onClick={addGoalItem}
                className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-paper-deep"
              >
                <PlusIcon width={12} height={12} />
                添加
              </button>
            }
          >
            {plan.goalChecklist.length === 0 ? (
              <p className="rounded-card border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-ink-faint">
                还没有目标项，慢慢添加也可以。
              </p>
            ) : (
              <div className="overflow-hidden rounded-card border border-line bg-card">
                <div className="grid grid-cols-[80px_1fr_120px_120px_32px] gap-3 border-b border-line bg-paper-deep px-4 py-2.5 text-[11.5px] text-ink-faint">
                  <span>图片</span>
                  <span>目标</span>
                  <span>介绍日期</span>
                  <span>掌握日期</span>
                  <span />
                </div>
                {plan.goalChecklist.map((item, i) => (
                  <div
                    key={item.id}
                    className={clsx(
                      'grid grid-cols-[80px_1fr_120px_120px_32px] items-center gap-3 px-4 py-3',
                      i > 0 && 'border-t border-line'
                    )}
                  >
                    <GoalImage
                      item={item}
                      planId={plan.id}
                      onImageUpdated={(url) => updateGoalItem(item.id, 'imageUrl', url)}
                    />
                    <input
                      value={item.name}
                      onChange={(e) => updateGoalItem(item.id, 'name', e.target.value)}
                      placeholder="目标名称"
                      className="min-w-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
                    />
                    <input
                      type="date"
                      value={item.introducedDate || ''}
                      onChange={(e) => updateGoalItem(item.id, 'introducedDate', e.target.value)}
                      className="rounded-input bg-paper-deep px-2 py-1 text-xs text-ink-soft outline-none focus:bg-paper"
                    />
                    <input
                      type="date"
                      value={item.masteredDate || ''}
                      onChange={(e) => updateGoalItem(item.id, 'masteredDate', e.target.value)}
                      className="rounded-input bg-paper-deep px-2 py-1 text-xs text-ink-soft outline-none focus:bg-paper"
                    />
                    <button
                      onClick={() => removeGoalItem(item.id)}
                      className="justify-self-end text-ink-faint transition-colors hover:text-clay"
                      aria-label="删除目标"
                    >
                      <CloseIcon width={13} height={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* 删除确认 */}
      {confirmDelete && (
        <ConfirmDialog
          text={
            confirmDelete.kind === 'phase'
              ? '删除这个阶段？其下的短期目标也会一并删除。'
              : '删除这个短期目标？'
          }
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            confirmDelete.kind === 'phase'
              ? removePhase(confirmDelete.phaseId)
              : removeSTO(confirmDelete.phaseId, confirmDelete.stoId)
          }
        />
      )}

      {/* 另存为模板 */}
      {saveAsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-6">
          <div className="w-full max-w-sm rounded-section bg-card p-6">
            <h3 className="font-serif text-lg font-normal text-ink">另存为我的模板</h3>
            {templateSaved ? (
              <p className="mt-4 text-sm text-sage-deep">保存成功。</p>
            ) : (
              <>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="模板名称（1-50 字符）"
                  className="mt-4 w-full rounded-input border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-sage"
                />
                {templateError && <p className="mt-2 text-xs text-clay">{templateError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setSaveAsOpen(false)}
                    className="rounded-full px-4 py-2 text-xs text-ink-soft hover:bg-paper-deep"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveAsTemplate}
                    className="rounded-full bg-sage px-4 py-2 text-xs font-medium text-paper hover:bg-sage-deep"
                  >
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3">
      <p className="text-[11.5px] text-ink-faint">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Section({
  num,
  title,
  action,
  children,
}: {
  num: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-paper">
          {num}
        </span>
        <h2 className="font-serif text-[17px] font-normal text-ink">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SetupCell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11.5px] text-ink-faint">{label}</p>
        {hint && <span className="text-[10.5px]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function AbcStep({
  node,
  title,
  last,
  children,
}: {
  node: string;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-input bg-ink text-[15px] font-semibold text-paper">
          {node}
        </div>
        {!last && <div className="mt-1 w-[2px] flex-1 bg-line" />}
      </div>
      <div className={clsx('min-w-0 flex-1 pt-1', last ? 'pb-0' : 'pb-6')}>
        <p className="text-[14px] font-medium text-ink">{title}</p>
        <div className="mt-2.5 space-y-2.5">{children}</div>
      </div>
    </div>
  );
}

function PillField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11.5px] text-ink-faint">{label}</p>
      <div className="rounded-input bg-paper-deep px-3 py-2">{children}</div>
    </div>
  );
}

function BranchBox({
  tone,
  label,
  children,
}: {
  tone: 'pos' | 'neg';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-input border px-3 py-2.5',
        tone === 'pos' ? 'border-[#CDEFDB] bg-[#F0F8F3]' : 'border-[#F4D3D3] bg-[#FBF1F1]'
      )}
    >
      <p
        className={clsx(
          'mb-1 text-[11.5px] font-medium',
          tone === 'pos' ? 'text-[#16A34A]' : 'text-[#C0524B]'
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: ShortTermObjective['status'] }) {
  const map = {
    mastered: { label: '已达标', cls: 'bg-[#DFF0E3] text-[#16A34A]' },
    'in-progress': { label: '进行中', cls: 'bg-[#FBEFDA] text-[#B47A2B]' },
    'not-started': { label: '未开始', cls: 'bg-paper-deep text-ink-faint' },
  } as const;
  const s = map[status];
  return (
    <span
      className={clsx(
        'mt-[3px] flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}

function ConfirmDialog({
  text,
  onCancel,
  onConfirm,
}: {
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-6">
      <div className="w-full max-w-sm rounded-section bg-card p-6">
        <p className="text-sm leading-[1.9] text-ink">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-full px-4 py-2 text-xs text-ink-soft hover:bg-paper-deep">
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full px-4 py-2 text-xs font-medium text-white hover:opacity-90"
            style={{ backgroundColor: '#C08585' }}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

/** 目标清单单个图片格：点击弹菜单（AI 生图 / 移除），生成中 shimmer */
function GoalImage({
  item,
  planId,
  onImageUpdated,
}: {
  item: GoalChecklistItem;
  planId: number;
  onImageUpdated: (url: string | undefined) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  async function runGenerate() {
    setMenuOpen(false);
    setError('');
    if (!item.name.trim()) {
      setError('请先填写目标名称');
      setTimeout(() => setError(''), 2500);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/lesson-plans/${planId}/goal-item-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) throw new Error(data.error || '生成失败');
      onImageUpdated(data.imageUrl);
    } catch (err: any) {
      setError(err?.message || '生成失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  }

  function removeImage() {
    setMenuOpen(false);
    onImageUpdated(undefined);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !loading && setMenuOpen((v) => !v)}
        disabled={loading}
        className={clsx(
          'group grid h-14 w-14 place-items-center overflow-hidden rounded-input border transition-colors',
          item.imageUrl
            ? 'border-line bg-card hover:border-sage'
            : 'border-dashed border-line bg-paper-deep hover:border-sage hover:bg-paper',
          loading && 'cursor-wait'
        )}
        aria-label={item.imageUrl ? '更换图片' : '添加图片'}
      >
        {loading ? (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-paper-deep via-line to-paper-deep" />
        ) : item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name || '目标图片'}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
          />
        ) : (
          <span className="text-[18px] leading-none text-ink-faint">＋</span>
        )}
      </button>
      {error && (
        <div className="absolute left-16 top-1 z-10 whitespace-nowrap rounded-input bg-clay px-2 py-1 text-[11px] text-white shadow">
          {error}
        </div>
      )}
      {menuOpen && !loading && (
        <div className="absolute left-16 top-0 z-20 min-w-[152px] rounded-input border border-line bg-card py-1.5 text-[13px] shadow-lg">
          <button
            onClick={runGenerate}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink transition-colors hover:bg-paper-deep"
          >
            <span className="text-sage-deep">✦</span>
            <span>{item.imageUrl ? 'AI 重新生成' : 'AI 生成图片'}</span>
          </button>
          {item.imageUrl && (
            <>
              <div className="my-1 h-px bg-line" />
              <button
                onClick={removeImage}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-paper-deep"
                style={{ color: '#C08585' }}
              >
                <span>🗑</span>
                <span>移除图片</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
