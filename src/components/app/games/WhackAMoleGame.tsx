'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DifficultyPicker } from '~/components/app/GameShell';
import { Button } from '~/components/ui';
import {
  GAME_DURATION_MS,
  GAME_META,
  REFLEX_DIFFICULTY,
  starsForScore,
  type Difficulty,
  type ReflexGameResult,
} from '~/data/game-types';
import {
  loadSoundPref,
  saveSoundPref,
  playHit,
  playMiss,
  playFinish,
  playCoin,
  playCombo,
  unlockAudio,
} from '~/components/app/games/reflex-sound';
import { spawnFloatText, spawnParticles, spawnComboBadge } from '~/components/app/games/effects';
import { GameCursor } from '~/components/app/games/GameCursor';
import {
  FieldBackground,
  MoundSvg,
  MoleSvg,
  BombSvg,
  HudCapsule,
  ClockIcon,
  CoinIcon,
  TargetIcon,
} from '~/components/app/games/MoleScene';
import { PauseIcon, PlayIcon, SoundIcon, SoundOffIcon } from '~/components/ui/icons';

const GRID_SIZE = 9;
const BOMB_PROBABILITY = 0.18;
const BOMB_PENALTY = 20;
const HI_SCORE_KEY = 'rice-picture:mole-hi-score';

/** 9 个洞口在游戏区里的错落位置（%）；三行各 3 个，偶数行居中偏移。 */
const HOLE_POSITIONS = [
  // 上排（远景，稍小）
  { x: 22, y: 45, w: 18 },
  { x: 50, y: 42, w: 18 },
  { x: 78, y: 45, w: 18 },
  // 中排（居中，中等）
  { x: 30, y: 65, w: 22 },
  { x: 58, y: 62, w: 22 },
  { x: 86, y: 65, w: 22 },
  // 前排（近景，最大）
  { x: 18, y: 88, w: 26 },
  { x: 50, y: 90, w: 26 },
  { x: 82, y: 88, w: 26 },
] as const;

type TargetKind = 'mole' | 'bomb';
interface TargetItem {
  id: number;
  hole: number;
  kind: TargetKind;
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
  const [whacked, setWhacked] = useState(0);
  const [escaped, setEscaped] = useState(0);
  const [bombs, setBombs] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [msLeft, setMsLeft] = useState(GAME_DURATION_MS);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [combo, setCombo] = useState(0);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [hiScore, setHiScore] = useState(0);
  const arenaRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const rafRef = useRef<number>();
  const lastTickRef = useRef(0);
  const spawnAccRef = useRef(0);

  useEffect(() => {
    setSoundOn(loadSoundPref());
    if (typeof window !== 'undefined') {
      const v = Number(window.localStorage.getItem(HI_SCORE_KEY) || '0');
      if (Number.isFinite(v)) setHiScore(v);
    }
  }, []);

  const params = REFLEX_DIFFICULTY[difficulty];

