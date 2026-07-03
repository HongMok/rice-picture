'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui';
import {
  EMOTION_EMOJI,
  type GameData,
  type EmotionRound,
  type MatchRound,
} from '~/data/game-types';

const PRAISE = ['太棒了！', '答对啦！', '真聪明！', '做得好！', '就是这个！'];
const RETRY = ['没关系，再想一想～', '再看看图，你可以的', '慢慢来，再试一次'];

/** 浏览器自带 TTS。关键点：
 *  1. voices 异步加载 → 提前缓存，speak 时绝不 await（await 会脱离用户手势栈被静音）
 *  2. iOS/Safari 等要求首次在用户手势同步栈内调用 speak 才解锁后续朗读 */
let cachedVoices: SpeechSynthesisVoice[] = [];
let audioUnlocked = false;

function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices() {
  if (!ttsSupported()) return;
  const got = speechSynthesis.getVoices();
  if (got.length) cachedVoices = got;
}

function primeVoices() {
  if (!ttsSupported()) return;
  refreshVoices();
  // voices 可能异步到达
  speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!cachedVoices.length) refreshVoices();
  return cachedVoices.find((v) => /zh|cmn|Chinese/i.test(v.lang + v.name));
}

/** 同步朗读——必须在用户手势栈内直接调用，不能被 await 打断 */
function speak(text: string) {
  if (!ttsSupported() || !text) return;
  try {
    speechSynthesis.cancel();
    speechSynthesis.resume(); // 解除 Chrome 偶发的 paused 卡死
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    u.pitch = 1.05;
    const zh = pickVoice();
    if (zh) u.voice = zh;
    speechSynthesis.speak(u);
    audioUnlocked = true;
  } catch {
    /* 不支持则静默 */
  }
}

/** 首次用户手势时解锁 TTS 通道：必须在手势同步栈内调用一次 speak。
 *  用极短真实文本 + 极低音量（空串在部分浏览器不触发 end，会堵队列）。 */
export function unlockTts() {
  if (!ttsSupported() || audioUnlocked) return;
  try {
    refreshVoices();
    speechSynthesis.resume(); // 解除可能的 paused 卡死态
    const u = new SpeechSynthesisUtterance('哦');
    u.volume = 0.01;
    u.rate = 2;
    const zh = pickVoice();
    if (zh) u.voice = zh;
    speechSynthesis.speak(u);
    audioUnlocked = true;
  } catch {
    /* ignore */
  }
}

