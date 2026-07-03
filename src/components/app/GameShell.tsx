'use client';

import { useState } from 'react';
import { Button } from '~/components/ui';
import {
  PauseIcon,
  PlayIcon,
  SoundIcon,
  SoundOffIcon,
} from '~/components/ui/icons';
import { DIFFICULTIES, type Difficulty } from '~/data/game-types';

const DIFFICULTY_ICON: Record<Difficulty, string> = {
  入门: '🌱',
  简单: '🌿',
  中等: '🌳',
  困难: '🔥',
  专家: '⚡',
};

/* ---------------- 开局难度选择页 ---------------- */
export function DifficultyPicker({
  emoji,
  title,
  subtitle,
  onBack,
  onStart,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  onStart: (difficulty: Difficulty) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('简单');

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-section border border-line bg-white p-8 text-center animate-fade-in">
      <button onClick={onBack} className="mb-4 self-start text-sm text-ink-faint hover:text-ink">
        ← 返回
      </button>
      <div className="animate-float text-6xl">{emoji}</div>
      <h2 className="mt-3 text-2xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
        {DIFFICULTIES.slice(0, 4).map((d) => (
          <DifficultyButton key={d} d={d} active={difficulty === d} onClick={() => setDifficulty(d)} />
        ))}
      </div>
      <div className="mt-2.5 w-full">
        <DifficultyButton
          d={DIFFICULTIES[4]}
          active={difficulty === DIFFICULTIES[4]}
          onClick={() => setDifficulty(DIFFICULTIES[4])}
          full
        />
      </div>

      <Button className="mt-7 w-full py-3 text-base" onClick={() => onStart(difficulty)}>
        开始游戏
      </Button>
    </div>
  );
}

function DifficultyButton({
  d,
  active,
  onClick,
  full,
}: {
  d: Difficulty;
  active: boolean;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center justify-center gap-1.5 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors duration-[450ms] ' +
        (full ? 'w-full' : '') +
        ' ' +
        (active
          ? 'border-clay bg-clay-mist text-clay'
          : 'border-line bg-white text-ink-soft hover:border-clay')
      }
    >
      <span>{DIFFICULTY_ICON[d]}</span>
      {d}
    </button>
  );
}

/* ---------------- 游戏内顶部条 ---------------- */
export function GameTopBar({
  score,
  timeLeftLabel,
  paused,
  soundOn,
  combo,
  onTogglePause,
  onToggleSound,
}: {
  score: number;
  timeLeftLabel: string;
  paused: boolean;
  soundOn: boolean;
  /** 当前连击数（≥2 才展示） */
  combo?: number;
  onTogglePause: () => void;
  onToggleSound: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-section bg-white/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full bg-[#FFF6DE] px-3 py-1 text-sm font-medium text-[#B88515]">
          🪙 {score}
        </span>
        {typeof combo === 'number' && combo >= 2 && (
          <span className="rounded-full bg-[#FFE7CC] px-2.5 py-1 text-xs font-medium text-[#C7681A]">
            连击 ×{combo}
          </span>
        )}
        <span className="rounded-full bg-paper px-3 py-1 text-sm font-medium text-ink-soft">
          ⏱ {timeLeftLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn onClick={onTogglePause} title={paused ? '继续' : '暂停'}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconBtn>
        <IconBtn onClick={onToggleSound} title={soundOn ? '关闭音效' : '开启音效'}>
          {soundOn ? <SoundIcon /> : <SoundOffIcon />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-card text-ink-soft transition-colors duration-[450ms] hover:bg-paper-deep hover:text-ink"
    >
      {children}
    </button>
  );
}

/* ---------------- 结算面板 ---------------- */
export function GameResultPanel({
  emoji = '🌈',
  title = '全部完成啦！',
  gameTitle,
  score,
  stars,
  maxStars = 3,
  totalPoints,
  onRetry,
  onExit,
}: {
  emoji?: string;
  title?: string;
  gameTitle: string;
  score: number;
  stars: number;
  maxStars?: number;
  totalPoints?: number | null;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-section border border-line bg-white p-10 text-center animate-fade-in">
      <div className="mb-2 animate-float text-6xl">{emoji}</div>
      <h2 className="text-2xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-faint">在《{gameTitle}》里表现得很棒</p>

      <div className="my-5 flex justify-center gap-1.5 text-3xl">
        {Array.from({ length: maxStars }).map((_, i) => (
          <span key={i} className={i < stars ? 'opacity-100' : 'opacity-25'}>
            ⭐
          </span>
        ))}
      </div>

      <div className="mx-auto inline-flex items-center gap-2 rounded-section bg-[#FFF6DE] px-5 py-2.5 text-lg font-medium text-[#B88515]">
        🪙 +{score}
      </div>

      {typeof totalPoints === 'number' && (
        <p className="mt-3 text-xs text-ink-faint">
          累计金币 <span className="font-medium text-[#B88515]">🪙 {totalPoints}</span>
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={onRetry}>再玩一次</Button>
        <Button variant="outline" onClick={onExit}>
          回到列表
        </Button>
      </div>
    </div>
  );
}
