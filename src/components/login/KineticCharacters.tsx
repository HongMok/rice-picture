'use client';

import { useEffect, useRef } from 'react';

/**
 * 会做表情的卡通角色群（复刻 kinetic-auth 交互，配色改为米图暖色系）。
 * - idle：眼珠跟随鼠标（atan2 角度 → translate）
 * - typing：聚焦邮箱/悬停时，嘴巴变圆
 * - side：悬停密码框，眼珠左移 + 侧嘴
 * - closed：聚焦密码框，闭眼
 * - surprise：校验失败，睁大眼 + 张嘴 + 抖动
 * - submit：悬停登录/成功，开心眯眼 + 微笑
 */
export type Reaction =
  | 'idle'
  | 'typing'
  | 'side'
  | 'closed'
  | 'surprise'
  | 'submit';

type Variant = 'rectangle' | 'box' | 'semicircle' | 'cylinder';

function eyeMode(reaction: Reaction): string {
  switch (reaction) {
    case 'side':
      return 'side';
    case 'closed':
      return 'closed';
    case 'surprise':
      return 'surprise';
    case 'submit':
      return 'happy';
    default:
      return 'track';
  }
}

function Eye({ mode }: { mode: string }) {
  const pupil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== 'track') return;
    const move = (e: MouseEvent) => {
      const el = pupil.current;
      if (!el || !el.parentElement) return;
      const rect = el.parentElement.getBoundingClientRect();
      const angle = Math.atan2(
        e.clientY - (rect.top + rect.height / 2),
        e.clientX - (rect.left + rect.width / 2)
      );
      const r = 5;
      el.style.transform = `translate(${Math.cos(angle) * r}px, ${
        Math.sin(angle) * r
      }px)`;
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mode]);

  return (
    <div className={`km-eye ${mode}`}>
      <div ref={pupil} className="km-pupil" />
    </div>
  );
}

function Character({
  reaction,
  color,
  variant,
  tilted,
}: {
  reaction: Reaction;
  color: string;
  variant: Variant;
  tilted: boolean;
}) {
  const m = eyeMode(reaction);
  return (
    <div
      className={`km-char km-${variant} ${tilted ? 'km-tilted' : ''}`}
      style={{ backgroundColor: color }}
    >
      <div className="km-eyes">
        <Eye mode={m} />
        <Eye mode={m} />
      </div>
      <div className={`km-mouth km-${reaction}`} />
    </div>
  );
}

// 米图暖色系四色
const COLORS = {
  rectangle: '#c96a3c', // 深陶橙
  box: '#8a5a3c', // 暖棕
  semicircle: '#7fa27e', // 柔绿
  cylinder: '#e6b34a', // 暖黄
};

export function KineticCharacters({
  reaction,
  tilted,
}: {
  reaction: Reaction;
  tilted: boolean;
}) {
  return (
    <div className="km-scene">
      <div style={{ position: 'absolute', bottom: 120, left: 30, zIndex: 1 }}>
        <Character reaction={reaction} color={COLORS.rectangle} variant="rectangle" tilted={tilted} />
      </div>
      <div style={{ position: 'absolute', bottom: 84, left: 170, zIndex: 2 }}>
        <Character reaction={reaction} color={COLORS.box} variant="box" tilted={tilted} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 50, zIndex: 3 }}>
        <Character reaction={reaction} color={COLORS.semicircle} variant="semicircle" tilted={tilted} />
      </div>
      <div style={{ position: 'absolute', bottom: 40, left: 220, zIndex: 4 }}>
        <Character reaction={reaction} color={COLORS.cylinder} variant="cylinder" tilted={tilted} />
      </div>
    </div>
  );
}