export function GamePlayer({
  game,
  onExit,
}: {
  game: GameData;
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'retry'; msg: string } | null>(null);
  const [stars, setStars] = useState(0);
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rounds = game.rounds;
  const total = rounds.length;
  const round = rounds[idx];

  const isEmotion = game.gameType === 'emotion';
  const cap = round?.cap || '';
  const readText = isEmotion ? `${cap} 他现在是什么心情？` : cap;

  // 挂载即预加载语音列表（voices 异步，提前拉好首题才有声）
  useEffect(() => {
    primeVoices();
  }, []);

  // 进入每题自动朗读（首题因浏览器手势策略可能静音，属正常；点喇叭/答题后会解锁）
  useEffect(() => {
    if (!done && round) speak(readText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-cream-line bg-white p-10 text-center shadow-soft animate-fade-in">
        <div className="mb-2 animate-float text-6xl">🌈</div>
        <h2 className="text-2xl font-bold text-ink">全部完成啦！</h2>
        <p className="mt-1 text-sm text-ink-muted">
          在《{game.title}》里表现得很棒
        </p>
        <div className="mx-auto my-6 inline-flex items-center gap-2 rounded-2xl bg-clay-soft px-5 py-2.5 text-lg font-bold text-clay">
          <StarIcon /> +{stars} 颗星星
        </div>
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => {
              setIdx(0);
              setStars(0);
              setDone(false);
              setPicked(null);
              setFeedback(null);
            }}
          >
            再玩一次
          </Button>
          <Button variant="outline" onClick={onExit}>
            回到列表
          </Button>
        </div>
      </div>
    );
  }

  if (!round) return null;

  const options = round.options;

  function faceFor(opt: string): { emoji: string | null; label: string } {
    if (isEmotion) {
      // 情绪题：选项是大表情
      return { emoji: EMOTION_EMOJI[opt] || '🙂', label: opt };
    }
    // 配对题：选项用文字（选项不生图，减少出图时间）
    return { emoji: null, label: opt };
  }

  function choose(opt: string) {
    if (locked) return;
    if (opt === round.answer) {
      setLocked(true);
      setPicked(opt);
      setWrong(null);
      const msg = PRAISE[idx % PRAISE.length];
      setFeedback({ kind: 'ok', msg });
      setStars((s) => s + 1);
      speak(msg);
      flyStars();
    } else {
      // 无惩罚：只提示，不锁死、不扣星
      setWrong(opt);
      const msg = RETRY[idx % RETRY.length];
      setFeedback({ kind: 'retry', msg });
      speak(msg);
      setTimeout(() => setWrong(null), 600);
    }
  }

  function next() {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setLocked(false);
      setPicked(null);
      setWrong(null);
      setFeedback(null);
    } else {
      setDone(true);
      speak('全部完成啦，你真棒！');
    }
  }

  function flyStars() {
    const host = containerRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('div');
      s.textContent = '⭐';
      s.style.cssText = `position:fixed;left:${rect.left + rect.width / 2 - 14 + (i - 1) * 24}px;top:${rect.top + 40}px;font-size:28px;pointer-events:none;z-index:60;animation:starfly .9s ease-out forwards;animation-delay:${i * 0.08}s;`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  const sceneImg = round.imageUrl;
  const sceneEmoji = EMOTION_EMOJI[(round as EmotionRound).answer] || '🙂';

  return (
    <div ref={containerRef} className="mx-auto max-w-lg animate-fade-in">
      {/* 进度点 */}
      <div className="mb-4 flex gap-2">
        {rounds.map((_, i) => (
          <div
            key={i}
            className={
              'h-2 flex-1 rounded-full transition-colors ' +
              (i < idx ? 'bg-sage' : i === idx ? 'bg-clay' : 'bg-cream-line')
            }
          />
        ))}
      </div>

      {/* 情境卡 */}
      <div className="relative rounded-2xl bg-clay-soft p-6 text-center">
        <button
          onClick={() => speak(readText)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-clay shadow-soft active:scale-90"
          title="读一读"
          aria-label="读一读"
        >
          <SpeakerIcon />
        </button>
        <p className="mb-4 text-sm font-semibold text-ink-soft">
          {isEmotion ? '他现在是什么心情？' : '找出同一类 / 同颜色的'}
        </p>
        <div
          className={
            'mx-auto flex items-center justify-center overflow-hidden bg-white shadow-soft ' +
            (isEmotion ? 'h-36 w-36 rounded-full text-7xl' : 'h-36 w-36 rounded-2xl text-6xl')
          }
        >
          {sceneImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sceneImg} alt={cap} className="h-full w-full object-cover" />
          ) : isEmotion ? (
            <span>{sceneEmoji}</span>
          ) : (
            // 配对题无图时用目标物名字兜底
            <span className="px-2 text-center text-xl font-bold text-ink">
              {(round as MatchRound).label}
            </span>
          )}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{cap}</p>
      </div>

      {/* 选项 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {options.map((opt, i) => {
          const f = faceFor(opt);
          const isCorrect = locked && opt === picked;
          const isWrong = wrong === opt;
          const dim = locked && opt !== picked;
          return (
            <button
              key={i}
              onClick={() => choose(opt)}
              disabled={dim}
              className={
                'flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all active:scale-95 ' +
                (isCorrect
                  ? 'border-sage bg-sage-soft'
                  : isWrong
                  ? 'border-[#e0b45b] bg-[#faf1dd] animate-game-shake'
                  : dim
                  ? 'border-cream-line opacity-40'
                  : 'border-cream-line bg-white hover:border-clay')
              }
            >
              {f.emoji ? (
                <>
                  <span className="text-4xl leading-none">{f.emoji}</span>
                  <span className="text-sm font-semibold text-ink-soft">{f.label}</span>
                </>
              ) : (
                // 配对题选项：无图，文字放大更醒目
                <span className="text-lg font-bold text-ink">{f.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 反馈 */}
      <div className="mt-4 flex min-h-[56px] flex-col items-center justify-center gap-2 text-center">
        {feedback && (
          <p
            className={
              'text-base font-bold ' +
              (feedback.kind === 'ok' ? 'text-sage' : 'text-[#c88a2e]')
            }
          >
            {feedback.kind === 'ok' ? '🎉' : '🤔'} {feedback.msg}
          </p>
        )}
        {locked && (
          <Button className="px-7" onClick={next}>
            {idx < total - 1 ? '下一个 →' : '完成 ✓'}
          </Button>
        )}
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
