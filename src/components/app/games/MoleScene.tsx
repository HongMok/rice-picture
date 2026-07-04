'use client';

/* 打地鼠：卡通田野场景与角色 SVG。
 * 视觉基准：Japandi 治愈风（低饱和、暖米白底、雅致绿+水绿+陶土点缀），
 * 与产品其它模块（VideoStudio / LessonPlan 等）配色一致。 */

import type { CSSProperties, ReactNode } from 'react';

/* -------------------- 全屏背景（借鉴 Beipy H5 构图，Japandi 化） --------------------
 * 上半：paper 天空 + sage 远山 + 松树 + 米色小屋（"米图康复乐园"横幅）
 * 中段：鹅卵石小路 + 三丛远景树
 * 下半：大片 sage 草地 + 水彩笔刷纹理
 */
export function FieldBackground({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3F0E9" />
          <stop offset="60%" stopColor="#E7EEEF" />
          <stop offset="100%" stopColor="#DDE9E4" />
        </linearGradient>
        <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CCDBD3" />
          <stop offset="100%" stopColor="#A9C1B4" />
        </linearGradient>
        <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B4CBB1" />
          <stop offset="100%" stopColor="#8FA98F" />
        </linearGradient>
        <linearGradient id="grassBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B7CDB4" />
          <stop offset="60%" stopColor="#A2BC9F" />
          <stop offset="100%" stopColor="#8DAA8A" />
        </linearGradient>
        <pattern id="grassStrokes" x="0" y="0" width="80" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M0 22 Q20 16 40 22 T80 22"
            stroke="#8FA98F"
            strokeWidth="1.2"
            fill="none"
            opacity="0.35"
          />
        </pattern>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="1600" height="470" fill="url(#skyGrad)" />

      {/* 薄云 */}
      <g fill="#FFFFFF" opacity="0.55">
        <ellipse cx="220" cy="110" rx="130" ry="10" />
        <ellipse cx="700" cy="70" rx="180" ry="12" />
        <ellipse cx="1280" cy="130" rx="150" ry="10" />
      </g>

      {/* 远山（水绿） */}
      <path
        d="M0 380 Q160 300 320 350 T640 340 T960 360 T1280 320 T1600 350 L1600 470 L0 470 Z"
        fill="url(#hillFar)"
      />

      {/* 松树剪影带（远景，低对比） */}
      <g fill="#6E8A6E" opacity="0.55">
        {Array.from({ length: 26 }).map((_, i) => {
          const x = 20 + i * 62;
          const h = 60 + (i % 4) * 12;
          return (
            <path
              key={i}
              d={`M${x} ${430 - h} L${x - 16} ${430} L${x + 16} ${430} Z`}
            />
          );
        })}
      </g>

      {/* 左侧一丛近景树（水彩笔触感） */}
      <g transform="translate(60 300)">
        <ellipse cx="60" cy="120" rx="70" ry="30" fill="#3E3A36" opacity="0.08" />
        <path
          d="M0 100 Q-10 60, 20 40 Q30 10, 70 20 Q120 0, 130 40 Q160 55, 140 100 Q120 130, 60 130 Z"
          fill="#8FA98F"
          stroke="#5E8A6E"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M20 60 Q40 40 60 55 M80 45 Q100 55 110 75"
          stroke="#5E8A6E"
          strokeWidth="1.6"
          fill="none"
          opacity="0.5"
        />
        <rect x="55" y="130" width="14" height="30" rx="2" fill="#7A6A54" />
      </g>

      {/* 右侧「米图康复乐园」小屋 */}
      <g transform="translate(1100 280)">
        {/* 屋身 */}
        <rect x="0" y="50" width="300" height="120" rx="6" fill="#C97A5B" stroke="#7A4A32" strokeWidth="3" />
        {/* 屋顶 */}
        <path d="M-20 50 L150 -20 L320 50 Z" fill="#A65F44" stroke="#5C3A1A" strokeWidth="3" strokeLinejoin="round" />
        {/* 屋顶横幅 */}
        <rect x="30" y="55" width="240" height="26" rx="4" fill="#F5E5DC" stroke="#7A4A32" strokeWidth="2" />
        <text
          x="150"
          y="74"
          textAnchor="middle"
          fontFamily="'Noto Serif SC', serif"
          fontSize="18"
          fontWeight="600"
          fill="#5C3A1A"
        >
          米图康复乐园
        </text>
        {/* 门 */}
        <rect x="130" y="110" width="40" height="60" rx="4" fill="#7A4A32" stroke="#4A2A16" strokeWidth="2" />
        <circle cx="160" cy="140" r="2.5" fill="#F5D2BE" />
        {/* 窗 */}
        <rect x="30" y="105" width="50" height="38" rx="4" fill="#F5E5DC" stroke="#7A4A32" strokeWidth="2" />
        <path d="M55 105 L55 143 M30 124 L80 124" stroke="#7A4A32" strokeWidth="1.5" />
        <rect x="220" y="105" width="50" height="38" rx="4" fill="#F5E5DC" stroke="#7A4A32" strokeWidth="2" />
        <path d="M245 105 L245 143 M220 124 L270 124" stroke="#7A4A32" strokeWidth="1.5" />
        {/* 屋顶后一棵大树 */}
        <g transform="translate(220 -80)">
          <ellipse cx="0" cy="60" rx="46" ry="16" fill="#3E3A36" opacity="0.08" />
          <path
            d="M-40 40 Q-50 0, -10 -10 Q0 -40, 30 -20 Q80 -30, 60 20 Q60 50, 30 50 Q-30 50, -40 40 Z"
            fill="#8FA98F"
            stroke="#5E8A6E"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="10" y="50" width="12" height="24" rx="2" fill="#7A6A54" />
        </g>
      </g>

      {/* 中景近山（sage） */}
      <path
        d="M0 470 Q220 400 460 440 T900 430 T1300 420 T1600 450 L1600 500 L0 500 Z"
        fill="url(#hillMid)"
      />

      {/* 鹅卵石小路（沿着中景弯到画面左） */}
      <path
        d="M900 500 Q700 490 500 500 Q300 520 100 500 L100 540 Q300 560 500 540 Q700 530 900 540 Z"
        fill="#D6C4A6"
        stroke="#7A6A54"
        strokeWidth="2"
      />
      <g fill="#EAD9B9">
        {[140, 220, 300, 380, 460, 540, 620, 700, 780, 860].map((x) => (
          <ellipse key={x} cx={x} cy={520} rx={12} ry={5} />
        ))}
      </g>

      {/* 前草地 */}
      <rect x="0" y="500" width="1600" height="400" fill="url(#grassBase)" />
      <rect x="0" y="500" width="1600" height="400" fill="url(#grassStrokes)" />

      {/* 水彩「刷痕」层：两条深绿弧带 */}
      <path
        d="M0 620 Q400 590 800 620 T1600 620 L1600 670 L0 670 Z"
        fill="#9CBC9A"
        opacity="0.45"
      />
      <path
        d="M0 760 Q400 730 800 760 T1600 760 L1600 810 L0 810 Z"
        fill="#8FAA8B"
        opacity="0.5"
      />

      {/* 散落小草簇 */}
      <g stroke="#5E8A6E" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5">
        {[80, 200, 320, 460, 620, 780, 940, 1100, 1240, 1420, 1560].map((x, i) => (
          <g key={i} transform={`translate(${x} ${600 + (i % 3) * 55})`}>
            <path d="M0 0 L-5 -12" />
            <path d="M0 0 L0 -14" />
            <path d="M0 0 L5 -12" />
          </g>
        ))}
      </g>

      {/* 左下角小花 */}
      <g transform="translate(60 850)">
        <path d="M0 0 C -8 -26, 6 -44, 22 -36 C 8 -18, 10 -6, 0 0" fill="#8FA98F" />
        <g transform="translate(28 -36)">
          <g fill="#FAF7F2">
            <ellipse cx="0" cy="-9" rx="3.5" ry="7" />
            <ellipse cx="0" cy="9" rx="3.5" ry="7" />
            <ellipse cx="-9" cy="0" rx="7" ry="3.5" />
            <ellipse cx="9" cy="0" rx="7" ry="3.5" />
          </g>
          <circle cx="0" cy="0" r="3" fill="#C97A5B" />
        </g>
      </g>

      {/* 右下角小蘑菇（换个物件避免重复） */}
      <g transform="translate(1520 850)">
        <path d="M-20 0 Q-20 -22 0 -30 Q20 -22 20 0 Z" fill="#C97A5B" stroke="#7A4A32" strokeWidth="2" />
        <g fill="#FAF7F2">
          <circle cx="-8" cy="-16" r="3" />
          <circle cx="6" cy="-20" r="3.5" />
          <circle cx="10" cy="-10" r="2.5" />
        </g>
        <rect x="-5" y="0" width="10" height="14" rx="3" fill="#F5E5DC" stroke="#7A4A32" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/* -------------------- 泥堆（陶土色 + 边缘小草） --------------------
 * 借鉴 Beipy H5 水彩泥堆：立体感 + 顶部草丛 + 深色洞口。 */
export function MoundSvg({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 110" width="100%" height="100%" className={className} style={style} aria-hidden>
      {/* 投影 */}
      <ellipse cx="100" cy="100" rx="90" ry="7" fill="#3E3A36" opacity="0.16" />

      {/* 泥堆主体（不规则手绘形） */}
      <path
        d="M10 78
           C 14 52, 40 38, 70 44
           C 88 30, 112 30, 130 42
           C 156 36, 182 50, 190 74
           C 190 90, 150 96, 100 96
           C 50 96, 12 92, 10 78 Z"
        fill="#C97A5B"
        stroke="#7A4A32"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 顶部深色椭圆洞口，营造"地鼠从洞里探头"的立体感 */}
      <ellipse cx="100" cy="58" rx="42" ry="12" fill="#4A2A16" />
      <ellipse cx="100" cy="55" rx="38" ry="9" fill="#3E1F0E" opacity="0.7" />

      {/* 泥堆浅色高光块（顶部两侧） */}
      <g fill="#DE9678" opacity="0.85">
        <path d="M22 74 Q30 60, 46 62 Q40 78, 24 80 Z" />
        <path d="M170 78 Q158 62, 148 66 Q160 82, 174 82 Z" />
      </g>

      {/* 洞口边小草（sage 系，呼应 B 泥堆边的绿草） */}
      <g stroke="#5E8A6E" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M60 52 L58 40 M64 52 L68 42" />
        <path d="M138 52 L136 42 M142 52 L148 40" />
      </g>
      {/* 侧面小草丛 */}
      <g fill="#8FA98F" stroke="#5E8A6E" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M18 74 Q14 62, 26 60 Q32 68, 30 76 Z" />
        <path d="M182 74 Q186 62, 174 60 Q168 68, 170 76 Z" />
      </g>

      {/* 底部散落小颗粒 */}
      <g fill="#DE9678" opacity="0.8">
        <circle cx="34" cy="90" r="2.5" />
        <circle cx="46" cy="94" r="2" />
        <circle cx="158" cy="94" r="2.5" />
        <circle cx="170" cy="90" r="2" />
      </g>
    </svg>
  );
}

/* -------------------- 地鼠 -------------------- */
/** 卡通地鼠：暖灰身、米白肚皮、粉腮，柔和描边。state='hit' 闭眼笑。 */
export function MoleSvg({
  state = 'peek',
  className,
  style,
}: {
  state?: 'peek' | 'hit';
  className?: string;
  style?: CSSProperties;
}) {
  const hit = state === 'hit';
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id="moleBody" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#7A756E" />
          <stop offset="100%" stopColor="#4A4640" />
        </radialGradient>
        <radialGradient id="moleBelly" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#EFEAE0" />
          <stop offset="100%" stopColor="#D6CFC1" />
        </radialGradient>
        <radialGradient id="moleFace" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#F5EFE1" />
          <stop offset="100%" stopColor="#E4DAC6" />
        </radialGradient>
      </defs>

      <g transform={hit ? 'rotate(-5 100 130)' : 'rotate(0 100 130)'}>
        {/* 身体 */}
        <ellipse cx="100" cy="132" rx="70" ry="66" fill="url(#moleBody)" stroke="#3E3A36" strokeWidth="2.5" />
        {/* 肚皮 */}
        <ellipse cx="100" cy="150" rx="38" ry="32" fill="url(#moleBelly)" />

        {/* 左爪 */}
        <g transform="translate(40 120)">
          <ellipse cx="0" cy="0" rx="15" ry="13" fill="#5E5852" stroke="#3E3A36" strokeWidth="2" />
          <circle cx="-9" cy="-2" r="3" fill="#F0C7CE" />
          <circle cx="-3" cy="-6" r="3" fill="#F0C7CE" />
          <circle cx="4" cy="-6" r="3" fill="#F0C7CE" />
        </g>
        {/* 右爪 */}
        <g transform="translate(160 120)">
          <ellipse cx="0" cy="0" rx="15" ry="13" fill="#5E5852" stroke="#3E3A36" strokeWidth="2" />
          <circle cx="9" cy="-2" r="3" fill="#F0C7CE" />
          <circle cx="3" cy="-6" r="3" fill="#F0C7CE" />
          <circle cx="-4" cy="-6" r="3" fill="#F0C7CE" />
        </g>

        {/* 头部 */}
        <ellipse cx="100" cy="112" rx="46" ry="38" fill="#5E5852" stroke="#3E3A36" strokeWidth="2.5" />
        {/* 面部 */}
        <ellipse cx="100" cy="120" rx="32" ry="24" fill="url(#moleFace)" />

        {/* 鼻子 */}
        <circle cx="100" cy="122" r="5.5" fill="#3E3A36" />
        {/* 嘴 */}
        {hit ? (
          <path d="M92 132 Q100 138 108 132" stroke="#3E3A36" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M92 132 Q100 128 108 132" stroke="#3E3A36" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}

        {/* 眼睛 */}
        {hit ? (
          <>
            <path d="M78 108 Q86 100 94 108" stroke="#3E3A36" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M106 108 Q114 100 122 108" stroke="#3E3A36" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="86" cy="107" rx="3.6" ry="4.6" fill="#3E3A36" />
            <ellipse cx="114" cy="107" rx="3.6" ry="4.6" fill="#3E3A36" />
            <circle cx="87.4" cy="105" r="1.3" fill="#FFFFFF" />
            <circle cx="115.4" cy="105" r="1.3" fill="#FFFFFF" />
          </>
        )}

        {/* 粉腮 */}
        <circle cx="76" cy="124" r="5.5" fill="#F0A9B6" opacity="0.75" />
        <circle cx="124" cy="124" r="5.5" fill="#F0A9B6" opacity="0.75" />
      </g>
    </svg>
  );
}

/* -------------------- 炸弹 -------------------- */
export function BombSvg({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id="bombBody" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#5A554E" />
          <stop offset="100%" stopColor="#2E2A26" />
        </radialGradient>
      </defs>
      {/* 引信 */}
      <path d="M140 40 Q160 22 178 34" stroke="#7A4A32" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* 火花 */}
      <g>
        <circle cx="178" cy="34" r="7" fill="#F0C36D" />
        <circle cx="178" cy="34" r="3.5" fill="#C97A5B" />
        <g stroke="#F0C36D" strokeWidth="2" strokeLinecap="round">
          <line x1="178" y1="18" x2="178" y2="10" />
          <line x1="190" y1="26" x2="198" y2="22" />
          <line x1="190" y1="42" x2="198" y2="46" />
          <line x1="166" y1="26" x2="158" y2="22" />
        </g>
      </g>
      {/* 球体 */}
      <circle cx="100" cy="120" r="68" fill="url(#bombBody)" stroke="#3E3A36" strokeWidth="2.5" />
      {/* 高光 */}
      <ellipse cx="74" cy="94" rx="16" ry="9" fill="#FFFFFF" opacity="0.3" />
      {/* “危险”标签 */}
      <g transform="translate(100 122)">
        <rect x="-24" y="-14" width="48" height="26" rx="4" fill="#F5E5DC" stroke="#7A4A32" strokeWidth="1.6" />
        <text
          x="0"
          y="6"
          textAnchor="middle"
          fontFamily="'Noto Serif SC', serif"
          fontSize="16"
          fontWeight="700"
          fill="#A65F44"
        >
          !
        </text>
      </g>
    </svg>
  );
}

/* -------------------- HUD 胶囊：Japandi 白底 + sage 描边 -------------------- */
export function HudCapsule({
  icon,
  label,
  value,
  tone = 'sage',
}: {
  icon: ReactNode;
  label?: string;
  value: ReactNode;
  tone?: 'sage' | 'clay' | 'ember' | 'water';
}) {
  const toneColor: Record<string, { border: string; text: string; iconBg: string }> = {
    sage: { border: '#8FA98F', text: '#3E3A36', iconBg: '#EAF0E8' },
    clay: { border: '#7FA98B', text: '#3E3A36', iconBg: '#E8F1E9' },
    ember: { border: '#C97A5B', text: '#3E3A36', iconBg: '#F5E5DC' },
    water: { border: '#6D8B90', text: '#3E3A36', iconBg: '#E7EEEF' },
  };
  const c = toneColor[tone];
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
      style={{ border: `1.5px solid ${c.border}` }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: c.iconBg }}
      >
        {icon}
      </span>
      <div className="flex items-baseline gap-1.5 pr-2">
        {label && <span className="text-[11px] font-medium text-ink-faint">{label}</span>}
        <span
          className="font-serif text-lg font-medium leading-none"
          style={{ color: c.text }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/* 常用小图标（stroke，跟随 currentColor） */
export function ClockIcon({ className = 'text-clay-deep' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 v5 l3 2" />
    </svg>
  );
}

export function CoinIcon({ className = 'text-ember-deep' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="none">
      <circle cx="12" cy="12" r="8.5" fill="#F0C36D" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 8.5 h4.8 M9 12 h6 M9.6 15.5 h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TargetIcon({ className = 'text-water' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
