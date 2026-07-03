'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button, Input, FieldLabel, Spinner } from '~/components/ui';
import { SparkleIcon, DownloadIcon, PlusIcon, AttachIcon } from '~/components/ui/icons';
import {
  type VideoAnalysis,
  type VideoReport,
  type TimelineSeg,
  type DimensionScore,
  type TeacherDimension,
  type TeacherSegment,
  type DttStats,
  type AbcEvent,
  type HistoryPoint,
} from '~/data/video-types';
import { exportReportPdf } from '~/libs/report-pdf';
import { uploadVideoToOss } from '~/libs/oss-upload';

interface Child {
  id: number;
  nickname: string;
  age: number | null;
  diagnosis: string | null;
  weaknesses: string[];
  interests: string[];
}

type View =
  | { kind: 'list' }
  | { kind: 'compose' }
  | { kind: 'analyzing'; id: number; startedAt: number }
  | { kind: 'report'; analysis: VideoAnalysis };

/** 分析后台大致会经历的步骤（用户可见的进度打勾），按顺序模拟推进 */
const ANALYZE_STEPS: { label: string; hint: string }[] = [
  { label: '解析视频', hint: '按秒抽帧，理解课堂环节' },
  { label: '观察孩子表现', hint: '专注、指令、沟通、社交、情绪、精细动作' },
  { label: '观察老师教学', hint: '指令清晰度、强化、提示层级、节奏' },
  { label: '识别关键片段', hint: '带时间戳的正向回合与问题行为' },
  { label: '生成能力评分', hint: '孩子雷达 & 老师维度评分' },
  { label: '汇总训练建议', hint: '结合个案的 SMART 目标' },
];

/** 顶部个案筛选：null=全部，number=指定孩子，'none'=未关联个案 */
type ChildFilter = null | number | 'none';

/**
 * "分析中" 专用琥珀色调（Japandi 暖橙），与 clay/sage 的绿色系拉开对比。
 * 品牌重命名后 clay 也是绿色（#7FA98B），仅靠深浅无法区分状态，故用独立色。
 */
const AMBER = {
  solid: '#D9954A', // 主色（按钮/圆点/边框）
  deep: '#B87A32',  // 悬浮/文字深色
  mist: '#FBEDD8',  // 浅底
  border: '#EFD3AB',
};

