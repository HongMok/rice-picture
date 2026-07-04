'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '~/components/ui';
import { SparkleIcon } from '~/components/ui/icons';
import { GamePlayer, unlockTts } from '~/components/app/GamePlayer';
import { CatchButterflyGame } from '~/components/app/games/CatchButterflyGame';
import { WhackAMoleGame } from '~/components/app/games/WhackAMoleGame';
import { usePanelBackOverride } from '~/components/app/PanelBack';
import type { Child } from '~/components/app/ChildForm';
import {
  GAME_META,
  GAME_ENGINE,
  type GameType,
  type GameData,
  type ReflexGameResult,
} from '~/data/game-types';

type View =
  | { kind: 'list' }
  | { kind: 'building'; label: string }
  | { kind: 'play'; game: GameData }
  | { kind: 'reflex-play'; gameType: GameType; gameId: number | null; child: Child | null };

/** 常见儿童喜欢的角色 —— 情绪题会用这个形象来展示表情 */
const POPULAR_CHARACTERS = [
  '小猪佩奇',
  '汪汪队',
  '米老鼠',
  '奥特曼',
  '光头强',
  '海绵宝宝',
  '艾莎公主',
  '小马宝莉',
];

export function GameStudio() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  /** 偏好物覆写：优先于个案的 interests[0]。空串 = 用个案兴趣兜底。 */
  const [characterOverride, setCharacterOverride] = useState('');
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

  // 二级视图（游戏进行中 / 结算 / 出题 loading）时，接管 Workbench 顶栏返回，先回到游戏列表。
  // 顺便刷一次 children 以拿到最新累计金币。
  const backToList = useCallback(() => {
    setView({ kind: 'list' });
    loadChildren();
  }, [loadChildren]);
  usePanelBackOverride(view.kind === 'list' ? null : backToList);

  const currentChild = childId != null ? children.find((c) => c.id === childId) || null : null;

  const startGame = useCallback(
    async (gameType: GameType) => {
      // 反应类：不出题，先建局记录（若选了孩子），进难度选择
      if (GAME_ENGINE[gameType] === 'reflex') {
        let gameId: number | null = null;
        if (currentChild) {
          try {
            const res = await fetch('/api/games', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ childId: currentChild.id, gameType }),
            });
            const d = await res.json();
            if (res.ok) gameId = d.gameId;
          } catch {
            /* 通用局：即使建局失败也照常玩，只是不记成绩 */
          }
        }
        setView({ kind: 'reflex-play', gameType, gameId, child: currentChild });
        return;
      }

      // 认知类：调 TTS 解锁 + 出题
      unlockTts();
      setView({ kind: 'building', label: '正在出题…' });
      try {
        const res = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: currentChild?.id,
            gameType,
            character: characterOverride.trim() || undefined,
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          alert(d.error || '出题失败');
          setView({ kind: 'list' });
          return;
        }
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
        setView({ kind: 'list' });
      }
    },
    [currentChild, characterOverride],
  );

  if (view.kind === 'play') {
    return <GamePlayer game={view.game} onExit={() => setView({ kind: 'list' })} />;
  }

  if (view.kind === 'reflex-play') {
    const handleFinish = async (result: ReflexGameResult) => {
      if (view.gameId == null) return;
      try {
        await fetch(`/api/games/${view.gameId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        });
        if (view.child) await loadChildren();
      } catch {
        /* 静默失败：不影响本局已展示的结算画面 */
      }
    };
    const onExit = () => setView({ kind: 'list' });
    if (view.gameType === 'catch-butterfly') {
      return <CatchButterflyGame gameId={view.gameId} onFinish={handleFinish} onExit={onExit} />;
    }
    if (view.gameType === 'whack-a-mole') {
      return <WhackAMoleGame gameId={view.gameId} onFinish={handleFinish} onExit={onExit} />;
    }
    return null;
  }

  if (view.kind === 'building') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center rounded-section border border-line bg-white p-10 text-center">
        <Spinner className="h-8 w-8 text-clay" />
        <p className="mt-3 text-sm text-ink-soft">{view.label}</p>
        <p className="mt-1 text-xs text-ink-faint">
          正在按孩子的情况定制题目、准备图片，首次可能需要 20～60 秒
        </p>
      </div>
    );
  }

  // list：顶部个案筛选 + 游戏卡片
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-5">
        <h2 className="text-xl text-ink">互动游戏</h2>
        <p className="mt-0.5 text-sm text-ink-faint">
          选一个游戏开始训练；先选个案孩子会按情况定制并记录成绩
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-clay" />
        </div>
      ) : (
        <>
          <ChildFilter
            children={children}
            value={childId}
            onChange={setChildId}
            characterOverride={characterOverride}
            onCharacterChange={setCharacterOverride}
          />
          <GameTypeGroup
            title="游戏列表"
            types={(Object.keys(GAME_META) as GameType[]).filter((gt) => GAME_ENGINE[gt] === 'quiz')}
            onPick={startGame}
          />
          {/* 反应训练（捉蝴蝶 / 打地鼠）暂时隐藏，未上线 */}
        </>
      )}
    </div>
  );
}

/* ---------------- 顶部个案筛选 + 偏好物 ---------------- */
function ChildFilter({
  children,
  value,
  onChange,
  characterOverride,
  onCharacterChange,
}: {
  children: Child[];
  value: number | null;
  onChange: (id: number | null) => void;
  characterOverride: string;
  onCharacterChange: (v: string) => void;
}) {
  const selected = value != null ? children.find((c) => c.id === value) : null;
  // 生效的角色（覆写优先，其次孩子的第一个兴趣）
  const effectiveCharacter =
    characterOverride.trim() || selected?.interests?.[0]?.trim() || '';
  return (
    <div className="mb-6 space-y-4 rounded-section border border-line bg-white p-4">
      {/* 第一段：当前个案 */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-faint">当前个案</p>
          {value != null && (
            <button
              onClick={() => onChange(null)}
              className="text-xs text-ink-faint hover:text-ink"
            >
              清除
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <FilterChip active={value == null} onClick={() => onChange(null)}>
            不指定（通用，不记录成绩）
          </FilterChip>
          {children.map((c) => (
            <FilterChip
              key={c.id}
              active={value === c.id}
              onClick={() => onChange(c.id)}
            >
              {c.nickname}
              {c.age ? ` · ${c.age}岁` : ''}
            </FilterChip>
          ))}
        </div>
        {selected && (
          <div className="mt-3 flex items-center gap-2 rounded-input bg-[#FFF6DE] px-3 py-2 text-xs">
            <span className="text-base">🪙</span>
            <span className="text-ink-soft">
              <span className="font-medium text-[#B88515]">{selected.nickname}</span>{' '}
              当前累计金币{' '}
              <span className="font-medium text-[#B88515]">{selected.total_points ?? 0}</span>
            </span>
          </div>
        )}
      </div>

      {/* 第二段：偏好物（情绪题会用它出图） */}
      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-faint">偏好物（用于出题上下文）</p>
          {characterOverride && (
            <button
              onClick={() => onCharacterChange('')}
              className="text-xs text-ink-faint hover:text-ink"
            >
              清除覆写
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <FilterChip
            active={!characterOverride}
            onClick={() => onCharacterChange('')}
          >
            {selected?.interests?.[0]
              ? `跟随个案（${selected.interests[0]}）`
              : '通用小朋友'}
          </FilterChip>
          {POPULAR_CHARACTERS.map((name) => (
            <FilterChip
              key={name}
              active={characterOverride === name}
              onClick={() => onCharacterChange(name)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={characterOverride}
            onChange={(e) => onCharacterChange(e.target.value)}
            placeholder="或输入自定义角色（如：巴啦啦小魔仙）"
            maxLength={30}
            className="flex-1 rounded-input border border-line bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-clay focus:outline-none"
          />
        </div>
        {/* 生效角色提示条 */}
        <div className="mt-3 flex items-center gap-2 rounded-input bg-clay-mist px-3 py-2 text-xs text-clay-deep">
          <span className="text-base">🎭</span>
          <span>
            本局题目将围绕{' '}
            <span className="font-medium">{effectiveCharacter || '通用卡通角色'}</span>{' '}
            展开（心情/配对都会用到）
          </span>
        </div>
      </div>
      {children.length === 0 && (
        <p className="mt-2 text-xs leading-[1.9] text-ink-faint">
          还没有个案孩子。去
          <Link
            href="/app/cases"
            className="mx-1 text-clay underline underline-offset-2 hover:opacity-80"
          >
            个案管理
          </Link>
          新建一个，就能定制专属题目并记录训练成绩。
        </p>
      )}
    </div>
  );
}

function FilterChip({
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
      className={
        'rounded-btn border px-3 py-1.5 text-xs transition-colors duration-[450ms] ' +
        (active
          ? 'border-clay bg-clay text-white'
          : 'border-line bg-white text-ink-soft hover:border-clay hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

/* ---------------- 游戏分组 ---------------- */
function GameTypeGroup({
  title,
  types,
  onPick,
}: {
  title: string;
  types: GameType[];
  onPick: (gt: GameType) => void;
}) {
  if (types.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium text-ink-faint">{title}</p>
      <div className="grid gap-3">
        {types.map((gt) => {
          const m = GAME_META[gt];
          return (
            <button
              key={gt}
              onClick={() => onPick(gt)}
              className="flex items-center gap-4 rounded-card border-2 border-line bg-white p-4 text-left transition-colors duration-[450ms] hover:border-clay"
            >
              <span
                className={
                  'flex h-16 w-16 items-center justify-center rounded-card text-3xl ' +
                  (GAME_ENGINE[gt] === 'quiz' ? 'bg-clay-mist' : 'bg-sage-mist')
                }
              >
                {m.emoji}
              </span>
              <div className="flex-1">
                <p className="text-base text-ink">{m.name}</p>
                <p className="text-xs text-ink-faint">{m.subtitle}</p>
              </div>
              <SparkleIcon className="text-clay" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
