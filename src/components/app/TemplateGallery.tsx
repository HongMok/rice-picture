'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { TOPICS, STYLES } from '~/data/taxonomy';
import { BookIcon, ImageIcon } from '~/components/ui/icons';
import { TemplateDetail } from '~/components/app/TemplateDetail';

export interface TemplateItem {
  id: number;
  kind: 'image' | 'book';
  topic: string;
  styleKey: string;
  title: string;
  subtitle: string | null;
  brief: string;
  options: Record<string, any> | null;
  coverUrl: string | null;
}

type Tab = 'type' | 'style';

export function TemplateGallery({
  kind,
  onPick,
}: {
  kind: 'image' | 'book';
  onPick: (t: TemplateItem) => void;
}) {
  const [tab, setTab] = useState<Tab>('type');
  const [topic, setTopic] = useState<string>('all');
  const [style, setStyle] = useState<string>('all');
  const [all, setAll] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<number | null>(null);

  // 按当前模式（图片/绘本）拉取对应模板
  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => setAll(d.templates || []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, [kind]);

  const filtered = useMemo(() => {
    return all.filter((t) => {
      if (tab === 'type' && topic !== 'all' && t.topic !== topic) return false;
      if (tab === 'style' && style !== 'all' && t.styleKey !== style) return false;
      return true;
    });
  }, [all, tab, topic, style]);

  return (
    <div className="mx-auto mt-8 w-full max-w-5xl rounded-section border border-line bg-white/60 p-4">
      {/* 标题 + 类型 / 风格 tab */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          {kind === 'book' ? '绘本模板' : '图片模板'}
        </p>
        <div className="flex items-center gap-1">
          <SegTab active={tab === 'type'} onClick={() => setTab('type')}>
            类型
          </SegTab>
          <SegTab active={tab === 'style'} onClick={() => setTab('style')}>
            风格
          </SegTab>
        </div>
      </div>

      {/* 二级 chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {tab === 'type' ? (
          <>
            <Chip active={topic === 'all'} onClick={() => setTopic('all')}>
              全部
            </Chip>
            {TOPICS.map((t) => (
              <Chip
                key={t.key}
                active={topic === t.key}
                onClick={() => setTopic(t.key)}
              >
                {t.name}
              </Chip>
            ))}
          </>
        ) : (
          <>
            <Chip active={style === 'all'} onClick={() => setStyle('all')}>
              全部
            </Chip>
            {STYLES.map((s) => (
              <Chip
                key={s.key}
                active={style === s.key}
                onClick={() => setStyle(s.key)}
              >
                {s.name}
              </Chip>
            ))}
          </>
        )}
      </div>

      {/* 卡片网格 */}
      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] animate-pulse rounded-card bg-paper"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            该分类下暂无模板
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group overflow-hidden rounded-card border border-line bg-white text-left transition-all duration-[450ms] hover:-translate-y-1 hover:border-clay/50"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper">
                  {t.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.coverUrl}
                      alt={t.title}
                      className="h-full w-full object-cover transition-transform duration-[450ms]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-faint">
                      {t.kind === 'book' ? <BookIcon /> : <ImageIcon />}
                    </div>
                  )}
                  {/* 类型角标 */}
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-ink-soft backdrop-blur">
                    {t.kind === 'book' ? (
                      <BookIcon width={11} height={11} />
                    ) : (
                      <ImageIcon width={11} height={11} />
                    )}
                    {t.kind === 'book' ? '绘本' : '图片'}
                  </span>
                  {/* 悬停遮罩：查看 / 做同款 */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/45 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setViewId(t.id)}
                      className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-[450ms]"
                    >
                      查看
                    </button>
                    <button
                      onClick={() => onPick(t)}
                      className="rounded-full bg-clay px-3 py-1.5 text-xs font-medium text-white transition-colors duration-[450ms]"
                    >
                      做同款
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onPick(t)}
                  className="block w-full px-2.5 py-2 text-left"
                >
                  <p className="truncate text-sm font-medium text-ink">
                    {t.title}
                  </p>
                  {t.subtitle && (
                    <p className="truncate text-xs text-ink-faint">
                      {t.subtitle}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewId !== null && (
        <TemplateDetail
          id={viewId}
          onClose={() => setViewId(null)}
          onUse={(t) => {
            setViewId(null);
            onPick(t);
          }}
        />
      )}
    </div>
  );
}

function SegTab({
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
        'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'
      )}
    >
      {children}
    </button>
  );
}

function Chip({
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
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-clay bg-clay text-white'
          : 'border-line bg-white text-ink-soft hover:border-clay/40'
      )}
    >
      {children}
    </button>
  );
}
