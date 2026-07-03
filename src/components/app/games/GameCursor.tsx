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
 * 玩具锤：斜握角度的粉红双头槌 + 圆柄，头上带白色心形高光
 * 全部走 viewBox 100x100，配合 anchor.x=0.3 / anchor.y=0.28 让锤面对准命中点
 * ============================================================ */
function HammerSvg() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
      {/* 木柄：从锤头背面伸向右下 */}
      <g transform="rotate(28 30 28)">
        {/* 柄阴影 */}
        <rect x="26" y="30" width="10" height="72" rx="5" fill="#B67540" />
        {/* 柄主体 */}
        <rect x="26" y="30" width="10" height="72" rx="5" fill="#D89C5A" stroke="#5C3A1A" strokeWidth="3" strokeLinejoin="round" />
        {/* 柄上高光 */}
        <rect x="28" y="34" width="3" height="60" rx="1.5" fill="#F2C58A" opacity="0.8" />
        {/* 握把末端小珠 */}
        <circle cx="31" cy="102" r="7" fill="#D89C5A" stroke="#5C3A1A" strokeWidth="3" />
        <circle cx="29" cy="100" r="2" fill="#F2C58A" opacity="0.9" />
      </g>

      {/* 锤头主体（横向胶囊 / 圆头双端） */}
      <g>
        {/* 锤头底影 */}
        <ellipse cx="30" cy="34" rx="26" ry="16" fill="#C63C6E" />
        {/* 锤头本体 */}
        <rect
          x="4"
          y="14"
          width="52"
          height="30"
          rx="15"
          fill="#F35C89"
          stroke="#8A2149"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* 左右两端的“环带” */}
        <path
          d="M14 18 Q11 29 14 40"
          stroke="#8A2149"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M46 18 Q49 29 46 40"
          stroke="#8A2149"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* 环带内侧金属带 */}
        <rect x="10" y="18" width="4" height="22" rx="1.5" fill="#FBBACC" opacity="0.85" />
        <rect x="46" y="18" width="4" height="22" rx="1.5" fill="#C63C6E" opacity="0.4" />

        {/* 顶部高光：一条弧线 + 心形亮点 */}
        <path
          d="M14 22 Q22 16 34 17"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        {/* 心形高光：两小圆 + 三角 */}
        <g fill="#FFFFFF" opacity="0.95">
          <circle cx="22" cy="25" r="2.4" />
          <circle cx="27" cy="25" r="2.4" />
          <path d="M20 26.5 L29 26.5 L24.5 32 Z" />
        </g>
      </g>
    </svg>
  );
}

/* ============================================================
 * 卡通捕虫网：金色圆环 + 半透明浅绿网面（径向 + 环向网格）+ 弯木柄
 * anchor.x=0.42 / anchor.y=0.4 使网口中心对准命中点
 * ============================================================ */
function NetSvg() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
      <defs>
        <radialGradient id="netMesh" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#F4FBEF" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#BFE1C5" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7FB894" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id="ringMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F6D97A" />
          <stop offset="50%" stopColor="#E4A93A" />
          <stop offset="100%" stopColor="#A56E17" />
        </linearGradient>
        <linearGradient id="handleWood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B67540" />
          <stop offset="50%" stopColor="#D89C5A" />
          <stop offset="100%" stopColor="#B67540" />
        </linearGradient>
      </defs>

      {/* 木柄：从网口右下弧线延伸到右下角 */}
      <path
        d="M60 55 Q78 68 92 92"
        stroke="url(#handleWood)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 55 Q78 68 92 92"
        stroke="#5C3A1A"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* 柄末小把手（防握滑） */}
      <circle cx="92" cy="92" r="7.5" fill="#D89C5A" stroke="#5C3A1A" strokeWidth="3" />
      <circle cx="90" cy="90" r="2" fill="#F2C58A" opacity="0.9" />

      {/* 网口与柄之间的固定环 */}
      <ellipse
        cx="60"
        cy="53"
        rx="8"
        ry="6"
        transform="rotate(30 60 53)"
        fill="#8A6634"
        stroke="#5C3A1A"
        strokeWidth="2.5"
      />

      {/* 网袋主体（比网口略窄的椭圆，代表纵深） */}
      <ellipse cx="42" cy="42" rx="30" ry="28" fill="url(#netMesh)" />

      {/* 网格：径向 8 根 + 环向 3 圈 */}
      <g stroke="#3E5A44" strokeWidth="1.3" fill="none" opacity="0.55" strokeLinecap="round">
        <line x1="42" y1="14" x2="42" y2="70" />
        <line x1="12" y1="42" x2="72" y2="42" />
        <line x1="22" y1="22" x2="62" y2="62" />
        <line x1="22" y1="62" x2="62" y2="22" />
        <line x1="16" y1="30" x2="68" y2="54" />
        <line x1="16" y1="54" x2="68" y2="30" />
        <ellipse cx="42" cy="42" rx="22" ry="20.5" />
        <ellipse cx="42" cy="42" rx="14" ry="13" />
        <ellipse cx="42" cy="42" rx="6" ry="5.5" />
      </g>

      {/* 金属圆环（网口）—— 用金色渐变 + 深色描边表现立体 */}
      <ellipse
        cx="42"
        cy="42"
        rx="30"
        ry="28"
        fill="none"
        stroke="url(#ringMetal)"
        strokeWidth="6"
      />
      <ellipse
        cx="42"
        cy="42"
        rx="30"
        ry="28"
        fill="none"
        stroke="#7A4C0A"
        strokeWidth="2"
      />

      {/* 网口高光 */}
      <path
        d="M20 30 Q28 18 46 15"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      <path
        d="M62 28 Q66 34 66 40"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}
