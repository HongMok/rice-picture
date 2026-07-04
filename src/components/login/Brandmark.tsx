type Tone = 'light' | 'dark';
type Size = 'sm' | 'md' | 'lg';

interface BrandmarkProps {
  className?: string;
  align?: 'left' | 'center';
  tone?: Tone;
  size?: Size;
  showTagline?: boolean;
}

const SIZE_MAP: Record<Size, { box: number; icon: number; wordCls: string; aiCls: string; tagCls: string; gap: string; radius: string }> = {
  sm: { box: 28, icon: 18, wordCls: 'text-base', aiCls: 'text-[10px]', tagCls: 'text-[10px]', gap: 'gap-2', radius: 'rounded-[7px]' },
  md: { box: 36, icon: 22, wordCls: 'text-xl', aiCls: 'text-[11px]', tagCls: 'text-[11px]', gap: 'gap-2.5', radius: 'rounded-[9px]' },
  lg: { box: 48, icon: 30, wordCls: 'text-3xl', aiCls: 'text-xs', tagCls: 'text-xs', gap: 'gap-3.5', radius: 'rounded-[12px]' },
};

/** 卡通萌芽豆子吉祥物：白肚子、绿描边、头顶两片叶、黑豆眼、粉腮红、脚下两撇。
 *  取自 Mok 提供的萌芽卡通形象。 */
/** 可复用的萌芽 Glyph（供 Brandmark 内部使用，也导出给对话空态等场景独立使用）。 */
export function BrandmarkGlyph(props: { size: number; onDark?: boolean }) {
  return <SproutGlyph {...props} />;
}

