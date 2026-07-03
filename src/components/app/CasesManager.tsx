'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner } from '~/components/ui';
import {
  AttachIcon,
  ChevronLeftIcon,
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

  if (view.kind === 'new') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <ChildForm
            onCancel={() => setView({ kind: 'list' })}
            onSaved={async (c) => {
              await loadChildren();
              setView({ kind: 'detail', id: c.id });
            }}
          />
        </div>
      </div>
    );
  }

  if (view.kind === 'edit') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <ChildForm
            initial={view.child}
            onCancel={() => setView({ kind: 'detail', id: view.child.id })}
            onSaved={async (c) => {
              await loadChildren();
              setView({ kind: 'detail', id: c.id });
            }}
          />
        </div>
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[28px] font-normal leading-tight text-ink">个案管理</h1>
          <p className="mt-1.5 text-sm text-ink-faint">
            集中维护孩子的诊断、能力和兴趣。绘本、图卡、视频分析中选择孩子时，从这里读取。
          </p>
        </div>
        <Button className="shrink-0 gap-1.5" onClick={() => setView({ kind: 'new' })}>
          <PlusIcon />
          新建个案
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      ) : children.length === 0 ? (
        <div className="flex flex-col items-center rounded-section border border-dashed border-line bg-white/50 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-mist text-clay">
            <UsersIcon width={22} height={22} />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">还没有孩子个案</p>
          <p className="mt-1 max-w-xs text-xs leading-[1.9] text-ink-faint">
            点击右上角「新建个案」，填写诊断、偏弱方向和兴趣偏好，就能在各个模块里选到它。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-section border border-line bg-white p-4 transition-colors duration-[450ms] hover:border-clay"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-clay-mist text-lg font-medium text-clay">
                {c.nickname.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {c.nickname}
                  {c.age ? ` · ${c.age}岁` : ''}
                  {c.gender === 'boy' ? ' · 男' : c.gender === 'girl' ? ' · 女' : ''}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {[
                    c.diagnosis && (c.severity ? `${c.diagnosis} · ${c.severity}` : c.diagnosis),
                    c.weaknesses.length && `重点：${c.weaknesses.join('/')}`,
                    c.interests.length && `偏好：${c.interests.join('/')}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '未填写详情'}
                </p>
              </div>
              <button
                onClick={() => setView({ kind: 'detail', id: c.id })}
                className="shrink-0 rounded-input border border-line px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-[450ms] hover:border-clay hover:text-clay"
                title="查看个案"
              >
                查看
              </button>
            </div>
          ))}
        </div>
      )}
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setDeleting(true);
    try {
      const res = await fetch(`/api/children/${child.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || '删除失败');
        return;
      }
      setConfirmDelete(false);
      onDeleted();
    } catch {
      alert('网络错误');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex justify-center py-24">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="h-full overflow-y-auto">
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl animate-fade-in px-6 py-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-ink-faint transition-colors duration-[450ms] hover:text-clay"
        >
          <ChevronLeftIcon width={16} height={16} />
          返回列表
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(child)}
            className="rounded-input border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-[450ms] hover:border-clay hover:text-clay"
          >
            编辑
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 rounded-input border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-[450ms] hover:border-clay hover:text-clay"
            title="删除个案"
          >
            <TrashIcon width={14} height={14} />
            删除
          </button>
        </div>
      </div>

      <section className="rounded-section border border-line bg-white p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-clay-mist text-2xl font-medium text-clay">
            {child.nickname.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl leading-tight text-ink">{child.nickname}</h2>
            <p className="mt-1 text-xs text-ink-faint">
              {[
                child.age ? `${child.age}岁` : null,
                child.gender === 'boy' ? '男孩' : child.gender === 'girl' ? '女孩' : null,
                child.total_points ? `累计积分 ${child.total_points}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '未填写基础信息'}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="诊断">
            {child.diagnosis
              ? child.severity
                ? `${child.diagnosis} · ${child.severity}`
                : child.diagnosis
              : null}
          </InfoRow>
          <InfoRow label="能力较强">
            {child.strengths.length ? <TagList tags={child.strengths} /> : null}
          </InfoRow>
          <InfoRow label="重点训练">
            {child.weaknesses.length ? <TagList tags={child.weaknesses} /> : null}
          </InfoRow>
          <InfoRow label="兴趣偏好">
            {child.interests.length ? (
              <TagList tags={child.interests} highlightFirst />
            ) : null}
          </InfoRow>
        </dl>
        {child.interests.length > 0 && (
          <p className="mt-3 text-xs text-ink-faint">
            首个偏好物「{child.interests[0]}」作为演示角色，用于图卡与题目主角。
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-ink">资料</h3>

        <ResourceBlock
          icon={<VideoIcon width={16} height={16} />}
          title="视频分析"
          count={videos.length}
          emptyHint="尚未在视频分析里选择过该孩子"
        >
          {videos.map((v) => (
            <ResourceRow
              key={v.id}
              href={`/app/toolbox/video`}
              title={v.title || '未命名分析'}
              meta={[
                VIDEO_STATUS_LABEL[v.status] || v.status,
                formatDate(v.created_at),
              ]}
            />
          ))}
        </ResourceBlock>

        <ResourceBlock
          icon={<GameIcon width={16} height={16} />}
          title="游戏记录"
          count={games.length}
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
      </section>

      {confirmDelete && (
        <ConfirmDialog
          text={`删除「${child.nickname}」的个案？相关的游戏局和视频分析会保留，但会失去与该孩子的关联。`}
          confirmLabel="确认删除"
          loading={deleting}
          onCancel={() => (deleting ? undefined : setConfirmDelete(false))}
          onConfirm={handleDelete}
        />
      )}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 text-sm text-ink">
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
              ? 'border-clay bg-clay-mist text-clay'
              : 'border-line bg-paper-deep/40 text-ink-soft')
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
    <div className="mb-4 rounded-section border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span className="text-clay">{icon}</span>
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
        <p className="px-4 py-5 text-xs text-ink-faint">{emptyHint}</p>
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
    'flex items-center gap-3 px-4 py-3 transition-colors duration-[450ms] hover:bg-paper-deep/40';
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

function ConfirmDialog({
  text,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  text: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-6">
      <div className="w-full max-w-sm rounded-section bg-card p-6">
        <p className="text-sm leading-[1.9] text-ink">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-full px-4 py-2 text-xs text-ink-soft hover:bg-paper-deep disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#C08585' }}
          >
            {loading && <Spinner className="h-3 w-3" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
