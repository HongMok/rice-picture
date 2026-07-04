'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { LessonPlanTOC } from '~/components/app/lesson-plan/LessonPlanTOC';
import { GoalImage } from '~/components/app/lesson-plan/GoalImage';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY = 800; // ms

export function LessonPlanPoster({ initialPlan }: { initialPlan: LessonPlan }) {
  const router = useRouter();
  const [plan, setPlan] = useState<LessonPlan>(initialPlan);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [validationError, setValidationError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<
    | null
    | { kind: 'phase'; phaseId: string }
    | { kind: 'sto'; phaseId: string; stoId: string }
  >(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  const scrollRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(true); // 挂载首次 render 不触发

  const phases = plan.goalHierarchy.lto.phases;
  const currentPhaseIdx = phases.length > 0 ? phases.length - 1 : -1;
  const currentPhase = currentPhaseIdx >= 0 ? phases[currentPhaseIdx] : null;

  // 找"最靠前的、非 mastered"作为当前 STO；若都 mastered 则显示最后一个
  const currentSto = useMemo(() => {
    if (!currentPhase) return null;
    return (
      currentPhase.stos.find((s) => s.status !== 'mastered') ||
      currentPhase.stos[currentPhase.stos.length - 1] ||
      null
    );
  }, [currentPhase]);

  const lessonMinutes = plan.duration?.lessonMinutes;
  const trialWindow = plan.duration?.trialWindowSec ?? plan.abcProcedure.behavior.responseWindowSec;

  // 每当 plan 变更 → 防抖自动保存
  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    dirtyRef.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save({ silent: true });
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  function patch(mutator: (p: LessonPlan) => LessonPlan) {
    setPlan((prev) => mutator(structuredClone(prev)));
  }

  async function save({ silent }: { silent?: boolean } = {}) {
    const emptySto = phases.flatMap((ph) => ph.stos).find((s) => !s.description.trim());
    if (emptySto) {
      setValidationError('有短期目标（STO）还没填写行为描述。');
      if (!silent) return;
      // silent 场景（自动保存）依然阻止，等用户补完再触发
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
      // 合并回传的 updatedAt 等；避免打断编辑，保留本地字段引用相同
      skipNextAutosave.current = true;
      setPlan((prev) => ({ ...prev, updatedAt: data.plan?.updatedAt || prev.updatedAt }));
      dirtyRef.current = false;
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800);
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
  function setStoStatus(phaseId: string, stoId: string, status: ShortTermObjective['status']) {
    patch((p) => {
      const phase = p.goalHierarchy.lto.phases.find((ph) => ph.id === phaseId);
      const sto = phase?.stos.find((s) => s.id === stoId);
      if (!sto) return p;
      sto.status = status;
      const today = new Date().toISOString().slice(0, 10);
      if (status === 'in-progress' && !sto.startDate) sto.startDate = today;
      if (status === 'mastered' && !sto.passDate) sto.passDate = today;
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

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-line bg-paper/95 px-6 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-input border border-line bg-card text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="返回"
        >
          ←
        </button>
        <input
          value={plan.title}
          onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
          placeholder="教案标题"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint"
        />
        <SaveIndicator state={saveState} error={validationError} />
        <button
          onClick={() => save()}
          disabled={saveState === 'saving'}
          className="rounded-full bg-sage px-4 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-sage-deep disabled:opacity-40"
        >
          {saveState === 'saving' ? '保存中…' : '保存'}
        </button>
      </div>

      {/* 主区：左目录 + 右内容 */}
      <div className="flex min-h-0 flex-1">
        <LessonPlanTOC
          scrollRoot={scrollRef}
          footer={
            <div className="space-y-1.5 text-[11.5px] text-ink-soft">
              <MetaRow label="情景" value={plan.teachingSetup.scenario || '—'} />
              <MetaRow label="时长" value={lessonMinutes ? `${lessonMinutes} 分钟` : '—'} />
              <MetaRow label="通过标准" value={plan.goalHierarchy.lto.mastery.raw} />
            </div>
          }
        />

        <main
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto max-w-[820px] px-6 pb-24 pt-6 md:px-10">
            {/* 当前小目标 sticky 卡 */}
            {currentSto && (
              <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b border-line bg-paper/95 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 rounded-full bg-[#FBEFDA] px-2.5 py-0.5 text-[11px] font-medium text-[#B47A2B]">
                    今天上这个
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {currentSto.description || '（未填写）'}
                  </p>
                  <button
                    disabled
                    className="flex-shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-faint disabled:cursor-not-allowed"
                    title="进入上课模式记录数据（即将开放）"
                  >
                    去上课 ▷
                  </button>
                </div>
              </div>
            )}

            {/* ① 概览 */}
            <Section id="sec-overview" num="①" title="概览">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiCard
                  label={
                    <>
                      通过标准
                      <InfoTip text='孩子做到多少次算“学会了”。例：“80%×3, 90%×2” = 连续 3 节课正确率≥80%，再有 2 节课≥90%，才判定掌握。' />
                    </>
                  }
                >
                  <input
                    value={plan.goalHierarchy.lto.mastery.raw}
                    onChange={(e) =>
                      patch((p) => {
                        p.goalHierarchy.lto.mastery.raw = e.target.value;
                        return p;
                      })
                    }
                    className="w-full bg-transparent text-[17px] font-semibold text-ink outline-none"
                  />
                </KpiCard>
                <KpiCard
                  label={
                    <>
                      当前目标
                      <InfoTip text="这节课要练的具体小目标。孩子做到通过标准后自动进入下一阶段。" />
                    </>
                  }
                >
                  <p className="truncate text-[15px] font-medium text-ink" title={currentSto?.description || ''}>
                    {currentSto?.description || '尚未添加'}
                  </p>
                </KpiCard>
                <KpiCard
                  label={
                    <>
                      作答时限
                      <InfoTip text="发出指令后，孩子有多少秒作答。超过就算“无反应”，进入纠正程序。常见值 3-5 秒。" />
                    </>
                  }
                >
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
                      className="w-12 bg-transparent text-[17px] font-semibold text-ink outline-none"
                    />
                    <span className="text-xs text-ink-soft">秒</span>
                  </div>
                </KpiCard>
              </div>
              {plan.source && (
                <div className="mt-3 flex items-center gap-2 text-[11.5px] text-ink-faint">
                  <span className="rounded-full bg-paper-deep px-2 py-0.5">来源</span>
                  <span className="truncate">{plan.source.ref}</span>
                </div>
              )}
            </Section>

            {/* ② 目标体系 */}
            <Section
              id="sec-goals"
              num="②"
              title={
                <>
                  目标
                  <InfoTip text='教案的目标分两层：长期目标（孩子最终要学会的样子）和进阶（把长期目标切成一小步一小步）。' />
                </>
              }
              action={
                <button
                  onClick={addPhase}
                  className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-paper-deep"
                >
                  <PlusIcon width={12} height={12} />
                  新增进阶
                </button>
              }
            >
              <div className="rounded-card bg-paper-deep px-5 py-4">
                <p className="text-[11.5px] tracking-wide text-ink-faint">
                  长期目标
                  <InfoTip text='孩子学到最后要达到的样子。写法：谁 · 在什么情况下 · 做什么 · 到什么程度。例："孩子听到物品名，能从 4 个实物中指出，正确率 80%×3"。' />
                </p>
                <textarea
                  value={plan.goalHierarchy.lto.description}
                  onChange={(e) =>
                    patch((p) => {
                      p.goalHierarchy.lto.description = e.target.value;
                      return p;
                    })
                  }
                  placeholder="孩子最终要学会做什么。例：孩子听到物品名后，能从 4 个实物中准确指出，正确率 80%×3。"
                  rows={2}
                  className="mt-1.5 w-full resize-none bg-transparent text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                />
              </div>

              <div className="mt-3 space-y-3">
                {phases.map((phase, idx) => {
                  const current = idx === currentPhaseIdx;
                  return (
                    <div key={phase.id} className="rounded-card border border-line bg-card p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={clsx(
                            'flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                            current ? 'bg-[#E88C3D] text-white' : 'bg-paper-deep text-ink-soft'
                          )}
                        >
                          第 {phase.order} 步
                        </span>
                        <input
                          value={phase.label}
                          onChange={(e) => updatePhase(phase.id, 'label', e.target.value)}
                          placeholder="这一步要练什么，例：认物品配物品"
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
                              <StatusMenu
                                status={sto.status}
                                onChange={(s) => setStoStatus(phase.id, sto.id, s)}
                              />
                              <textarea
                                value={sto.description}
                                onChange={(e) => updateSTO(phase.id, sto.id, 'description', e.target.value)}
                                placeholder="今天要练的具体行为（必填）。例：老师说“杯子”，孩子在 3 秒内指出杯子。"
                                rows={1}
                                className="flex-1 resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                              />
                              <button
                                onClick={() => setConfirmDelete({ kind: 'sto', phaseId: phase.id, stoId: sto.id })}
                                className="flex-shrink-0 text-ink-faint transition-colors hover:text-clay"
                                aria-label="删除小目标"
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
                          + 新增小目标
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ③ 教学设置 */}
            <Section id="sec-setup" num="③" title="教学准备">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SetupCell
                  label={
                    <>
                      教具准备
                      <InfoTip text='同一个概念要准备 ≥ 4 种样子的物品，让孩子学到的是「概念」而不是「某一个物品」。例：教"杯子"就要准备纸杯/塑料杯/保温杯/玻璃杯 4 种。' />
                    </>
                  }
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
                      patch((p) => ({
                        ...p,
                        teachingSetup: { ...p.teachingSetup, materials: e.target.value },
                      }))
                    }
                    rows={2}
                    placeholder="如：铁碗、塑料碗、瓷碗、橡胶碗；纸杯、塑料杯、保温杯、玻璃杯。"
                    className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </SetupCell>

                <SetupCell
                  label={
                    <>
                      教学策略
                      <InfoTip text="怎么帮孩子完成动作、做错了怎么纠正。常见递减：全躯体辅助（手把手做）→ 部分辅助（拉一下手腕）→ 手势提示 → 独立完成。" />
                    </>
                  }
                >
                  <textarea
                    value={plan.teachingSetup.strategy}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        teachingSetup: { ...p.teachingSetup, strategy: e.target.value },
                      }))
                    }
                    rows={2}
                    placeholder="孩子完成不了怎么帮，做错了怎么纠。例：全躯体辅助 → 部分辅助 → 手势 → 独立。"
                    className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                </SetupCell>

                <SetupCell
                  label={
                    <>
                      奖励安排
                      <InfoTip text="孩子做对时用什么奖励、隔几次给一次。常见比率：1:1 每次都给；VR2 平均 2 次给一次（不固定）。" />
                    </>
                  }
                >
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
                    placeholder="孩子喜欢的奖励，例：口头表扬 + 小饼干；或代币贴纸。"
                    className="w-full bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                  />
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-soft">
                    <span className="inline-flex items-center text-ink-faint">
                      给的频率
                      <InfoTip text="1:1 = 每次做对都给；VR2 = 平均每 2 次给一次（不固定的次数，孩子不会依赖）；FR3 = 固定每 3 次给。" />
                    </span>
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
                      placeholder="1:1"
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
                      <span className="inline-flex items-center">
                        用代币
                        <InfoTip text="代币制：孩子先集贴纸/星星，凑够后换真正的奖励。适合能等待的孩子，比每次立即给零食更健康。" />
                      </span>
                    </label>
                  </div>
                </SetupCell>

                <SetupCell
                  label={
                    <>
                      教学场景
                      <InfoTip text="在哪里上课。机构（一对一训练室）、居家（家长辅助）、学校（融合环境）、户外（泛化到真实生活）。" />
                    </>
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    {plan.teachingSetup.scenarioOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() =>
                          patch((p) => ({
                            ...p,
                            teachingSetup: { ...p.teachingSetup, scenario: opt },
                          }))
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

            {/* ④ 教学程序 ABC */}
            <Section
              id="sec-abc"
              num="④"
              title={
                <>
                  一节课怎么上（A → B → C）
                  <InfoTip text='一节 DTT 课的三步循环：A 你摆什么东西+说什么 → B 孩子怎么反应 → C 你怎么回应。每回合都跑一遍这三步。' />
                </>
              }
            >
              <div id="sec-abc-a" className="scroll-mt-[100px]">
                <AbcStep
                  node="A"
                  title={
                    <>
                      A · 你摆什么 + 说什么
                      <InfoTip text='「前因」——上课前你要先摆好教具、说出指令，让孩子知道要做什么。' />
                    </>
                  }
                >
                  <PillField label="摆放教具">
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
                      placeholder="怎么把目标物和其它物品摆在孩子面前。例：把杯子、苹果、球、书 4 个实物摆成一排。"
                      className="w-full resize-none bg-transparent text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                    />
                  </PillField>
                  <PillField label="发出指令">
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
                      placeholder='一句话简短指令，例："指杯子"'
                      className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
                    />
                  </PillField>
                </AbcStep>
              </div>

              <div id="sec-abc-b" className="scroll-mt-[100px]">
                <AbcStep
                  node="B"
                  title={
                    <>
                      B · 孩子怎么反应（{trialWindow} 秒内）
                      <InfoTip text='「行为」——发指令后，孩子在作答时限内做出的动作。你要提前写清楚"什么算对、什么算错"。' />
                    </>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <BranchBox tone="pos" label="✓ 做对了">
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
                        placeholder='什么动作算做对。例：孩子在 3 秒内用手指准确指向"杯子"。'
                        className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </BranchBox>
                    <BranchBox tone="neg" label="✗ 做错 / 没反应">
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
                        placeholder="什么算错。例：孩子指了别的物品，或 3 秒内没有任何反应。"
                        className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </BranchBox>
                  </div>
                </AbcStep>
              </div>

              <div id="sec-abc-c" className="scroll-mt-[100px]">
                <AbcStep
                  node="C"
                  title={
                    <>
                      C · 你怎么回应
                      <InfoTip text='「后果」——根据孩子的反应，立即给出对应回应。做对给奖励让孩子记住，做错走纠正流程。' />
                    </>
                  }
                  last
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <BranchBox tone="pos" label="✓ 做对后">
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
                        placeholder='立即给奖励。例：夸一句"真棒！"+ 给一块小饼干。'
                        className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </BranchBox>
                    <BranchBox
                      tone="neg"
                      label={
                        <>
                          ✗ 做错后 · 纠正流程
                          <InfoTip text='「纠正程序」——按固定 4 步流程帮孩子做对：重取注意力 → 递物品 → 发同一条指令 → 用辅助让孩子做对。不是"批评"，是"再教一次"。' />
                        </>
                      }
                    >
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
                        placeholder="4 步：叫回注意力 → 把物品递到孩子面前 → 再发一次指令 → 手把手辅助完成。"
                        className="w-full resize-none bg-transparent text-[13px] leading-[1.75] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </BranchBox>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center justify-between rounded-input bg-paper-deep px-3.5 py-2.5 text-[12.5px] text-ink-soft">
                    <span className="inline-flex items-center">
                      <b className="font-medium text-ink">纠正后不给奖励</b>
                      <InfoTip text='ABA 铁律。做错走纠正流程后即使做对了也不给奖励——避免"故意做错换辅助"的坏习惯。做对得靠自己第一次做对。' />
                      <span className="ml-2 text-ink-faint">（默认开启）</span>
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
              </div>
            </Section>

            {/* ⑤ 目标清单 */}
            <Section
              id="sec-checklist"
              num="⑤"
              title={
                <>
                  教学项清单
                  <InfoTip text='把这节课要教的一个个具体物品列出来。每个物品可以配一张图卡（AI 生成），上课时给孩子看。' />
                </>
              }
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
                  还没有教学项，点右上「添加」新建一个。
                </p>
              ) : (
                <div className="overflow-hidden rounded-card border border-line bg-card">
                  <div className="grid grid-cols-[80px_1fr_120px_120px_32px] gap-3 border-b border-line bg-paper-deep px-4 py-2.5 text-[11.5px] text-ink-faint">
                    <span>图卡</span>
                    <span>教学项</span>
                    <span className="inline-flex items-center">
                      开始教<InfoTip text='第一次把这个教学项加入课堂的日期。' />
                    </span>
                    <span className="inline-flex items-center">
                      通过日期<InfoTip text='孩子达到通过标准的日期。' />
                    </span>
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
                        onImageChanged={(url, taskId) => {
                          patch((p) => {
                            const it = p.goalChecklist.find((g) => g.id === item.id);
                            if (!it) return p;
                            if (url === null) delete it.imageUrl;
                            else if (url) it.imageUrl = url;
                            if (taskId === null) delete it.imageTaskId;
                            else if (taskId) it.imageTaskId = taskId;
                            return p;
                          });
                        }}
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
        </main>
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

function SaveIndicator({ state, error }: { state: SaveState; error: string }) {
  if (error) return <span className="text-xs text-[#C0524B]">{error}</span>;
  if (state === 'saving') return <span className="text-xs text-ink-faint">保存中…</span>;
  if (state === 'saved') return <span className="text-xs text-sage-deep">已自动保存 ✓</span>;
  if (state === 'error') return <span className="text-xs text-[#C0524B]">保存失败，重试</span>;
  return null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ink-faint">{label}</span>
      <span className="min-w-0 truncate font-medium text-ink" title={value}>
        {value}
      </span>
    </div>
  );
}

function Section({
  id,
  num,
  title,
  action,
  children,
}: {
  id: string;
  num: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-9 scroll-mt-[100px]">
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

function KpiCard({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3">
      <p className="text-[11.5px] text-ink-faint">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SetupCell({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
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
  title: React.ReactNode;
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

function PillField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
  label: React.ReactNode;
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

/** 三态状态胶囊 + 弹出菜单切换 */
function StatusMenu({
  status,
  onChange,
}: {
  status: ShortTermObjective['status'];
  onChange: (s: ShortTermObjective['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const map: Record<ShortTermObjective['status'], { label: string; cls: string }> = {
    mastered: { label: '已达标', cls: 'bg-[#DFF0E3] text-[#16A34A]' },
    'in-progress': { label: '进行中', cls: 'bg-[#FBEFDA] text-[#B47A2B]' },
    'not-started': { label: '未开始', cls: 'bg-paper-deep text-ink-faint' },
  };

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'mt-[3px] rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-opacity',
          map[status].cls,
          'hover:opacity-80'
        )}
        title="点击切换状态"
      >
        {map[status].label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[92px] rounded-input border border-line bg-card py-1 shadow-lg">
          {(['not-started', 'in-progress', 'mastered'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
                s === status ? 'text-ink' : 'text-ink-soft hover:bg-paper-deep hover:text-ink'
              )}
            >
              <span className={clsx('h-2 w-2 flex-shrink-0 rounded-full', {
                'bg-[#16A34A]': s === 'mastered',
                'bg-[#E88C3D]': s === 'in-progress',
                'bg-ink-faint': s === 'not-started',
              })} />
              {map[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 术语提示：小白鼠标悬停就出解释；桌面浮层 + 移动端 title 兜底 */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1 inline-flex align-middle" title={text}>
      <span
        aria-hidden
        className="grid h-[14px] w-[14px] cursor-help place-items-center rounded-full border border-line bg-paper-deep text-[9.5px] font-medium leading-none text-ink-faint transition-colors group-hover/tip:border-sage group-hover/tip:text-sage-deep"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-max max-w-[240px] -translate-x-1/2 rounded-input bg-ink px-2.5 py-1.5 text-[11px] leading-[1.7] text-paper shadow-lg group-hover/tip:block"
      >
        {text}
      </span>
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
            className="rounded-full bg-danger px-4 py-2 text-xs font-medium text-white hover:bg-danger-deep"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