function SproutGlyph({ size, onDark = false }: { size: number; onDark?: boolean }) {
  // 按原图 166×184 描出的 24×24 SVG（等比缩放 s≈0.1304, 水平居中偏移≈1.17）
  // 配色：从原图取样
  const green = '#3EA05A';                       // 主绿：描边/叶/圆环/土丘
  const greenDeep = '#2C7A42';                   // 深绿：叶脉
  const cream = '#F7E8C4';                       // 奶黄脸颊
  const belly = onDark ? '#F5F1E8' : '#FCFAF3';  // 象牙白（略偏暖）
  const eye = onDark ? '#242822' : '#2A2822';    // 眼睛/嘴

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* ==== 底层：土丘/草坪 ==== */}
      {/* 半圆椭圆状底座，宽度 4.7 → 20.7，顶 y=18.5，覆盖到 24 底 */}
      <path
        d="M12 24
           C 6.4 24, 3.3 22.4, 3.3 20.4
           C 3.3 18.6, 6.6 18.5, 12 18.5
           C 17.4 18.5, 20.7 18.6, 20.7 20.4
           C 20.7 22.4, 17.6 24, 12 24 Z"
        fill={green}
      />

      {/* ==== 中层：绿色圆环身体（外圆填绿，然后再叠白肚） ==== */}
      {/* 外圆：中心 (12, 15.9)，半径 7.6 */}
      <circle cx="12" cy="15.9" r="7.6" fill={green} />
      {/* 白肚：内圆稍小，露出~1.5 单位的绿边 */}
      <circle cx="12" cy="15.9" r="6.05" fill={belly} />

      {/* ==== 面部 ==== */}
      {/* 奶黄脸颊：两个椭圆（腮红位置对齐眼睛下方一点） */}
      <ellipse cx="8.6" cy="16.7" rx="1.35" ry="0.9" fill={cream} />
      <ellipse cx="15.4" cy="16.7" rx="1.35" ry="0.9" fill={cream} />

      {/* 眼睛：两颗黑豆，位于面部上半，等高（跟原图对齐） */}
      <ellipse cx="9.8" cy="15.0" rx="0.7" ry="1.0" fill={eye} />
      <ellipse cx="14.2" cy="15.0" rx="0.7" ry="1.0" fill={eye} />

      {/* 嘴：小上扬弧 */}
      <path
        d="M11.2 16.3 C 11.55 16.75, 12.45 16.75, 12.8 16.3"
        stroke={eye}
        strokeWidth={0.7}
        strokeLinecap="round"
        fill="none"
      />

      {/* ==== 顶层：双叶 + 短茎（严格按原图比例：叶尖 y≈0.4, 最宽处 y≈3.1, 抱合于 y≈6.3） ==== */}

      {/* 左叶：叶尖朝左上，饱满水滴形。基点在中央茎 (12, 6.3) 附近 */}
      <path
        d="M11.4 6.6
           C 11.0 5.0, 10.2 3.4, 8.8 2.2
           C 7.4 1.0, 5.2 0.4, 3.6 1.4
           C 2.2 2.3, 2.4 4.4, 4.0 5.5
           C 5.8 6.8, 8.4 7.2, 10.6 7.0
           C 11.2 6.95, 11.5 6.9, 11.4 6.6 Z"
        fill={green}
      />
      {/* 左叶脉 */}
      <path
        d="M10.6 6.5 C 8.6 5.6, 6.6 4.4, 4.8 2.6"
        stroke={greenDeep}
        strokeWidth={0.5}
        strokeLinecap="round"
        fill="none"
      />

      {/* 右叶：镜像 */}
      <path
        d="M12.6 6.6
           C 13.0 5.0, 13.8 3.4, 15.2 2.2
           C 16.6 1.0, 18.8 0.4, 20.4 1.4
           C 21.8 2.3, 21.6 4.4, 20.0 5.5
           C 18.2 6.8, 15.6 7.2, 13.4 7.0
           C 12.8 6.95, 12.5 6.9, 12.6 6.6 Z"
        fill={green}
      />
      {/* 右叶脉 */}
      <path
        d="M13.4 6.5 C 15.4 5.6, 17.4 4.4, 19.2 2.6"
        stroke={greenDeep}
        strokeWidth={0.5}
        strokeLinecap="round"
        fill="none"
      />

      {/* 短茎：从两叶抱合处向下衔接到身体顶部 */}
      <path
        d="M12 6.9 L 12 8.4"
        stroke={green}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brandmark({
  className = '',
  align = 'left',
  tone,
  size = 'md',
  showTagline = true,
}: BrandmarkProps) {
  const resolvedTone: Tone = tone ?? (align === 'center' ? 'light' : 'dark');
  const isDark = resolvedTone === 'dark';
  const s = SIZE_MAP[size];

  // 印章底色（深/浅底都用米色印章底，让卡通萌芽有个稳定载体）
  const boxBg = isDark ? 'bg-paper' : 'bg-sage-mist';
  const boxBorder = isDark ? 'border border-paper/70' : 'border border-clay-deep/25';

  // 字标：不论深浅底，「小禾」绿 + 「AI」黑（Mok 明确要求）
  const wordColor = 'text-clay-deep';
  const aiColor = isDark ? 'text-paper' : 'text-ink';
  const tagColor = isDark ? 'text-paper/60' : 'text-ink-faint';

  return (
    <div
      className={`${className} ${align === 'center' ? 'items-center text-center' : 'items-start'} flex flex-col gap-1.5`}
    >
      <div className={`flex items-center ${s.gap} ${align === 'center' ? 'justify-center' : ''}`}>
        <span
          className={`relative inline-flex items-center justify-center ${s.radius} ${boxBg} ${boxBorder}`}
          style={{ width: s.box, height: s.box }}
          aria-hidden
        >
          <SproutGlyph size={s.icon} onDark={isDark} />
        </span>

        <span className={`flex items-baseline ${size === 'sm' ? 'gap-1' : 'gap-1.5'}`}>
          <span
            className={`font-serif font-medium tracking-[0.02em] leading-none ${s.wordCls} ${wordColor}`}
          >
            小禾
          </span>
          <span
            className={`font-medium tracking-[0.24em] leading-none ${s.aiCls} ${aiColor}`}
          >
            AI
          </span>
        </span>
      </div>

      {showTagline && (
        <p className={`${s.tagCls} ${tagColor} font-medium tracking-[0.18em]`}>
          让孩子与世界自由沟通
        </p>
      )}
    </div>
  );
}
