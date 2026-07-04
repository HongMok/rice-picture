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

/** 从 (fromX, fromY) 屏幕坐标飞多枚金币到 targetSelector 所指 DOM 中心。
 *  到达时抖动 target 并调用 onLanded（用于播放收集音、更新数字动画等）。 */
export function spawnCoinFly({
  fromX,
  fromY,
  targetEl,
  count = 5,
  onLanded,
}: {
  fromX: number;
  fromY: number;
  targetEl: HTMLElement | null;
  count?: number;
  onLanded?: () => void;
}) {
  if (typeof document === 'undefined' || !targetEl) return;
  const tRect = targetEl.getBoundingClientRect();
  const tx = tRect.left + tRect.width / 2;
  const ty = tRect.top + tRect.height / 2;

  for (let i = 0; i < count; i++) {
    const coin = document.createElement('div');
    coin.textContent = '🪙';
    const dx = tx - fromX;
    const dy = ty - fromY;
    // 抛物线：中途峰值 y 抬升
    const peakOffset = -60 - Math.random() * 40;
    const jitterX = (Math.random() - 0.5) * 60;
    const delay = i * 60;
    coin.style.cssText = [
      'position:fixed',
      `left:${fromX}px`,
      `top:${fromY}px`,
      'transform:translate(-50%,-50%)',
      'font-size:26px',
      'pointer-events:none',
      'z-index:65',
      `--dx:${dx}px`,
      `--dy:${dy}px`,
      `--jx:${jitterX}px`,
      `--peak:${peakOffset}px`,
      `animation:game-coin-fly 650ms cubic-bezier(0.4,0.05,0.55,0.95) forwards`,
      `animation-delay:${delay}ms`,
    ].join(';');
    document.body.appendChild(coin);
    const life = 650 + delay + 50;
    window.setTimeout(() => coin.remove(), life);
  }
  // 最后一枚落定时抖动目标 + 回调
  const totalMs = 650 + (count - 1) * 60;
  window.setTimeout(() => {
    if (targetEl.isConnected) {
      targetEl.classList.remove('game-hud-pulse');
      void targetEl.offsetWidth;
      targetEl.classList.add('game-hud-pulse');
    }
    onLanded?.();
  }, totalMs);
}

/** 胜利时的彩带 + 礼花：从屏幕左右两侧上方射入的彩纸碎片。
 *  container 通常传游戏容器 ref；不传则用 window。 */
export function spawnConfetti(container?: HTMLElement | null, count = 90) {
  if (typeof document === 'undefined') return;
  const rect = container?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const top = rect ? rect.top : 0;
  const width = rect ? rect.width : window.innerWidth;
  const height = rect ? rect.height : window.innerHeight;

  const colors = ['#F35C89', '#F0C36D', '#8FA98F', '#6D8B90', '#C97A5B', '#F5D2BE', '#B4CBB1', '#EAD9B9'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    // 从顶部左右两侧偏上向下撒
    const fromLeft = i % 2 === 0;
    const startX = fromLeft
      ? cx - width / 2 - 20 + Math.random() * 60
      : cx + width / 2 - 40 - Math.random() * 60;
    const startY = top - 30 + Math.random() * 20;
    const driftX = fromLeft
      ? width * (0.3 + Math.random() * 0.7)
      : -width * (0.3 + Math.random() * 0.7);
    const driftY = height * (0.55 + Math.random() * 0.4);
    const rot = Math.floor(Math.random() * 720 - 360);
    const size = 6 + Math.random() * 8;
    const isRibbon = Math.random() < 0.4;
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = [
      'position:fixed',
      `left:${startX}px`,
      `top:${startY}px`,
      'transform:translate(-50%,-50%)',
      isRibbon
        ? `width:${size * 1.6}px;height:${size * 0.4}px;background:${color};border-radius:2px`
        : `width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() < 0.5 ? '50%' : '2px'}`,
      'pointer-events:none',
      'z-index:70',
      `--cx:${driftX}px`,
      `--cy:${driftY}px`,
      `--rot:${rot}deg`,
      `animation:game-confetti ${1600 + Math.random() * 1400}ms cubic-bezier(0.15,0.6,0.35,1) forwards`,
      `animation-delay:${Math.random() * 350}ms`,
    ].join(';');
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 3500);
  }
}

/** 中心礼花：从中心向外辐射的星星/圆点，配合彩带用 */
export function spawnFireworks(container?: HTMLElement | null, bursts = 3) {
  if (typeof document === 'undefined') return;
  const rect = container?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

  const palettes = [
    ['#F0C36D', '#F5D2BE', '#FFFFFF'],
    ['#F35C89', '#F0A9B6', '#FFFFFF'],
    ['#8FA98F', '#B4CBB1', '#F5E5DC'],
  ];
  for (let b = 0; b < bursts; b++) {
    const bx = cx + (Math.random() - 0.5) * (rect ? rect.width * 0.4 : 200);
    const by = cy + (Math.random() - 0.5) * (rect ? rect.height * 0.3 : 150) - 60;
    const palette = palettes[b % palettes.length];
    const particles = 14;
    for (let i = 0; i < particles; i++) {
      const angle = (Math.PI * 2 * i) / particles;
      const radius = 80 + Math.random() * 40;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      const el = document.createElement('div');
      const size = 6 + Math.random() * 4;
      el.style.cssText = [
        'position:fixed',
        `left:${bx}px`,
        `top:${by}px`,
        `width:${size}px`,
        `height:${size}px`,
        `background:${palette[i % palette.length]}`,
        'border-radius:9999px',
        'transform:translate(-50%,-50%)',
        'pointer-events:none',
        'z-index:66',
        `--px:${dx}px`,
        `--py:${dy}px`,
        `box-shadow:0 0 6px ${palette[i % palette.length]}`,
        `animation:game-firework 900ms ease-out forwards`,
        `animation-delay:${b * 220}ms`,
      ].join(';');
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 1200 + b * 220);
    }
  }
}

/** 屏幕中央显示 "连击 ×N!" 标签（自动淡出） */
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