  const spawnOne = useCallback(() => {
    setTargets((prev) => {
      const activeHoles = new Set(prev.map((m) => m.hole));
      if (prev.length >= params.concurrent) return prev;
      const free = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !activeHoles.has(i));
      if (free.length === 0) return prev;
      const hole = free[Math.floor(Math.random() * free.length)];
      const bombAlready = prev.filter((t) => t.kind === 'bomb').length > 0;
      const kind: TargetKind =
        !bombAlready && Math.random() < BOMB_PROBABILITY ? 'bomb' : 'mole';
      return [
        ...prev,
        {
          id: nextId.current++,
          hole,
          kind,
          bornAt: performance.now(),
          lifetimeMs: params.lifetimeMs,
          hit: false,
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

      setMsLeft((prev) => (prev - dt > 0 ? prev - dt : 0));

      spawnAccRef.current += dt;
      if (spawnAccRef.current >= params.spawnIntervalMs) {
        spawnAccRef.current = 0;
        spawnOne();
      }

      setTargets((prev) => {
        const expiredUnhit = prev.filter((t) => !t.hit && now - t.bornAt >= t.lifetimeMs);
        if (expiredUnhit.length) {
          const moleEscaped = expiredUnhit.filter((t) => t.kind === 'mole').length;
          if (moleEscaped > 0) {
            setEscaped((n) => n + moleEscaped);
            setCombo(0);
          }
        }
        return prev
          .filter((t) => t.hit || now - t.bornAt < t.lifetimeMs)
          .filter((t) => !(t.hit && now - t.bornAt > t.lifetimeMs + 260));
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
    if (typeof window !== 'undefined' && score > hiScore) {
      setHiScore(score);
      window.localStorage.setItem(HI_SCORE_KEY, String(score));
    }
    onFinish({ score, stars, difficulty, hits: whacked, misses: escaped });
  }

  function tapTarget(id: number, e: React.MouseEvent<HTMLButtonElement>) {
    // 关键：不要在 setTargets 回调里做 side-effect（StrictMode 会双调，
    // 第二次 t.hit 已是 true 会 early-return，导致得分/命中计数丢失）。
    // 直接从当前 targets 里找，再单独调用 setTargets 更新 hit。
    const target = targets.find((m) => m.id === id);
    if (!target || target.hit) return;
    setTargets((prev) => prev.map((m) => (m.id === id ? { ...m, hit: true } : m)));

    setClicks((c) => c + 1);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (target.kind === 'bomb') {
      setBombs((b) => b + 1);
      setScore((s) => Math.max(0, s - BOMB_PENALTY));
      setCombo(0);
      spawnFloatText(cx, cy, `-${BOMB_PENALTY}`, '#A65F44');
      spawnParticles(cx, cy, 12, ['#C97A5B', '#A65F44', '#F5E5DC']);
      playMiss(soundOn);
      return;
    }

    setWhacked((n) => n + 1);
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    const bonus = nextCombo >= 3 && nextCombo % 3 === 0 ? Math.floor(params.hitScore / 2) : 0;
    const gained = params.hitScore + bonus;
    setScore((s) => s + gained);
    spawnFloatText(cx, cy, `+${gained}`, '#5E8A6E');
    spawnParticles(cx, cy, 8, ['#8FA98F', '#B4CBB1', '#F0C36D']);
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
    setWhacked(0);
    setEscaped(0);
    setBombs(0);
    setClicks(0);
    setCombo(0);
    setMsLeft(GAME_DURATION_MS);
    setTargets([]);
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
    const accuracy = clicks > 0 ? (whacked / clicks) * 100 : 0;
    const isNewHi = score > 0 && score >= hiScore;
    return (
      <GameOverPanel
        gameTitle={GAME_META['whack-a-mole'].name}
        score={score}
        hiScore={Math.max(score, hiScore)}
        isNewHi={isNewHi}
        accuracy={accuracy}
        whacked={whacked}
        escaped={escaped}
        bombs={bombs}
        onHome={onExit}
        onRetry={retry}
      />
    );
  }

  const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const timeLabel = `${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto w-full animate-fade-in">
      {/* 顶部 HUD 一横排：Japandi 胶囊 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-section border border-line bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <ShellBtn onClick={() => setPaused((p) => !p)} title={paused ? '继续' : '暂停'}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </ShellBtn>
          <HudCapsule
            tone="water"
            icon={<ClockIcon className="text-water" />}
            label="时间"
            value={timeLabel}
          />
          <HudCapsule
            tone="ember"
            icon={<CoinIcon className="text-ember-deep" />}
            label="得分"
            value={score}
          />
          {combo >= 2 && (
            <span className="rounded-full border border-ember/50 bg-ember-mist px-3 py-1.5 text-xs font-medium text-ember-deep">
              连击 ×{combo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <HudCapsule
            tone="clay"
            icon={<TargetIcon className="text-clay-deep" />}
            label="打中"
            value={whacked}
          />
          <ShellBtn onClick={toggleSound} title={soundOn ? '关闭音效' : '开启音效'}>
            {soundOn ? <SoundIcon /> : <SoundOffIcon />}
          </ShellBtn>
        </div>
      </div>

      {/* 游戏区 */}
      <div
        ref={arenaRef}
        className="relative h-[min(72vh,760px)] w-full overflow-hidden rounded-section border border-line touch-none"
      >
        {/* 背景 */}
        <FieldBackground className="pointer-events-none absolute inset-0 h-full w-full" />

        {/* 9 个泥堆错落三行分布（借鉴 B H5 的散布感） */}
        <div className="absolute inset-0 z-10">
          {HOLE_POSITIONS.map((pos, hole) => {
            const t = targets.find((x) => x.hole === hole);
            return (
              <div
                key={hole}
                className="absolute"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${pos.w}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="relative aspect-[200/110]">
                  {/* 泥堆背板：pointer-events-none 保证事件穿透到 button */}
                  <div className="pointer-events-none absolute inset-0">
                    <MoundSvg />
                  </div>
                  {/* 目标：从洞口探头。button 只负责定位与点击，内部的 span 负责动画，
                       避免 keyframe 的 transform 洗掉 button 的 -translate-x-1/2 */}
                  {t && (
                    <button
                      onClick={(e) => tapTarget(t.id, e)}
                      className="absolute left-1/2 bottom-[35%] z-10 flex aspect-square w-[62%] -translate-x-1/2 items-end justify-center focus:outline-none"
                      aria-label={t.kind === 'mole' ? '地鼠' : '炸弹'}
                    >
                      <span
                        className={
                          'block h-full w-full origin-bottom ' +
                          (t.hit ? 'animate-game-pop-hit' : 'animate-game-pop')
                        }
                        style={{
                          animationDuration: t.hit ? undefined : `${t.lifetimeMs}ms`,
                        }}
                      >
                        {t.kind === 'mole' ? (
                          <MoleSvg state={t.hit ? 'hit' : 'peek'} />
                        ) : (
                          <BombSvg />
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 光标：卡通锤子 */}
        <GameCursor shape="hammer" size={110} />

        {/* 暂停遮罩 */}
        {paused && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/25 backdrop-blur-sm">
            <div className="rounded-section border border-line bg-white px-10 py-8 text-center shadow-lg">
              <p className="font-serif text-xl text-ink">已暂停</p>
              <p className="mt-1 text-xs text-ink-faint">准备好继续吗？</p>
              <Button className="mt-5 px-8" onClick={() => setPaused(false)}>
                继续游戏
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 顶栏方形工具按钮 ---------------- */
function ShellBtn({
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
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors duration-[450ms] hover:border-clay hover:text-clay"
    >
      {children}
    </button>
  );
}

/* ---------------- Game Over 结算面板：Japandi 白卡 ---------------- */
function GameOverPanel({
  gameTitle,
  score,
  hiScore,
  isNewHi,
  accuracy,
  whacked,
  escaped,
  bombs,
  onHome,
  onRetry,
}: {
  gameTitle: string;
  score: number;
  hiScore: number;
  isNewHi: boolean;
  accuracy: number;
  whacked: number;
  escaped: number;
  bombs: number;
  onHome: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg animate-fade-in rounded-section border border-line bg-white p-8 text-center">
      <div className="mb-2 animate-float text-5xl">🌾</div>
      <h2 className="font-serif text-2xl text-ink">
        {isNewHi ? '刷新纪录啦！' : '这一局结束了'}
      </h2>
      <p className="mt-1 text-sm text-ink-faint">在《{gameTitle}》里得了 {score} 分</p>

      {/* 主数字 */}
      <div className="my-6 flex flex-col items-center gap-2">
        <span className="text-xs font-medium tracking-wider text-ink-faint">本局得分</span>
        <span className="font-serif text-5xl leading-none text-clay-deep">{score}</span>
        <span className="text-xs text-ink-faint">
          {isNewHi ? '新纪录' : '历史最高'}
          <span className="ml-1 font-medium text-ink">{hiScore}</span>
        </span>
      </div>

      {/* 三格统计 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCell label="命中率" value={`${accuracy.toFixed(0)}%`} tone={accuracy >= 60 ? 'clay' : 'ember'} />
        <StatCell label="打中" value={whacked} tone="clay" />
        <StatCell label="漏掉" value={escaped} tone="water" />
      </div>
      <div className="mt-3">
        <StatCell full label="踩雷" value={bombs} tone={bombs > 0 ? 'ember' : 'clay'} />
      </div>

      <div className="mt-7 flex justify-center gap-3">
        <Button onClick={onRetry}>再玩一次</Button>
        <Button variant="outline" onClick={onHome}>
          回到列表
        </Button>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
  full,
}: {
  label: string;
  value: number | string;
  tone: 'sage' | 'clay' | 'ember' | 'water';
  full?: boolean;
}) {
  const map: Record<string, string> = {
    sage: 'bg-sage-mist text-sage-deep border-sage/40',
    clay: 'bg-clay-mist text-clay-deep border-clay/40',
    ember: 'bg-ember-mist text-ember-deep border-ember/40',
    water: 'bg-water-mist text-water border-water/40',
  };
  return (
    <div
      className={
        'flex items-center gap-2 rounded-card border px-3 py-2 ' +
        (full ? 'justify-center' : 'flex-col') +
        ' ' +
        map[tone]
      }
    >
      <span className="text-[11px] font-medium tracking-wide">{label}</span>
      <span className="font-serif text-lg font-medium leading-none">{value}</span>
    </div>
  );
}
