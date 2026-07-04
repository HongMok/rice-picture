'use client';

import { useEffect, useRef } from 'react';

export type CursorShape = 'hammer' | 'net';

/** 游戏区域内的“道具光标”：鼠标/触点变成卡通锤子或捕虫网，
 *  跟随移动；每次点击瞬间加一个挥拍动画。
 *
 *  用法：把它作为 arena 容器的直接子孙即可（container 需要 relative）。
 *  它会自动监听父级 pointermove/pointerdown，并把原生 cursor 隐藏。 */
export function GameCursor({
  shape,
  size = 96,
}: {
  shape: CursorShape;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 锤子锚点在锤面中心；网锚点在网口正中。挥拍旋转中心也用同一点。
  const anchor = shape === 'hammer' ? { x: 0.3, y: 0.28 } : { x: 0.42, y: 0.4 };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const arena = el.parentElement;
    if (!arena) return;

    const prevCursor = arena.style.cursor;
    arena.style.cursor = 'none';

    el.style.opacity = '0';

    function place(x: number, y: number) {
      if (!el || !arena) return;
      const r = arena.getBoundingClientRect();
      const dx = x - r.left;
      const dy = y - r.top;
      if (dx < 0 || dy < 0 || dx > r.width || dy > r.height) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = '1';
      el.style.transform = `translate(${dx - size * anchor.x}px, ${dy - size * anchor.y}px)`;
    }

    function onMove(e: PointerEvent) {
      place(e.clientX, e.clientY);
    }
    function onDown(e: PointerEvent) {
      place(e.clientX, e.clientY);
      if (!el) return;
      el.classList.remove('game-cursor-swing');
      // 强制 reflow 以重启动画
      void el.offsetWidth;
      el.classList.add('game-cursor-swing');
    }
    function onLeave() {
      if (el) el.style.opacity = '0';
    }

    arena.addEventListener('pointermove', onMove);
    arena.addEventListener('pointerdown', onDown);
    arena.addEventListener('pointerleave', onLeave);
    return () => {
      arena.removeEventListener('pointermove', onMove);
      arena.removeEventListener('pointerdown', onDown);
      arena.removeEventListener('pointerleave', onLeave);
      arena.style.cursor = prevCursor;
    };
  }, [anchor.x, anchor.y, size]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-40 select-none"
      style={{
        width: size,
        height: size,
        transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
        transition: 'opacity 120ms',
        filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.22))',
      }}
    >
      {shape === 'hammer' ? <HammerSvg /> : <NetSvg />}
    </div>
  );
}

/* ============================================================
 * 玩具锤：Japandi 陶土色调（ember），温柔卡通，非饱和粉红
 * ============================================================ */
function HammerSvg() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
      {/* 木柄：从锤头背面伸向右下 */}
      <g transform="rotate(28 30 28)">
        <rect
          x="26"
          y="30"
          width="10"
          height="72"
          rx="5"
          fill="#D6C4A6"
          stroke="#7A6A54"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="28" y="34" width="2.5" height="58" rx="1.2" fill="#EAD9B9" opacity="0.85" />
        <circle cx="31" cy="102" r="7" fill="#D6C4A6" stroke="#7A6A54" strokeWidth="2" />
      </g>

      {/* 锤头：陶土色（ember 家族） */}
      <g>
        <rect
          x="4"
          y="14"
          width="52"
          height="30"
          rx="14"
          fill="#C97A5B"
          stroke="#7A4A32"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* 端部环带 */}
        <path d="M15 18 Q12 29 15 40" stroke="#7A4A32" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M45 18 Q48 29 45 40" stroke="#7A4A32" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* 高光 */}
        <path
          d="M12 22 Q22 16 34 17"
          stroke="#FAF7F2"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        <ellipse cx="24" cy="26" rx="6" ry="3.2" fill="#F5D2BE" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ============================================================
 * 捕虫网：Japandi sage 色系网面 + 米白木柄圈 + 温柔描边
 * ============================================================ */
function NetSvg() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
      <defs>
        <radialGradient id="netMesh" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FAF7F2" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B4CBB1" stopOpacity="0.65" />
        </radialGradient>
      </defs>

      {/* 木柄 */}
      <path
        d="M60 55 Q78 68 92 92"
        stroke="#D6C4A6"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 55 Q78 68 92 92"
        stroke="#7A6A54"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="92" cy="92" r="6.5" fill="#D6C4A6" stroke="#7A6A54" strokeWidth="2" />

      {/* 固定环 */}
      <ellipse
        cx="60"
        cy="53"
        rx="7"
        ry="5"
        transform="rotate(30 60 53)"
        fill="#C7B48A"
        stroke="#7A6A54"
        strokeWidth="2"
      />

      {/* 网袋 */}
      <ellipse cx="42" cy="42" rx="28" ry="26" fill="url(#netMesh)" />

      {/* 网格 */}
      <g stroke="#5E8A6E" strokeWidth="1.2" fill="none" opacity="0.5" strokeLinecap="round">
        <line x1="42" y1="16" x2="42" y2="68" />
        <line x1="14" y1="42" x2="70" y2="42" />
        <line x1="22" y1="22" x2="62" y2="62" />
        <line x1="22" y1="62" x2="62" y2="22" />
        <ellipse cx="42" cy="42" rx="20" ry="19" />
        <ellipse cx="42" cy="42" rx="10" ry="9" />
      </g>

      {/* 金属圈 */}
      <ellipse cx="42" cy="42" rx="28" ry="26" fill="none" stroke="#8FA98F" strokeWidth="4" />
      <ellipse cx="42" cy="42" rx="28" ry="26" fill="none" stroke="#3E3A36" strokeWidth="1.6" />

      {/* 高光 */}
      <path
        d="M20 30 Q28 18 46 16"
        stroke="#FAF7F2"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}
