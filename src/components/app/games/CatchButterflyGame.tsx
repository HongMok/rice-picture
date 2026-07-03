'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DifficultyPicker, GameTopBar, GameResultPanel } from '~/components/app/GameShell';
import {
  GAME_DURATION_MS,
  GAME_META,
  REFLEX_DIFFICULTY,
  starsForScore,
  type Difficulty,
  type ReflexGameResult,
} from '~/data/game-types';
import { loadSoundPref, saveSoundPref, playHit, playFinish, playCoin, playCombo, unlockAudio } from '~/components/app/games/reflex-sound';
import { spawnFloatText, spawnParticles, spawnComboBadge } from '~/components/app/games/effects';
import { GameCursor } from '~/components/app/games/GameCursor';

const COLORS = ['#e8a5c0', '#8fc9b8', '#f0c36d', '#9bb8e8', '#d99bd9'];

interface Butterfly {
  id: number;
  x: number; // 0-100 (% of arena width)
  y: number; // 0-100 (% of arena height)
  color: string;
  bornAt: number;
  lifetimeMs: number;
}

export function CatchButterflyGame({
  gameId,
  onFinish,
  onExit,
}: {
  gameId: number | null;
  onFinish: (result: ReflexGameResult) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<'pick' | 'play' | 'done'>('pick');
  const [difficulty, setDifficulty] = useState<Difficulty>('简单');
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [msLeft, setMsLeft] = useState(GAME_DURATION_MS);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [combo, setCombo] = useState(0);
  const [butterflies, setButterflies] = useState<Butterfly[]>([]);
  const arenaRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const rafRef = useRef<number>();
  const lastTickRef = useRef(0);
  const spawnAccRef = useRef(0);

  useEffect(() => {
    setSoundOn(loadSoundPref());
  }, []);

  const params = REFLEX_DIFFICULTY[difficulty];

  const spawnOne = useCallback(() => {
    setButterflies((prev) => {
      if (prev.length >= params.concurrent) return prev;
      return [
        ...prev,
        {
          id: nextId.current++,
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 70,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          bornAt: performance.now(),
          lifetimeMs: params.lifetimeMs,
        },
      ];
    });
  }, [params.concurrent, params.lifetimeMs]);

  useEffect(() => {
    if (phase !== 'play') return;

    lastTickRef.current = performance.now();
    spawnAccRef.current = 0;

    function tick(now: number) {
      if (paused) {
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;

      setMsLeft((prev) => {
        const next = prev - dt;
        return next > 0 ? next : 0;
      });

      spawnAccRef.current += dt;
      if (spawnAccRef.current >= params.spawnIntervalMs) {
        spawnAccRef.current = 0;
        spawnOne();
      }

      setButterflies((prev) => {
        const alive = prev.filter((b) => now - b.bornAt < b.lifetimeMs);
        if (alive.length !== prev.length) {
          setMisses((m) => m + (prev.length - alive.length));
          setCombo(0); // 飞走了断连击
        }
        return alive;
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, paused, params.spawnIntervalMs, spawnOne]);

  useEffect(() => {
    if (phase === 'play' && msLeft <= 0) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase]);

  function finish() {
    const stars = starsForScore(score, difficulty);
    playFinish(soundOn);
    setPhase('done');
    onFinish({ score, stars, difficulty, hits, misses });
  }

  function catchButterfly(id: number, e: React.MouseEvent<HTMLButtonElement>) {
    setButterflies((prev) => prev.filter((b) => b.id !== id));
    setHits((h) => h + 1);

    // 连击 +1，每 3 连击额外奖励
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    const bonus = nextCombo >= 3 && nextCombo % 3 === 0 ? Math.floor(params.hitScore / 2) : 0;
    const gained = params.hitScore + bonus;
    setScore((s) => s + gained);

    // 视觉/听觉反馈
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    spawnFloatText(cx, cy, `+${gained} 🪙`, '#B88515');
    spawnParticles(cx, cy, 8);
    playCoin(soundOn);
    playHit(soundOn);
    if (bonus > 0) {
      spawnComboBadge(arenaRef.current, nextCombo);
      playCombo(soundOn, nextCombo);
    }
  }

  function start(d: Difficulty) {
    unlockAudio();
    setDifficulty(d);
    setScore(0);
    setHits(0);
    setMisses(0);
    setCombo(0);
    setMsLeft(GAME_DURATION_MS);
    setButterflies([]);
    setPaused(false);
    setPhase('play');
  }

  function retry() {
    setPhase('pick');
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundPref(next);
  }

  if (phase === 'pick') {
    return (
      <DifficultyPicker
        emoji={GAME_META['catch-butterfly'].emoji}
        title={GAME_META['catch-butterfly'].name}
        subtitle={GAME_META['catch-butterfly'].subtitle}
        onBack={onExit}
        onStart={start}
      />
    );
  }

  if (phase === 'done') {
    return (
      <GameResultPanel
        emoji="🦋"
        gameTitle={GAME_META['catch-butterfly'].name}
        score={score}
        stars={starsForScore(score, difficulty)}
        onRetry={retry}
        onExit={onExit}
      />
    );
  }

  const secLeft = Math.ceil(msLeft / 1000);
  const timeLabel = `${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto w-full animate-fade-in">
      <GameTopBar
        score={score}
        timeLeftLabel={timeLabel}
        paused={paused}
        soundOn={soundOn}
        combo={combo}
        onTogglePause={() => setPaused((p) => !p)}
        onToggleSound={toggleSound}
      />

      <div
        ref={arenaRef}
        className="relative h-[min(70vh,720px)] w-full overflow-hidden rounded-card bg-gradient-to-b from-water-mist to-sage-mist touch-none"
      >
        {/* 背景飘云层：3 朵慢速漂移的白云，营造氛围 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none text-5xl">
          <span className="animate-game-bg-drift absolute left-[10%] top-[15%] text-white/70" style={{ animationDelay: '0s' }}>
            ☁️
          </span>
          <span className="animate-game-bg-drift absolute right-[15%] top-[35%] text-white/60" style={{ animationDelay: '-4s' }}>
            ☁️
          </span>
          <span className="animate-game-bg-drift absolute left-[35%] top-[65%] text-white/50" style={{ animationDelay: '-8s' }}>
            ☁️
          </span>
        </div>

        <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-ink-soft">
          用网抓住飞舞的蝴蝶！
        </p>
        {butterflies.map((b) => (
          <button
            key={b.id}
            onClick={(e) => catchButterfly(b.id, e)}
            className="animate-game-fly absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-6xl"
            style={{ left: `${b.x}%`, top: `${b.y}%`, color: b.color }}
            aria-label="蝴蝶"
          >
            🦋
          </button>
        ))}

        {/* 光标：跟随鼠标/触点的卡通捕虫网 */}
        <GameCursor shape="net" size={96} />
      </div>
    </div>
  );
}
