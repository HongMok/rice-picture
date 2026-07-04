'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner, useToast, useConfirm } from '~/components/ui';
import {
  AttachIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  GameIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  VideoIcon,
} from '~/components/ui/icons';
import { ChildForm, type Child } from '~/components/app/ChildForm';

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'detail'; id: number }
  | { kind: 'edit'; child: Child };

const GAME_TYPE_LABEL: Record<string, string> = {
  emotion: '情绪认知',
  match: '配对训练',
  'catch-butterfly': '抓蝴蝶',
  'whack-a-mole': '打地鼠',
};

const VIDEO_STATUS_LABEL: Record<string, string> = {
  ANALYZING: '分析中',
  DONE: '已完成',
  FAILED: '分析失败',
};

const GAME_STATUS_LABEL: Record<string, string> = {
  BUILDING: '生成中',
  READY: '可玩',
  FAILED: '失败',
};

export function CasesManager() {
  const [children, setChildren] = useState<Child[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/children');
      if (r.ok) {
        const d = await r.json();
        setChildren(d.children || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  if (view.kind === 'new' || view.kind === 'edit') {
    const isEdit = view.kind === 'edit';
    return (
      <div className="h-full overflow-y-auto bg-paper">
        <FormShell
          title={isEdit ? '编辑个案' : '新建个案'}
          onBack={() =>
            isEdit
              ? setView({ kind: 'detail', id: view.child.id })
              : setView({ kind: 'list' })
          }
        >
          <ChildForm
            initial={isEdit ? view.child : undefined}
            onCancel={() =>
              isEdit
                ? setView({ kind: 'detail', id: view.child.id })
                : setView({ kind: 'list' })
            }
            onSaved={async (c) => {
              await loadChildren();
              setView({ kind: 'detail', id: c.id });
            }}
          />
        </FormShell>
      </div>
    );
  }

  if (view.kind === 'detail') {
    return (
      <CaseDetail
        childId={view.id}
        onBack={() => setView({ kind: 'list' })}
        onEdit={(c) => setView({ kind: 'edit', child: c })}
        onDeleted={async () => {
          await loadChildren();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[26px] font-normal leading-tight text-ink">
              个案管理
            </h1>
            <p className="mt-1.5 text-xs leading-[1.9] text-ink-faint">
              集中维护孩子的诊断、能力和兴趣。图卡 · 绘本 · 视频分析 · 定制出题 都从这里读取档案。
            </p>
          </div>
          <button
            onClick={() => setView({ kind: 'new' })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper transition-colors duration-[450ms] hover:bg-clay-deep"
          >
            <PlusIcon width={13} height={13} />
            新建个案
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-6 w-6 text-clay" />
          </div>
        ) : children.length === 0 ? (
          <EmptyState onCreate={() => setView({ kind: 'new' })} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {children.map((c) => (
              <ChildCard
                key={c.id}
                child={c}
                onOpen={() => setView({ kind: 'detail', id: c.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-section border border-dashed border-line bg-card px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-mist text-sage-deep">
        <UsersIcon width={22} height={22} />
      </span>
      <p className="mt-4 text-sm font-medium text-ink">还没有孩子个案</p>
      <p className="mt-1.5 max-w-xs text-xs leading-[1.9] text-ink-faint">
        填写诊断、偏弱方向和兴趣偏好，就能在图卡 / 绘本 / 游戏 / 视频分析里读取到它。
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper transition-colors duration-[450ms] hover:bg-clay-deep"
      >
        <PlusIcon width={13} height={13} />
        新建第一个
      </button>
    </div>
  );
}

function ChildCard({ child, onOpen }: { child: Child; onOpen: () => void }) {
  const gameCount = child.game_count ?? 0;
  const videoCount = child.video_count ?? 0;

  const focus = child.weaknesses.slice(0, 3);
  const interests = child.interests.slice(0, 3);

  const metaParts = [
    child.gender === 'boy' ? '男' : child.gender === 'girl' ? '女' : null,
    child.age ? `${child.age}岁` : null,
    child.diagnosis
      ? child.severity
        ? `${child.diagnosis} · ${child.severity}`
        : child.diagnosis
      : null,
  ].filter(Boolean);

  const hasTags = focus.length > 0 || interests.length > 0;

  return (
    <button
      onClick={onOpen}
      className="group flex flex-col rounded-section border border-line bg-card p-5 text-left transition-colors duration-[450ms] hover:border-clay"
    >
      {/* 顶部：头像 + 昵称 + 关键信息 */}
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-clay-mist text-lg font-medium text-clay-deep">
          {child.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{child.nickname}</p>
          {metaParts.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-ink-faint">
              {metaParts.join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* 中部：重点 / 偏好 chips（无内容时整块隐藏） */}
      {hasTags && (
        <div className="mt-4 space-y-1.5 text-xs">
          {focus.length > 0 && <TagRow label="重点" tags={focus} />}
          {interests.length > 0 && (
            <TagRow label="偏好" tags={interests} highlightFirst />
          )}
        </div>
      )}

      {/* 底部分隔 + KPI + → */}
      <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5 text-[11.5px] text-ink-soft">
        <div className="flex items-center gap-4">
          <CountTile icon={<GameIcon width={13} height={13} />} value={gameCount} label="游戏" />
          <CountTile icon={<VideoIcon width={13} height={13} />} value={videoCount} label="分析" />
        </div>
        <span className="text-ink-faint transition-transform duration-[450ms] group-hover:translate-x-0.5 group-hover:text-clay">
          <ChevronRightIcon width={14} height={14} />
        </span>
      </div>
    </button>
  );
}

function TagRow({
  label,
  tags,
  highlightFirst,
}: {
  label: string;
  tags: string[];
  highlightFirst?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-8 shrink-0 text-ink-faint">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {tags.map((t, i) => (
          <span
            key={t}
            className={
              'rounded-full px-2 py-0.5 text-[11px] ' +
              (highlightFirst && i === 0
                ? 'bg-clay-mist text-clay-deep'
                : 'bg-paper-deep text-ink-soft')
            }
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CountTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-faint">{icon}</span>
      <span className="font-medium text-ink">{value}</span>
      <span className="text-ink-faint">{label}</span>
    </span>
  );
}

function FormShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-faint transition-colors duration-[450ms] hover:text-clay"
      >
        <ChevronLeftIcon width={16} height={16} />
        返回
      </button>
      <div className="rounded-section border border-line bg-card px-6 py-7 md:px-8 md:py-9">
        <h1 className="mb-6 font-serif text-[22px] font-normal leading-tight text-ink">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

interface CaseDetailProps {
  childId: number;
  onBack: () => void;
  onEdit: (child: Child) => void;
  onDeleted: () => void;
}

interface VideoRef {
  id: number;
  title: string | null;
  status: string;
  created_at: string;
}
interface GameRef {
  id: number;
  game_type: string;
  title: string | null;
  status: string;
  score: number | null;
  stars: number | null;
  difficulty: string | null;
  created_at: string;
}

function CaseDetail({ childId, onBack, onEdit, onDeleted }: CaseDetailProps) {
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<Child | null>(null);
  const [videos, setVideos] = useState<VideoRef[]>([]);
  const [games, setGames] = useState<GameRef[]>([]);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/children/${childId}`);
      if (r.ok) {
        const d = await r.json();
        setChild(d.child);
        setVideos(d.videos || []);
        setGames(d.games || []);
      } else {
        setChild(null);
      }
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!child) return;
    const ok = await confirm({
      text: `删除「${child.nickname}」的个案？相关的游戏局和视频分析会保留，但会失去与该孩子的关联。`,
      confirmLabel: '确认删除',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/children/${child.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || '删除失败');
        return;
      }
      toast.success('已删除');
      onDeleted();
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-paper">
        <div className="flex justify-center py-24">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="h-full overflow-y-auto bg-paper">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-1 text-sm text-ink-faint transition-colors duration-[450ms] hover:text-clay"
          >
            <ChevronLeftIcon width={16} height={16} />
            返回列表
          </button>
          <p className="text-sm text-ink-faint">个案不存在或已被删除。</p>
        </div>
      </div>
    );
  }

  const gameCount = games.length;
  const videoCount = videos.length;

  return (
    <div className="h-full overflow-y-auto bg-paper">
      {/* 顶部操作条 */}
      <div className="sticky top-0 z-10 flex h-14 items-center border-b border-line bg-paper/95 px-6 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-ink-faint transition-colors duration-[450ms] hover:text-clay"
          >
            <ChevronLeftIcon width={16} height={16} />
            返回列表
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(child)}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-[450ms] hover:border-clay hover:text-clay"
            >
              <EditIcon width={13} height={13} />
              编辑
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-[450ms] hover:border-danger/40 hover:text-danger disabled:opacity-40"
              title="删除个案"
            >
              <TrashIcon width={13} height={13} />
              删除
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl animate-fade-in px-6 pb-16 pt-8">
        {/* 档案分区 */}
        <SectionLabel>档案</SectionLabel>
        <section className="mt-3 rounded-section border border-line bg-card p-6">
          {/* 头像 + 昵称 */}
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-clay-mist text-2xl font-medium text-clay-deep">
              {child.nickname.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl leading-tight text-ink">{child.nickname}</h2>
              <p className="mt-1 text-xs text-ink-faint">
                {[
                  child.age ? `${child.age}岁` : null,
                  child.gender === 'boy' ? '男孩' : child.gender === 'girl' ? '女孩' : null,
                  child.diagnosis
                    ? child.severity
                      ? `${child.diagnosis} · ${child.severity}`
                      : child.diagnosis
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '未填写基础信息'}
              </p>
            </div>
          </div>

          {/* KPI 条 */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <KpiTile value={child.total_points || 0} label="累计积分" />
            <KpiTile value={gameCount} label="游戏局数" />
          </div>

          {/* 详细字段 */}
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="能力较强">
              {child.strengths.length ? <TagList tags={child.strengths} /> : null}
            </InfoRow>
            <InfoRow label="重点训练">
              {child.weaknesses.length ? <TagList tags={child.weaknesses} /> : null}
            </InfoRow>
            <InfoRow label="兴趣偏好" span2>
              {child.interests.length ? (
                <TagList tags={child.interests} highlightFirst />
              ) : null}
            </InfoRow>
          </dl>

          {child.interests.length > 0 && (
            <p className="mt-4 flex items-baseline gap-1.5 text-[11.5px] text-ink-faint">
              <span className="inline-block h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-sage-deep" />
              首个偏好物「{child.interests[0]}」作为演示角色，用于图卡与题目主角。
            </p>
          )}
        </section>

        {/* 训练轨迹分区 */}
        <div className="mt-10">
          <SectionLabel>训练轨迹</SectionLabel>
          <div className="mt-3 space-y-3">
            <ResourceBlock
              icon={<VideoIcon width={16} height={16} />}
              title="视频分析"
              count={videoCount}
              emptyHint="尚未在视频分析里选择过该孩子"
            >
              {videos.map((v) => (
                <ResourceRow
                  key={v.id}
                  href={`/app/toolbox/video`}
                  title={v.title || '未命名分析'}
                  meta={[VIDEO_STATUS_LABEL[v.status] || v.status, formatDate(v.created_at)]}
                />
              ))}
            </ResourceBlock>

            <ResourceBlock
              icon={<GameIcon width={16} height={16} />}
              title="游戏记录"
              count={gameCount}
              emptyHint="该孩子还没有玩过定制游戏"
            >
              {games.map((g) => (
                <ResourceRow
                  key={g.id}
                  title={g.title || GAME_TYPE_LABEL[g.game_type] || g.game_type}
                  meta={[
                    GAME_TYPE_LABEL[g.game_type] || g.game_type,
                    g.score != null ? `${g.score} 分` : GAME_STATUS_LABEL[g.status] || g.status,
                    formatDate(g.created_at),
                  ]}
                />
              ))}
            </ResourceBlock>

            <ResourceBlock
              icon={<AttachIcon width={16} height={16} />}
              title="上传资料"
              count={0}
              emptyHint="即将开放：可上传评估报告、康复记录等资料"
              upcoming
            />
          </div>
        </div>
      </div>

    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[11.5px] uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </p>
  );
}

function KpiTile({
  value,
  label,
  hint,
}: {
  value: number | string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-paper/60 px-4 py-3">
      <p className="text-[20px] font-medium leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        {label}
        {hint && <span className="ml-1 text-ink-faint/80">· {hint}</span>}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1.5 text-sm text-ink">
        {children || <span className="text-ink-faint">未填写</span>}
      </dd>
    </div>
  );
}

function TagList({ tags, highlightFirst }: { tags: string[]; highlightFirst?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <span
          key={t}
          className={
            'rounded-full border px-2.5 py-1 text-xs ' +
            (highlightFirst && i === 0
              ? 'border-clay bg-clay-mist text-clay-deep'
              : 'border-line bg-paper-deep/50 text-ink-soft')
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ResourceBlock({
  icon,
  title,
  count,
  emptyHint,
  upcoming,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyHint: string;
  upcoming?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span className="text-clay-deep">{icon}</span>
          <span className="font-medium">{title}</span>
          {upcoming ? (
            <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] text-ink-faint">
              即将开放
            </span>
          ) : (
            <span className="text-xs text-ink-faint">{count}</span>
          )}
        </div>
      </div>
      {count === 0 ? (
        <p className="px-4 py-6 text-xs text-ink-faint">{emptyHint}</p>
      ) : (
        <div className="divide-y divide-line">{children}</div>
      )}
    </div>
  );
}

function ResourceRow({
  title,
  meta,
  href,
}: {
  title: string;
  meta: (string | null | undefined)[];
  href?: string;
}) {
  const inner = (
    <>
      <p className="min-w-0 flex-1 truncate text-sm text-ink">{title}</p>
      <p className="shrink-0 text-xs text-ink-faint">
        {meta.filter(Boolean).join(' · ')}
      </p>
    </>
  );
  const cls =
    'flex items-center gap-3 px-4 py-3 transition-colors duration-[450ms] hover:bg-paper-deep/60';
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