export function VideoStudio() {
  const [children, setChildren] = useState<Child[]>([]);
  const [history, setHistory] = useState<VideoAnalysis[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [loading, setLoading] = useState(true);
  const [childFilter, setChildFilter] = useState<ChildFilter>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => timer.current && clearTimeout(timer.current);
  useEffect(() => clearTimer, []);

  const load = useCallback(async () => {
    const [c, v] = await Promise.all([
      fetch('/api/children').then((r) => (r.ok ? r.json() : { children: [] })),
      fetch('/api/videos').then((r) => (r.ok ? r.json() : { analyses: [] })),
    ]);
    setChildren(c.children || []);
    setHistory(v.analyses || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- 轮询分析进度（analyzing 视图内使用） ---------- */
  const poll = useCallback(
    (id: number, attempt = 0) => {
      timer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/videos/${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error();
          const a: VideoAnalysis = data.analysis;
          if (a.status === 'DONE' && a.report) {
            setView({ kind: 'report', analysis: a });
            load();
            return;
          }
          if (a.status === 'FAILED' || attempt > 120) {
            setView({ kind: 'list' });
            load();
            alert(a.error || '视频分析失败，请重试或换一个视频');
            return;
          }
          poll(id, attempt + 1);
        } catch {
          poll(id, attempt + 1);
        }
      }, 3000);
    },
    [load]
  );

  /* ---------- 后台轻量轮询：不打开分析视图也能自动刷新列表里 ANALYZING 记录的状态 ---------- */
  const bgTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (view.kind !== 'list') {
      if (bgTimer.current) {
        clearInterval(bgTimer.current);
        bgTimer.current = null;
      }
      return;
    }
    const hasAnalyzing = history.some((a) => a.status === 'ANALYZING');
    if (!hasAnalyzing) return;
    bgTimer.current = setInterval(() => load(), 5000);
    return () => {
      if (bgTimer.current) {
        clearInterval(bgTimer.current);
        bgTimer.current = null;
      }
    };
  }, [view.kind, history, load]);

  /* ---------- 分析视图 pending 态：id=-1 时反复拉列表，找到本次刚建的 ANALYZING 记录后切到 id 轮询 ---------- */
  const pendingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (view.kind !== 'analyzing' || view.id !== -1) {
      if (pendingTimer.current) {
        clearInterval(pendingTimer.current);
        pendingTimer.current = null;
      }
      return;
    }
    const startedAt = view.startedAt;
    const scan = async () => {
      try {
        const r = await fetch('/api/videos');
        if (!r.ok) return;
        const data = await r.json();
        const analyses: VideoAnalysis[] = data.analyses || [];
        setHistory(analyses);
        // 取本次提交之后创建的最新一条 ANALYZING 记录（宽 5s 容差，避免时钟偏差）
        const match = analyses
          .filter(
            (a) =>
              a.status === 'ANALYZING' &&
              a.createdAt &&
              new Date(a.createdAt).getTime() >= startedAt - 5000
          )
          .sort(
            (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
          )[0];
        // 也覆盖"记录已完成但比提交时刻更晚"的情况（POST 很快返回）
        const done = analyses
          .filter(
            (a) =>
              a.status === 'DONE' &&
              a.createdAt &&
              new Date(a.createdAt).getTime() >= startedAt - 5000
          )
          .sort(
            (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
          )[0];
        if (done) {
          setView({ kind: 'report', analysis: done });
          return;
        }
        if (match) {
          setView({ kind: 'analyzing', id: match.id, startedAt });
          poll(match.id);
        }
      } catch {
        /* ignore, next tick will retry */
      }
    };
    scan();
    pendingTimer.current = setInterval(scan, 2500);
    return () => {
      if (pendingTimer.current) {
        clearInterval(pendingTimer.current);
        pendingTimer.current = null;
      }
    };
  }, [view, poll]);

  /* ---------- 提交分析：立刻切到分析中界面（可离开），后台异步跑 POST ---------- */
  async function submit(payload: { videoUrl: string; childId: number | null; title: string }) {
    clearTimer();
    // 立刻进分析视图，让用户看到"AI 已经在做事了"。此时还没拿到记录 id（POST 会跑很久），
    // 由 pending-analyzing 分支通过定时拉列表找到刚建的 ANALYZING 记录，再切到 id 轮询。
    const startedAt = Date.now();
    setView({ kind: 'analyzing', id: -1, startedAt });

    // POST 不阻塞：请求内部会先建 ANALYZING 记录再跑模型；前置校验错才有必要弹窗
    fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          try {
            const data = await res.json();
            if (!data?.id) {
              // 前置校验失败，没有建记录：退回 compose
              setView({ kind: 'compose' });
              alert(data?.error || '提交失败，请重试');
              return;
            }
          } catch {
            /* ignore */
          }
        }
        load();
      })
      .catch(() => {
        // 请求超时/断连：后台可能还在跑，交给列表轮询兜底
        load();
      });

    load();
  }

  /** 打开某条 ANALYZING 记录的进度视图 */
  function openAnalyzing(id: number, startedAt?: number) {
    clearTimer();
    setView({ kind: 'analyzing', id, startedAt: startedAt ?? Date.now() });
    poll(id);
  }

  if (view.kind === 'analyzing') {
    return (
      <AnalyzingView
        startedAt={view.startedAt}
        onBack={() => {
          clearTimer();
          setView({ kind: 'list' });
          load();
        }}
      />
    );
  }

  if (view.kind === 'report') {
    return (
      <ReportView
        analysis={view.analysis}
        onBack={() => {
          setView({ kind: 'list' });
          load();
        }}
      />
    );
  }

  if (view.kind === 'compose') {
    return (
      <Composer
        children={children}
        onBack={() => setView({ kind: 'list' })}
        onSubmit={(p) => submit(p)}
      />
    );
  }

  // ---------- list ----------
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl text-ink">课堂视频分析</h2>
          <p className="mt-0.5 text-sm text-ink-faint">
            选一段课堂录像，AI 分析孩子与老师的课堂表现，生成可给家长的报告
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setView({ kind: 'compose' })}>
          <PlusIcon />
          新建分析
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      ) : (
        <ListSection
          history={history}
          children={children}
          childFilter={childFilter}
          onChildFilterChange={setChildFilter}
          onOpen={async (a) => {
            if (a.status === 'DONE' && a.report) {
              // 列表 API 不返回 history（能力趋势数据），必须走单条接口拉完整报告，
              // 否则趋势图永远为空。先用列表里的数据占位、后台补 history 再替换。
              setView({ kind: 'report', analysis: a });
              try {
                const r = await fetch(`/api/videos/${a.id}`);
                if (!r.ok) return;
                const data = await r.json();
                if (data?.analysis) {
                  setView({ kind: 'report', analysis: data.analysis });
                }
              } catch {
                /* keep list-version, no trend */
              }
            } else if (a.status === 'ANALYZING') {
              openAnalyzing(
                a.id,
                a.createdAt ? new Date(a.createdAt).getTime() : Date.now()
              );
            } else {
              alert(a.error || '这条分析失败了，请重新发起');
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 列表：顶部个案筛选 + 按分析时间倒序 ---------------- */
function ListSection({
  history,
  children,
  childFilter,
  onChildFilterChange,
  onOpen,
}: {
  history: VideoAnalysis[];
  children: Child[];
  childFilter: ChildFilter;
  onChildFilterChange: (f: ChildFilter) => void;
  onOpen: (a: VideoAnalysis) => void;
}) {
  // 仅列出出现过在历史里的孩子（避免筛选没意义的空项）
  const childIdsInHistory = new Set(
    history.map((a) => a.childId ?? null).filter((v): v is number => typeof v === 'number')
  );
  const hasUnlinked = history.some((a) => !a.childId);

  // 过滤 + 按 createdAt 倒序（无 createdAt 的排最后）
  const filtered = history
    .filter((a) => {
      if (childFilter === null) return true;
      if (childFilter === 'none') return !a.childId;
      return a.childId === childFilter;
    })
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  const chips: { key: string; label: string; value: ChildFilter; count: number }[] = [
    { key: 'all', label: '全部', value: null, count: history.length },
    ...children
      .filter((c) => childIdsInHistory.has(c.id))
      .map((c) => ({
        key: `c-${c.id}`,
        label: c.nickname,
        value: c.id as ChildFilter,
        count: history.filter((a) => a.childId === c.id).length,
      })),
  ];
  if (hasUnlinked) {
    chips.push({
      key: 'none',
      label: '未关联',
      value: 'none',
      count: history.filter((a) => !a.childId).length,
    });
  }

  return (
    <>
      {chips.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active =
              (childFilter === null && chip.value === null) ||
              (childFilter !== null && chip.value === childFilter);
            return (
              <button
                key={chip.key}
                onClick={() => onChildFilterChange(chip.value)}
                className={
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                  (active
                    ? 'border-clay bg-clay text-white'
                    : 'border-line bg-white text-ink-soft hover:border-clay hover:text-clay')
                }
              >
                {chip.label}
                <span
                  className={
                    'rounded-full px-1.5 text-[10px] ' +
                    (active ? 'bg-white/25 text-white' : 'bg-line/60 text-ink-faint')
                  }
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {history.length === 0 ? (
        <div className="rounded-section border border-dashed border-line bg-white/50 p-10 text-center">
          <p className="text-sm text-ink-faint">
            还没有分析记录。
            <br />
            点「新建分析」，选一段课堂视频就能开始。
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-section border border-dashed border-line bg-white/50 p-10 text-center">
          <p className="text-sm text-ink-faint">这个筛选下暂无分析记录。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const linkedChild = a.childId
              ? children.find((c) => c.id === a.childId)
              : null;
            const viewLabel =
              a.status === 'DONE'
                ? '查看报告'
                : a.status === 'ANALYZING'
                ? '查看进度'
                : '查看';
            return (
              <div
                key={a.id}
                onClick={() => onOpen(a)}
                className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-white p-4 text-left transition-colors hover:border-clay"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-clay-mist text-lg">
                  {a.status === 'ANALYZING' ? (
                    <Spinner className="h-4 w-4 text-clay" />
                  ) : (
                    '🎬'
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {a.title || '课堂视频分析'}
                    </p>
                    <StatusChip status={a.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
                    <span>{formatListDate(a.createdAt)}</span>
                    {linkedChild && (
                      <>
                        <span className="text-line">·</span>
                        <span className="text-ink-soft">{linkedChild.nickname}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(a);
                  }}
                  className={
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                    (a.status === 'DONE'
                      ? 'border-sage bg-sage text-white hover:bg-sage-deep'
                      : a.status === 'FAILED'
                      ? 'border-line bg-white text-ink-soft hover:border-clay hover:text-clay'
                      : '')
                  }
                  style={
                    a.status === 'ANALYZING'
                      ? { backgroundColor: AMBER.solid, borderColor: AMBER.solid, color: '#fff' }
                      : undefined
                  }
                >
                  {viewLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** ISO 时间 → 中文本地日期（YYYY年M月D日）；空/非法回退到 —— */
function formatListDate(iso?: string): string {
  if (!iso) return '——';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '——';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; cls: string; dotCls?: string; dotStyle?: React.CSSProperties; style?: React.CSSProperties }
  > = {
    DONE: {
      label: '已完成',
      cls: 'border-sage/40 bg-sage-mist text-sage-deep',
      dotCls: 'bg-sage',
    },
    ANALYZING: {
      label: '分析中',
      cls: '',
      dotStyle: { backgroundColor: AMBER.solid },
      style: {
        backgroundColor: AMBER.mist,
        color: AMBER.deep,
        borderColor: AMBER.border,
      },
    },
    FAILED: {
      label: '失败',
      cls: '',
      style: { backgroundColor: '#F4E5E5', color: '#C08585', borderColor: '#E8C7C7' },
    },
  };
  const item = map[status] || { label: '', cls: '' };
  const hasDot = item.dotCls || item.dotStyle;
  return (
    <span
      className={
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
        item.cls
      }
      style={item.style}
    >
      {hasDot && (
        <span
          className={
            'h-1.5 w-1.5 rounded-full ' +
            (item.dotCls || '') +
            (status === 'ANALYZING' ? ' animate-pulse' : '')
          }
          style={item.dotStyle}
        />
      )}
      {item.label}
    </span>
  );
}

/* ---------------- 分析进度视图：按步骤打勾展示后台工作 ---------------- */
function AnalyzingView({
  startedAt,
  onBack,
}: {
  startedAt: number;
  onBack: () => void;
}) {
  // 用「已过秒数」推进步骤打勾；总预计 ~120s，均匀分给步骤，末步保留缓冲。
  // 就算轮询更快回来（DONE 直接切走）也不用担心；只是给用户「看到有在做事」。
  const stepDurationMs = 18000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsedMs = Math.max(0, now - startedAt);
  const totalSteps = ANALYZE_STEPS.length;
  // 第 i 步在 elapsedMs 达到 (i+1)*stepDurationMs 时打勾；最后一步保留到实际完成才打勾。
  const rawCompleted = Math.min(totalSteps - 1, Math.floor(elapsedMs / stepDurationMs));
  const activeIndex = Math.min(totalSteps - 1, rawCompleted); // 当前进行中的一步

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <button onClick={onBack} className="mb-4 text-sm text-ink-faint hover:text-ink">
        ← 返回列表（AI 会在后台继续分析，稍后回来看）
      </button>
      <div className="rounded-section border border-line bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Spinner className="h-6 w-6 text-clay" />
          <div>
            <h2 className="text-lg text-ink">AI 正在分析这段课堂视频</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              通常 1–3 分钟。你可以停在这里看进度，也可以离开去做别的，完成后在列表里点开报告即可。
            </p>
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {ANALYZE_STEPS.map((s, i) => {
            const done = i < activeIndex;
            const running = i === activeIndex;
            return (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ' +
                    (done
                      ? 'bg-sage text-white'
                      : running
                      ? 'bg-clay text-white'
                      : 'bg-line/60 text-ink-faint')
                  }
                >
                  {done ? '✓' : running ? <Spinner className="h-3 w-3 text-white" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      'text-sm font-medium ' +
                      (done ? 'text-sage-deep' : running ? 'text-ink' : 'text-ink-faint')
                    }
                  >
                    {s.label}
                    {running && <span className="ml-1 text-xs text-clay">进行中…</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">{s.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 border-t border-line pt-3 text-center text-[11px] text-ink-faint">
          已耗时 {Math.floor(elapsedMs / 1000)} 秒 · 分析完成后这条记录会自动变成「已完成」
        </p>
      </div>
    </div>
  );
}

/* ---------------- 新建分析：上传视频 + 选个案 + 标题 ---------------- */
function Composer({
  children,
  onBack,
  onSubmit,
}: {
  children: Child[];
  onBack: () => void;
  onSubmit: (p: { videoUrl: string; childId: number | null; title: string }) => void;
}) {
  const [childId, setChildId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const child = children.find((c) => c.id === childId) || null;

  // 本地预览用 object URL，组件卸载/换文件时释放
  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | null) {
    setUploadError('');
    setFile(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const videoUrl = await uploadVideoToOss(file);
      onSubmit({ videoUrl, childId, title: title.trim() });
    } catch (err: any) {
      setUploadError(err?.message || '上传失败，请重试');
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <button onClick={onBack} className="mb-4 text-sm text-ink-faint hover:text-ink">
        ← 返回
      </button>
      <div className="rounded-section border border-line bg-white p-6">
        <h2 className="mb-1 text-xl text-ink">新建课堂视频分析</h2>
        <p className="mb-5 text-sm text-ink-faint">
          上传要分析的课堂视频；关联孩子个案后，训练建议会结合其诊断与偏弱方向。
        </p>

        <div className="grid gap-5">
          {/* 上传视频 */}
          <div>
            <FieldLabel required>课堂视频</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line bg-paper/30 px-4 py-8 text-sm text-ink-faint transition-colors hover:border-clay hover:text-clay"
              >
                <AttachIcon width={20} height={20} />
                点击选择本地视频文件
              </button>
            ) : (
              <div className="rounded-card border border-line bg-black/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-ink-faint">{file.name}</p>
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    disabled={uploading}
                    className="shrink-0 text-xs text-ink-faint hover:text-clay disabled:opacity-40"
                  >
                    重新选择
                  </button>
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={previewUrl} controls className="max-h-64 w-full rounded-lg" preload="metadata" />
              </div>
            )}
            <p className="mt-1.5 text-xs text-ink-faint">
              建议 5 分钟内、200MB 以内，过大的视频上传和分析都会更慢
            </p>
            {uploadError && (
              <p className="mt-1.5 text-xs" style={{ color: '#C08585' }}>{uploadError}</p>
            )}
          </div>

          {/* 关联个案 */}
          <div>
            <FieldLabel>关联孩子个案（可选）</FieldLabel>
            <select
              value={childId ?? ''}
              onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-input border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-clay"
            >
              <option value="">不指定孩子（按通用视角分析）</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                  {c.age ? ` · ${c.age}岁` : ''}
                  {c.diagnosis ? ` · ${c.diagnosis}` : ''}
                </option>
              ))}
            </select>
            {child && (child.weaknesses.length > 0 || child.interests.length > 0) && (
              <p className="mt-1.5 text-xs text-ink-faint">
                将结合
                {child.weaknesses.length > 0 && `「${child.weaknesses.join('/')}」重点方向`}
                {child.interests.length > 0 && `、兴趣「${child.interests.join('/')}」`}
                给出建议
              </p>
            )}
          </div>

          {/* 标题 */}
          <div>
            <FieldLabel>报告标题（可选）</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={child ? `${child.nickname}的课堂分析` : '如：小宇 8月10日课堂'}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onBack} disabled={uploading}>
            取消
          </Button>
          <Button className="gap-1.5" disabled={!file || uploading} loading={uploading} onClick={handleSubmit}>
            <SparkleIcon width={16} height={16} />
            {uploading ? '上传中…' : '开始分析'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ===== 视频跳转上下文：任何深层的时间戳都能唤起浮窗并 seek ===== */
const SeekContext = createContext<((sec: number) => void) | null>(null);

/** mm:ss → 秒 */
function parseTime(mmss: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(mmss.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 统一的可点击时间戳：下划线 + 点击跳转视频 */
function TimeStamp({ time, className = '' }: { time: string; className?: string }) {
  const seek = useContext(SeekContext);
  return (
    <button
      type="button"
      onClick={() => seek?.(parseTime(time))}
      title="点击定位到视频对应位置"
      className={
        'inline-flex items-center gap-0.5 font-mono text-xs font-medium text-clay underline decoration-clay/40 decoration-dashed underline-offset-2 transition-colors hover:decoration-clay ' +
        className
      }
    >
      ▸ {time}
    </button>
  );
}

/* ---------------- 报告页 ---------------- */
function ReportView({
  analysis,
  onBack,
}: {
  analysis: VideoAnalysis;
  onBack: () => void;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tab, setTab] = useState<'child' | 'teacher'>('child');
  const [seekTo, setSeekTo] = useState<number | null>(null); // 非 null 时打开浮窗
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 兜底：老报告可能缺新字段，统一补空数组/默认，避免 .map 崩
  const raw = analysis.report as Partial<VideoReport> | null;
  const report: VideoReport = {
    summary: raw?.summary || '',
    childSummary: raw?.childSummary || '',
    teacherSummary: raw?.teacherSummary || '',
    childRadar: raw?.childRadar || [],
    teacherScores: raw?.teacherScores || [],
    teacherBehavior: raw?.teacherBehavior || [],
    teacherNextSteps: raw?.teacherNextSteps || [],
    dtt: raw?.dtt || {
      totalTrials: 0,
      independentCorrect: 0,
      promptedCorrect: 0,
      incorrect: 0,
      independentRate: 0,
      promptLevels: { verbal: 0, gesture: 0, physical: 0 },
    },
    hasProblemBehavior: raw?.hasProblemBehavior ?? false,
    abcEvents: raw?.abcEvents || [],
    timeline: raw?.timeline || [],
    stats: raw?.stats || [],
    highlights: raw?.highlights || [],
    concerns: raw?.concerns || [],
    suggestions: raw?.suggestions || [],
    nextGoals: raw?.nextGoals || [],
  };
  const title = analysis.title || '课堂视频分析';
  const hasDtt = report.dtt.totalTrials > 0;
  const childTimeline = report.timeline.filter((t) => t.role === 'child');
  const teacherTimeline = report.timeline.filter((t) => t.role === 'teacher');
  const history = analysis.history || [];
  const trendReady = history.length >= 2; // 至少 2 次才画趋势

  const openAt = useCallback((sec: number) => setSeekTo(sec), []);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await exportReportPdf(title, report);
    } catch {
      alert('PDF 生成失败，请重试');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <SeekContext.Provider value={openAt}>
      <div className="mx-auto max-w-3xl animate-fade-in">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={onBack} className="text-sm text-ink-faint hover:text-ink">
            ← 返回列表
          </button>
          <Button variant="outline" className="gap-1.5" loading={pdfBusy} onClick={downloadPdf}>
            <DownloadIcon width={16} height={16} />
            导出 PDF 给家长
          </Button>
        </div>

        <div className="space-y-5">
          {/* 概述（共享） */}
          <div className="rounded-section border border-line bg-white p-6">
            <h2 className="text-xl text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {report.summary || '（无整体概述）'}
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              提示：报告中带下划线的时间（如 <span className="font-mono text-clay">▸ 01:20</span>）可点击，会弹出视频并跳到对应位置。
            </p>
          </div>

          {/* 关键指标（共享） */}
          {report.stats.length > 0 && (
            <Section title="关键指标">
              <div className="grid gap-4 sm:grid-cols-3">
                {report.stats.map((s, i) => (
                  <div key={i} className="rounded-card border border-line bg-paper/40 p-4">
                    <p className="text-xs text-ink-faint">{s.label}</p>
                    <p className="mt-1 text-2xl font-medium text-clay">
                      {s.value}
                      <span className="ml-0.5 text-sm font-medium">{s.unit}</span>
                    </p>
                    {s.unit === '%' && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-clay"
                          style={{ width: `${Math.min(Math.max(s.value, 0), 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 学生 / 老师 二级 tab */}
          <div className="flex w-full gap-1 rounded-card border border-line bg-white p-1">
            {(
              [
                ['child', '👧 学生表现'],
                ['teacher', '🧑‍🏫 老师表现'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ' +
                  (tab === key
                    ? key === 'child'
                      ? 'bg-clay text-white'
                      : 'bg-sage text-white'
                    : 'text-ink-soft hover:bg-paper')
                }
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'child' ? (
            <div className="space-y-5">
              <div className="rounded-section border border-line bg-white p-6">
                <h3 className="text-sm text-ink">学生总结</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {report.childSummary || '（该次报告未生成学生总结）'}
                </p>
                <InsightPanel key={`child-${analysis.id}`} analysisId={analysis.id} scope="child" />
              </div>

              {report.childRadar.length > 0 && (
                <Section title="能力评估 · 与同龄对比" accent="clay">
                  <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                    <RadarChart dims={report.childRadar} />
                    <div className="flex-1 space-y-3">
                      {report.childRadar.map((d, i) => (
                        <ScoreRow key={i} dim={d} accent="clay" />
                      ))}
                    </div>
                  </div>
                </Section>
              )}

              {/* 能力发展趋势（同一孩子历次） */}
              {trendReady ? (
                <Section title="能力发展趋势" accent="sage">
                  <TrendChart history={history} dims={report.childRadar.map((d) => d.name)} />
                </Section>
              ) : (
                report.childRadar.length > 0 && (
                  <Section title="能力发展趋势" accent="sage">
                    <p className="rounded-card border border-dashed border-line bg-paper/30 p-4 text-center text-xs text-ink-faint">
                      {analysis.report && analysis.title
                        ? '该孩子目前只有这一次分析记录，做第 2 次分析后这里会显示进步趋势曲线。'
                        : '关联孩子个案并多次分析后，这里会显示能力进步趋势。'}
                    </p>
                  </Section>
                )
              )}

              {(report.highlights.length > 0 || report.concerns.length > 0) && (
                <div className="grid gap-5 md:grid-cols-2">
                  {report.highlights.length > 0 && (
                    <TagCard title="进步亮点" tone="sage" items={report.highlights} icon="✓" />
                  )}
                  {report.concerns.length > 0 && (
                    <TagCard title="需关注信号" tone="amber" items={report.concerns} icon="!" />
                  )}
                </div>
              )}

              {/* 独立完成情况（DTT）——反映孩子的独立程度，放学生 tab */}
              {hasDtt && (
                <Section title="独立完成情况（回合统计）" accent="clay">
                  <DttPanel dtt={report.dtt} />
                </Section>
              )}

              {/* ABC 行为分析 */}
              <Section title="ABC 行为分析（前因 → 行为 → 后果）" accent="clay">
                <AbcPanel events={report.abcEvents} hasProblem={report.hasProblemBehavior} />
              </Section>

              {childTimeline.length > 0 && (
                <Section title="学生关键片段时间轴" accent="clay">
                  <TimelineList segs={childTimeline} />
                </Section>
              )}

              {report.suggestions.length > 0 && (
                <Section title="训练建议" accent="clay">
                  <ol className="space-y-2.5">
                    {report.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-clay text-[11px] font-medium text-white">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {report.nextGoals.length > 0 && (
                <Section title="下节课训练目标" accent="sage">
                  <ul className="space-y-2.5">
                    {report.nextGoals.map((g, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-card border border-sage/30 bg-sage-mist/40 p-3 text-sm leading-relaxed text-ink"
                      >
                        <span className="mt-0.5 shrink-0 text-sage">🎯</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-section border border-line bg-white p-6">
                <h3 className="text-sm text-ink">老师总结</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {report.teacherSummary || '（该次报告未生成老师总结）'}
                </p>
                <InsightPanel key={`teacher-${analysis.id}`} analysisId={analysis.id} scope="teacher" />
              </div>

              {report.teacherScores.length > 0 && (
                <Section title="教学评分" accent="sage">
                  <div className="space-y-3">
                    {report.teacherScores.map((d, i) => (
                      <TeacherScoreCard key={i} dim={d} />
                    ))}
                  </div>
                </Section>
              )}

              {report.teacherBehavior.length > 0 && (
                <Section title="教学表现" accent="sage">
                  <BulletList items={report.teacherBehavior} accent="sage" />
                </Section>
              )}

              {teacherTimeline.length > 0 && (
                <Section title="老师关键片段时间轴" accent="sage">
                  <TimelineList segs={teacherTimeline} />
                </Section>
              )}

              {report.teacherNextSteps.length > 0 && (
                <Section title="下一步建议" accent="sage">
                  <ul className="space-y-2.5">
                    {report.teacherNextSteps.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-card border border-sage/30 bg-sage-mist/40 p-3 text-sm leading-relaxed text-ink"
                      >
                        <span className="mt-0.5 shrink-0 text-sage">🎯</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          <p className="pb-4 text-center text-[11px] text-ink-faint">
            本报告由 AI 辅助生成，仅供教研与家庭训练参考
          </p>
        </div>
      </div>

      {seekTo !== null && (
        <VideoModal
          url={analysis.videoUrl}
          seekTo={seekTo}
          videoRef={videoRef}
          onClose={() => setSeekTo(null)}
        />
      )}
    </SeekContext.Provider>
  );
}

/* ---------------- 视频浮窗（居中模态 + 遮罩，自动 seek） ---------------- */
function VideoModal({
  url,
  seekTo,
  videoRef,
  onClose,
}: {
  url: string;
  seekTo: number;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onClose: () => void;
}) {
  // 每次 seekTo 变化：定位并播放
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const go = () => {
      try {
        v.currentTime = seekTo;
        v.play().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    if (v.readyState >= 1) go();
    else v.addEventListener('loadedmetadata', go, { once: true });
  }, [seekTo, videoRef]);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-section bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="关闭"
        >
          ✕
        </button>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} src={url} controls autoPlay className="max-h-[70vh] w-full" />
        <p className="bg-black/80 py-1.5 text-center text-xs text-white/80">
          已定位到 {Math.floor(seekTo / 60)}:{String(Math.floor(seekTo % 60)).padStart(2, '0')} · 点击遮罩或 Esc 关闭
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  accent = 'clay',
}: {
  title: string;
  children: React.ReactNode;
  accent?: 'clay' | 'sage';
}) {
  return (
    <div className="rounded-section border border-line bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <span
          className={
            'h-4 w-1 rounded-full ' + (accent === 'sage' ? 'bg-sage' : 'bg-clay')
          }
        />
        <h3 className="text-base text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, accent }: { items: string[]; accent: 'clay' | 'sage' }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink">
          <span
            className={
              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' +
              (accent === 'sage' ? 'bg-sage' : 'bg-clay')
            }
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineList({ segs }: { segs: TimelineSeg[] }) {
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {segs.map((seg, i) => (
        <TimelineItem key={i} seg={seg} />
      ))}
    </ol>
  );
}

function TimelineItem({ seg }: { seg: TimelineSeg }) {
  const isTeacher = seg.role === 'teacher';
  return (
    <li className="relative">
      <span
        className={
          'absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ' +
          (isTeacher ? 'bg-sage' : 'bg-clay')
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <TimeStamp time={seg.time} />
        <span
          className={
            'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
            (isTeacher ? 'bg-sage-mist text-sage' : 'bg-clay-mist text-clay')
          }
        >
          {isTeacher ? '老师' : '孩子'} · {seg.tag}
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink">{seg.desc}</p>
    </li>
  );
}

/* ---------------- ABC 行为分析（前因→行为→后果） ---------------- */
function AbcPanel({ events, hasProblem }: { events: AbcEvent[]; hasProblem: boolean }) {
  if (events.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-sage-mist/30 p-5 text-center">
        <p className="text-sm font-medium text-ink">本节课未观察到明显问题行为 ✓</p>
        <p className="mt-1 text-xs text-ink-faint">
          孩子全程配合任务，无哭闹、离座、刻板或攻击等需要用 ABC 记录的行为。
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {!hasProblem && (
        <p className="rounded-lg bg-sage-mist/40 px-3 py-2 text-xs text-ink-soft">
          本节课未观察到明显问题行为，以下记录为课堂关键（正向）回合，供参考。
        </p>
      )}
      {events.map((e, i) => {
        const problem = e.kind === 'problem';
        return (
          <div
            key={i}
            className={
              'rounded-card border p-4 ' +
              (problem ? 'border-clay/40 bg-clay-mist' : 'border-line bg-paper/30')
            }
          >
            <div className="mb-3 flex items-center gap-2">
              <TimeStamp time={e.time} />
              <span
                className={
                  'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                  (problem ? 'bg-clay text-white' : 'bg-sage text-white')
                }
              >
                {problem ? '问题行为' : '正向回合'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <AbcCell letter="A" label="前因" text={e.antecedent} tone="ink" />
              <AbcCell letter="B" label="行为" text={e.behavior} tone={problem ? 'amber' : 'clay'} />
              <AbcCell letter="C" label="后果" text={e.consequence} tone="ink" />
            </div>
            {e.comment && (
              <p className="mt-2 border-t border-line pt-2 text-xs text-ink-faint">
                <span className="font-medium text-ink-soft">点评：</span>
                {e.comment}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AbcCell({
  letter,
  label,
  text,
  tone,
}: {
  letter: string;
  label: string;
  text: string;
  tone: 'ink' | 'clay' | 'amber';
}) {
  const chip =
    tone === 'clay' ? 'bg-clay text-white' : tone === 'amber' ? 'bg-clay text-white' : 'bg-ink/70 text-white';
  return (
    <div className="rounded-lg bg-white/70 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={'flex h-4 w-4 items-center justify-center rounded text-[10px] font-medium ' + chip}>
          {letter}
        </span>
        <span className="text-[11px] font-medium text-ink-soft">{label}</span>
      </div>
      <p className="text-xs leading-relaxed text-ink">{text || '—'}</p>
    </div>
  );
}

/* ---------------- 亮点 / 关注 卡片 ---------------- */
function TagCard({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: 'sage' | 'amber';
  icon: string;
}) {
  const cls =
    tone === 'sage'
      ? { bar: 'bg-sage', chip: 'bg-sage text-white', ring: 'border-sage/30 bg-sage-mist/30' }
      : { bar: 'bg-clay', chip: 'bg-clay text-white', ring: 'border-clay/40 bg-clay-mist' };
  return (
    <div className={'rounded-card border p-5 ' + cls.ring}>
      <div className="mb-3 flex items-center gap-2">
        <span className={'h-4 w-1 rounded-full ' + cls.bar} />
        <h3 className="text-base text-ink">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink">
            <span
              className={
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ' +
                cls.chip
              }
            >
              {icon}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- 能力评分行（孩子 vs 同龄 对比条） ---------------- */
function ScoreRow({ dim, accent }: { dim: DimensionScore; accent: 'clay' | 'sage' }) {
  const pct = (Math.min(Math.max(dim.score, 0), 5) / 5) * 100;
  const peer = dim.peer ?? 4;
  const peerPct = (Math.min(Math.max(peer, 0), 5) / 5) * 100;
  const gap = dim.score - peer;
  const gapLabel = gap >= 1 ? '优于同龄' : gap <= -1 ? '低于同龄' : '接近同龄';
  const gapCls =
    gap >= 1 ? 'bg-sage-mist text-sage-deep' : gap <= -1 ? 'bg-clay-mist text-clay' : 'bg-paper text-ink-faint';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{dim.name}</span>
        <span className="flex items-center gap-2">
          <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-medium ' + gapCls}>{gapLabel}</span>
          <span className="text-xs font-medium text-clay">{dim.score}/5</span>
        </span>
      </div>
      {/* 对比条：填充=孩子，虚线标记=同龄基准 */}
      <div className="relative mt-1 h-2 overflow-visible rounded-full bg-line">
        <div
          className={'h-full rounded-full ' + (accent === 'sage' ? 'bg-sage' : 'bg-clay')}
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-ink/60"
          style={{ left: `${peerPct}%` }}
          title={`同龄典型 ${peer}/5`}
        />
      </div>
      {dim.note && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{dim.note}</p>}
    </div>
  );
}

/* ---------------- 雷达图（纯 SVG，无依赖） ---------------- */
function RadarChart({ dims }: { dims: DimensionScore[] }) {
  const n = dims.length;
  const size = 220;
  const c = size / 2;
  const R = 82;
  const levels = 5;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: c + r * Math.cos(angle(i)),
    y: c + r * Math.sin(angle(i)),
  });

  const grid = Array.from({ length: levels }, (_, l) => {
    const r = (R * (l + 1)) / levels;
    return dims.map((_, i) => pt(i, r));
  });
  const dataPts = dims.map((d, i) => pt(i, (R * Math.min(Math.max(d.score, 0), 5)) / 5));
  const peerPts = dims.map((d, i) => pt(i, (R * Math.min(Math.max(d.peer ?? 4, 0), 5)) / 5));
  const hasPeer = dims.some((d) => d.peer != null);
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';

  return (
    <div className="flex shrink-0 flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {grid.map((ring, l) => (
          <path key={l} d={toPath(ring)} fill="none" stroke="#ece7df" strokeWidth={1} />
        ))}
        {dims.map((_, i) => {
          const p = pt(i, R);
          return <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="#ece7df" strokeWidth={1} />;
        })}
        {/* 同龄参考轮廓（虚线灰） */}
        {hasPeer && (
          <path d={toPath(peerPts)} fill="none" stroke="#8a7f74" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {/* 孩子实际（陶橙填充） */}
        <path d={toPath(dataPts)} fill="rgba(224,138,91,0.22)" stroke="#e08a5b" strokeWidth={2} />
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#e08a5b" />
        ))}
        {dims.map((d, i) => {
          const p = pt(i, R + 16);
          const anchor = Math.abs(p.x - c) < 6 ? 'middle' : p.x > c ? 'start' : 'end';
          return (
            <text key={i} x={p.x} y={p.y} dy={4} textAnchor={anchor} fontSize={10} fill="#5c534b">
              {d.name}
            </text>
          );
        })}
      </svg>
      {hasPeer && (
        <div className="mt-1 flex items-center gap-4 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-clay/60" />孩子
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-3 border-t-2 border-dashed border-ink-faint" />同龄典型
          </span>
        </div>
      )}
    </div>
  );
}

/** YYYY-MM-DD → M月D日；非法输入原样返回 */
function formatTrendDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

/* ---------------- 能力趋势折线（历次分析） ---------------- */
function TrendChart({ history, dims }: { history: HistoryPoint[]; dims: string[] }) {
  const W = 520;
  const H = 180;
  const padL = 30;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const n = history.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : ((W - padL - padR) * i) / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / 5);
  // 每个维度一条线，配色循环
  const colors = ['#e08a5b', '#7fa27e', '#8a7f74', '#c99', '#99b', '#cb8'];
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[480px]">
        {/* y 网格 1~5 */}
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#ece7df" strokeWidth={1} />
            <text x={padL - 6} y={y(v)} dy={3} textAnchor="end" fontSize={9} fill="#8a7f74">
              {v}
            </text>
          </g>
        ))}
        {/* x 日期：YYYY-MM-DD → M月D日，比 05-14 更好读 */}
        {history.map((h, i) => (
          <text key={h.id} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#5c534b">
            {formatTrendDate(h.date)}
          </text>
        ))}
        {/* 每维度折线 */}
        {dims.map((dim, di) => {
          const pts = history.map((h, i) => ({ x: x(i), v: h.scores[dim] ?? 0, i }));
          const path = pts
            .filter((p) => p.v > 0)
            .map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${y(p.v).toFixed(1)}`)
            .join(' ');
          const color = colors[di % colors.length];
          return (
            <g key={dim}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} />
              {pts.map(
                (p) => p.v > 0 && <circle key={p.i} cx={p.x} cy={y(p.v)} r={2.4} fill={color} />
              )}
            </g>
          );
        })}
      </svg>
      {/* 图例 */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft">
        {dims.map((dim, di) => (
          <span key={dim} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: colors[di % colors.length] }}
            />
            {dim}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 老师评分卡（评分 + 总评 + 多个片段） ---------------- */
function TeacherScoreCard({ dim }: { dim: TeacherDimension }) {
  const segs = dim.segments || [];
  // 该维度整体基调：有问题片段 → 待改进（陶橙）；只有亮点 → 做得好（鼠尾草绿）；都没有 → 中性
  const hasProblem = segs.some((s) => s.type === 'problem');
  const hasHighlight = segs.some((s) => s.type === 'highlight');
  const tone: 'problem' | 'highlight' | 'neutral' = hasProblem
    ? 'problem'
    : hasHighlight
    ? 'highlight'
    : 'neutral';

  const wrapCls =
    tone === 'problem'
      ? 'border-clay/40 bg-clay-mist/40'
      : tone === 'highlight'
      ? 'border-sage/40 bg-sage-mist/30'
      : 'border-line bg-paper/30';
  const scoreCls =
    tone === 'problem' ? 'text-clay' : tone === 'highlight' ? 'text-sage-deep' : 'text-ink-soft';
  const badgeCls =
    tone === 'problem'
      ? 'bg-clay text-white'
      : tone === 'highlight'
      ? 'bg-sage text-white'
      : 'bg-line/60 text-ink-soft';
  const badgeLabel = tone === 'problem' ? '有待改进' : tone === 'highlight' ? '做得好' : '中性';

  return (
    <div className={'rounded-card border p-4 ' + wrapCls}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{dim.name}</span>
          {tone !== 'neutral' && (
            <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + badgeCls}>
              {badgeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StarRow score={dim.score} tone={tone} />
          <span className={'text-xs font-medium ' + scoreCls}>{dim.score}/5</span>
        </div>
      </div>

      {dim.note && <p className="mb-3 text-xs leading-relaxed text-ink-soft">{dim.note}</p>}

      {segs.length === 0 ? (
        <p className="rounded-lg bg-sage-mist/40 px-3 py-1.5 text-xs text-sage">本维度无特别记录 ✓</p>
      ) : (
        <div className="space-y-2.5">
          {segs.map((s, i) => (
            <TeacherSegmentRow key={i} seg={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 一个片段：时间戳 + [问题表现/正确示范] 或 [亮点表现/进阶示范] */
function TeacherSegmentRow({ seg }: { seg: TeacherSegment }) {
  const problem = seg.type === 'problem';
  const obsLabel = problem ? '问题表现' : '亮点表现';
  const demoLabel = problem ? '正确示范' : '进阶示范';
  return (
    <div
      className={
        'rounded-lg border p-3 ' +
        (problem ? 'border-clay/40 bg-clay-mist/60' : 'border-sage/30 bg-sage-mist/25')
      }
    >
      <div className="mb-1.5 flex items-center gap-2">
        <TimeStamp time={seg.time} />
        <span
          className={
            'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
            (problem ? 'bg-clay text-white' : 'bg-sage text-white')
          }
        >
          {problem ? '待改进' : '亮点'}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ink">
        <span className={'font-medium ' + (problem ? 'text-clay' : 'text-sage-deep')}>{obsLabel}：</span>
        {seg.observation}
      </p>
      {seg.demo && (
        <p className="mt-1 flex gap-1 text-xs leading-relaxed text-ink">
          <span className="font-medium text-clay">{demoLabel}：</span>
          <span>{seg.demo}</span>
        </p>
      )}
    </div>
  );
}

function StarRow({
  score,
  tone = 'neutral',
}: {
  score: number;
  tone?: 'problem' | 'highlight' | 'neutral';
}) {
  const onCls =
    tone === 'problem' ? 'text-clay' : tone === 'highlight' ? 'text-sage-deep' : 'text-ink-soft';
  return (
    <span className="text-sm tracking-tight">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? onCls : 'text-line'}>
          ★
        </span>
      ))}
    </span>
  );
}

/* ---------------- DTT 回合统计 ---------------- */
function DttPanel({ dtt }: { dtt: DttStats }) {
  const cells: { label: string; value: number; cls: string; style?: React.CSSProperties }[] = [
    { label: '回合总数', value: dtt.totalTrials, cls: 'text-ink' },
    { label: '独立正确', value: dtt.independentCorrect, cls: 'text-sage-deep' },
    { label: '提示下正确', value: dtt.promptedCorrect, cls: 'text-clay' },
    { label: '错误/无反应', value: dtt.incorrect, cls: '', style: { color: '#C08585' } },
  ];
  const pl = dtt.promptLevels;
  const plTotal = pl.verbal + pl.gesture + pl.physical;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="rounded-card border border-line bg-paper/30 p-3 text-center">
            <p className={'text-2xl font-medium ' + c.cls} style={c.style}>{c.value}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-ink-faint">
        回合总数 {dtt.totalTrials} = 独立正确 {dtt.independentCorrect} + 提示下正确 {dtt.promptedCorrect} + 错误 {dtt.incorrect}
      </p>
      {/* 独立正确率 */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-ink">独立正确率</span>
          <span className="text-sm font-medium text-sage">{dtt.independentRate}%</span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-sage"
            style={{ width: `${Math.min(Math.max(dtt.independentRate, 0), 100)}%` }}
          />
        </div>
      </div>
      {/* 辅助阶梯：孩子需要多大程度的帮助才能完成 */}
      <div className="rounded-card border border-line bg-paper/20 p-4">
        <p className="text-sm font-medium text-ink">孩子需要多少帮助？（辅助阶梯）</p>
        <p className="mb-3 mt-0.5 text-xs text-ink-faint">
          从左到右，老师给的帮助越来越多、孩子越来越不独立。<b className="text-sage">越靠左越好</b>——目标是让孩子尽量靠左（独立完成）。
        </p>
        <AssistLadder
          steps={[
            { label: '独立完成', hint: '不用帮助', count: dtt.independentCorrect, cls: 'bg-sage' },
            { label: '口语提示', hint: '老师说一句', count: pl.verbal, cls: 'bg-sage/60' },
            { label: '手势提示', hint: '老师指一指', count: pl.gesture, cls: 'bg-clay/70' },
            { label: '肢体辅助', hint: '手把手带', count: pl.physical, cls: 'bg-ink/60' },
          ]}
        />
      </div>
    </div>
  );
}

function AssistLadder({
  steps,
}: {
  steps: { label: string; hint: string; count: number; cls: string }[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-20 shrink-0 text-right">
            <p className="text-xs font-medium text-ink">{s.label}</p>
            <p className="text-[10px] text-ink-faint">{s.hint}</p>
          </div>
          <div className="flex h-6 flex-1 items-center rounded-md bg-line/60">
            <div
              className={'flex h-6 items-center justify-end rounded-md px-2 ' + s.cls}
              style={{ width: `${(s.count / max) * 100}%`, minWidth: s.count > 0 ? '1.75rem' : 0 }}
            >
              {s.count > 0 && <span className="text-[11px] font-medium text-white">{s.count}</span>}
            </div>
            {s.count === 0 && <span className="pl-2 text-[11px] text-ink-faint">0</span>}
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-ink-faint">次</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 问小禾AI 对话 ---------------- */
type ChatMsg = { role: 'user' | 'ai'; text: string };

const PRESET_QUESTIONS: Record<'child' | 'teacher', string[]> = {
  child: [
    '这个孩子最需要优先解决的是什么？',
    '和同龄孩子相比，差距最大的是哪方面？',
    'ABC 里的问题行为要怎么干预？',
    '下节课应该重点练什么？',
  ],
  teacher: [
    '这堂课最大的改进空间是什么？',
    '强化不及时具体要怎么补？',
    '提示层级用得合不合适？',
    '怎么提升孩子的独立完成率？',
  ],
};

function InsightPanel({ analysisId, scope }: { analysisId: number; scope: 'child' | 'teacher' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [followups, setFollowups] = useState<string[]>(PRESET_QUESTIONS[scope]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    setInput('');
    setFollowups([]);
    const nextMessages: ChatMsg[] = [...messages, { role: 'user', text: q }];
    setMessages(nextMessages);
    setAsking(true);
    try {
      const res = await fetch(`/api/videos/${analysisId}/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '问小禾AI 回答失败');
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer }]);
      setFollowups(data.followups || []);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'ai', text: `抱歉，${err?.message || '出错了'}，请重试。` }]);
      setFollowups(PRESET_QUESTIONS[scope]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
          (open ? 'border-clay bg-clay-mist text-clay' : 'border-line text-ink-soft hover:border-clay hover:text-clay')
        }
      >
        <SparkleIcon width={14} height={14} />
        问小禾AI
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 animate-fade-in rounded-card border border-line bg-paper/30 p-3">
          {messages.length > 0 && (
            <div ref={scrollRef} className="mb-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={
                      'max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2 text-sm leading-relaxed ' +
                      (m.role === 'user' ? 'bg-clay text-white' : 'border border-line bg-white text-ink')
                    }
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="rounded-card border border-line bg-white px-3.5 py-2">
                    <Spinner className="h-3.5 w-3.5 text-clay" />
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.length === 0 && (
            <p className="mb-2 text-xs text-ink-faint">
              针对这份报告继续追问，小禾AI 会结合报告内容回答，并引导你深入了解。
            </p>
          )}

          {followups.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {followups.map((f, i) => (
                <button
                  key={i}
                  disabled={asking}
                  onClick={() => ask(f)}
                  className="rounded-full border border-clay/40 bg-white px-3 py-1.5 text-xs text-clay transition-colors hover:bg-clay-mist disabled:opacity-40"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder="也可以自己输入问题…"
              className="text-sm"
              disabled={asking}
            />
            <Button className="shrink-0 px-4" disabled={asking || !input.trim()} onClick={() => ask(input)}>
              发送
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
