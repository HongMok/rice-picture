// 游戏内视觉反馈：飘字、粒子、连击标签。都用 imperative DOM 注入，
// 好处是不与游戏主体 React state 耦合，也不会因为高频重渲抖动。
// 用法：在事件位置调用 spawnFloatText/spawnParticles，一次一撒即可。

/** 在指定屏幕坐标飘出一段浮字（如 "+10 🪙"），淡入上浮后消失 */
export function spawnFloatText(x: number, y: number, text: string, color = '#7FA98B') {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = [
    'position:fixed',
    `left:${x}px`,
    `top:${y}px`,
    'transform:translate(-50%,-50%)',
    'font-weight:600',
    'font-size:22px',
    `color:${color}`,
    'text-shadow:0 1px 3px rgba(255,255,255,0.85), 0 0 6px rgba(255,255,255,0.4)',
    'pointer-events:none',
    'z-index:60',
    'animation:game-float-text 900ms ease-out forwards',
  ].join(';');
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

/** 在指定屏幕坐标撒出一小簇彩色粒子（碰撞粉尘） */
export function spawnParticles(x: number, y: number, count = 8, colors?: string[]) {
  if (typeof document === 'undefined') return;
  const palette = colors && colors.length > 0
    ? colors
    : ['#E8A5C0', '#8FC9B8', '#F0C36D', '#9BB8E8', '#D99BD9'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
    const dist = 40 + Math.random() * 30;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 10; // 稍微偏上
    const el = document.createElement('div');
    const size = 6 + Math.random() * 5;
    el.style.cssText = [
      'position:fixed',
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      `background:${palette[i % palette.length]}`,
      'border-radius:9999px',
      'transform:translate(-50%,-50%)',
      'pointer-events:none',
      'z-index:59',
      `--px:${dx}px`,
      `--py:${dy}px`,
      'animation:game-particle 700ms ease-out forwards',
    ].join(';');
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 800);
  }
}

/** 屏幕中央显示 “连击 ×N!” 标签（自动淡出） */
export function spawnComboBadge(container: HTMLElement | null, comboLevel: number) {
  const host = container ?? document.body;
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const el = document.createElement('div');
  el.textContent = `连击 ×${comboLevel}!`;
  el.style.cssText = [
    'position:fixed',
    `left:${rect.left + rect.width / 2}px`,
    `top:${rect.top + rect.height * 0.35}px`,
    'transform:translate(-50%,-50%)',
    'font-weight:700',
    'font-size:32px',
    'color:#F0C36D',
    'text-shadow:0 2px 6px rgba(0,0,0,0.15), 0 0 12px rgba(240,195,109,0.6)',
    'pointer-events:none',
    'z-index:61',
    'animation:game-combo-pop 750ms ease-out forwards',
  ].join(';');
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 800);
}
