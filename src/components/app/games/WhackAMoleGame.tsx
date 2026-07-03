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
import { loadSoundPref, saveSoundPref, playHit, playMiss, playFinish, playCoin, playCombo, unlockAudio } from '~/components/app/games/reflex-sound';
import { spawnFloatText, spawnParticles, spawnComboBadge } from '~/components/app/games/effects';
import { GameCursor } from '~/components/app/games/GameCursor';

const GRID_SIZE = 9; // 3x3

interface Mole {
  id: number;
  hole: number;
  bornAt: number;
  lifetimeMs: number;
  hit: boolean;
}

export function WhackAMoleGame({
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
  const [moles, setMoles] = useState<Mole[]>([]);
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
    setMoles((prev) => {
      const activeHoles = new Set(prev.map((m) => m.hole));
      if (prev.length >= params.concurrent) return prev;
      const free = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !activeHoles.has(i));
      if (free.length === 0) return prev;
      const hole = free[Math.floor(Math.random() * free.length)];
      return [
        ...prev,
        { id: nextId.current++, hole, bornAt: performance.now(), lifetimeMs: params.lifetimeMs, hit: false },
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

      setMsLeft((prev) => (prev - dt > 0 ? prev - dt : 0));

      spawnAccRef.current += dt;
      if (spawnAccRef.current >= params.spawnIntervalMs) {
        spawnAccRef.current = 0;
        spawnOne();
      }

      setMoles((prev) => {
        const alive = prev.filter((m) => m.hit || now - m.bornAt < m.lifetimeMs);
        const expiredUnhit = prev.filter((m) => !m.hit && now - m.bornAt >= m.lifetimeMs);
        if (expiredUnhit.length) {
          setMisses((mm) => mm + expiredUnhit.length);
          setCombo(0); // 漏一只断连击
        }
        // 命中动画播完（0.25s）也要清理
        return alive.filter((m) => !(m.hit && now - m.bornAt > m.lifetimeMs + 250));
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

  function whack(id: number, e: React.MouseEvent<HTMLButtonElement>) {
    let alreadyHit = false;
    setMoles((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.hit) {
        alreadyHit = true;
        return prev;
      }
      return prev.map((m) => (m.id === id ? { ...m, hit: true } : m));
    });
    if (alreadyHit) return;

    setHits((h) => h + 1);
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    const bonus = nextCombo >= 3 && nextCombo % 3 === 0 ? Math.floor(params.hitScore / 2) : 0;
    const gained = params.hitScore + bonus;
    setScore((s) => s + gained);

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
    setMoles([]);
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
        emoji={GAME_META['whack-a-mole'].emoji}
        title={GAME_META['whack-a-mole'].name}
        subtitle={GAME_META['whack-a-mole'].subtitle}
        onBack={onExit}
        onStart={start}
      />
    );
  }

  if (phase === 'done') {
    return (
      <GameResultPanel
        emoji="🐹"
        gameTitle={GAME_META['whack-a-mole'].name}
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

      <div ref={arenaRef} className="relative overflow-hidden rounded-section bg-sage-mist p-6 touch-none">
        {/* 背景微动：草地轻拂 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none text-4xl">
          <span className="animate-game-bg-drift absolute left-[6%] top-[6%] opacity-40" style={{ animationDelay: '0s' }}>
            🌿
          </span>
          <span className="animate-game-bg-drift absolute right-[8%] top-[10%] opacity-40" style={{ animationDelay: '-5s' }}>
            🌱
          </span>
          <span className="animate-game-bg-drift absolute left-[45%] bottom-[6%] opacity-30" style={{ animationDelay: '-9s' }}>
            🍃
          </span>
        </div>

        <p className="relative mb-4 text-center text-sm font-medium text-ink-soft">用锤子敲弹出的地鼠！</p>
        <div className="relative grid grid-cols-3 gap-4">
          {Array.from({ length: GRID_SIZE }).map((_, hole) => {
            const mole = moles.find((m) => m.hole === hole);
            return (
              <div
                key={hole}
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-card bg-clay-mist"
              >
                <div className="absolute bottom-0 h-4 w-3/4 rounded-full bg-black/10" />
                {mole && (
                  <button
                    onClick={(e) => whack(mole.id, e)}
                    className={
                      'absolute bottom-0 flex h-3/4 w-3/4 items-center justify-center text-[clamp(48px,10vw,120px)] leading-none ' +
                      (mole.hit ? 'animate-game-pop-hit' : 'animate-game-pop')
                    }
                    style={{ animationDuration: mole.hit ? undefined : `${mole.lifetimeMs}ms` }}
                    aria-label="地鼠"
                  >
                    🐹
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 光标：跟随鼠标/触点的卡通锤子 */}
        <GameCursor shape="hammer" size={96} />
      </div>
    </div>
  );
}
