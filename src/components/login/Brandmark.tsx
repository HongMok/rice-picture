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

/** 卡通萌芽：黑描边 + 品牌绿填充 + 土色小堆。
 *  一大叶右上、一小叶左侧，错落有动势；叶柄从主茎斜伸出。 */
function SproutGlyph({ size, onDark = false }: { size: number; onDark?: boolean }) {
  // 卡通配色：绿叶填充 / 深色描边 / 土棕小堆
  const leaf = '#7FA98B'; // clay (明亮绿)
  const leafShade = '#5E8A6E'; // clay-deep (阴影)
  const stroke = onDark ? '#2E3A31' : '#3E3A36'; // ink，深底上再压深一点
  const soil = '#C9A57B'; // 温暖土棕
  const soilStroke = '#8B6F4E';
  const sw = 1.3; // 卡通描边

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 土堆：底部小丘，浅弧线 */}
      <path
        d="M4.5 21.5 C 6 20, 9 19.4, 12 19.4 C 15 19.4, 18 20, 19.5 21.5 Z"
        fill={soil}
        stroke={soilStroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {/* 主茎：从土里长出，微微向右倾（生长感）*/}
      <path
        d="M11.6 19.6 C 11.9 16, 12.2 12.5, 12.6 8.4"
        stroke={stroke}
        strokeWidth={sw + 0.3}
        strokeLinecap="round"
        fill="none"
      />

      {/* 小叶（左）：叶柄从主茎中段斜伸向左 */}
      <path
        d="M11.9 15.2 C 10.4 15, 8.8 14.6, 7.4 13.6"
        stroke={stroke}
        strokeWidth={sw - 0.1}
        strokeLinecap="round"
        fill="none"
      />
      {/* 小叶片本体：水滴形，叶尖朝左 */}
      <path
        d="M7.4 13.6
           C 5.4 13.2, 3.6 12.4, 3 10.8
           C 2.8 10.2, 3.2 9.8, 4 9.9
           C 5.6 10.1, 7.2 10.9, 8.6 12.2
           C 9.2 12.8, 9 13.4, 8.2 13.6
           C 7.9 13.68, 7.6 13.64, 7.4 13.6 Z"
        fill={leaf}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* 小叶中脉 */}
      <path
        d="M4.4 10.8 C 5.6 11.3, 6.8 12, 8 12.6"
        stroke={leafShade}
        strokeWidth={sw - 0.4}
        strokeLinecap="round"
        fill="none"
      />

      {/* 大叶（右上）：叶柄从主茎顶端斜伸向右上 */}
      <path
        d="M12.6 8.4 C 13.4 7.6, 14.4 6.8, 15.6 6.2"
        stroke={stroke}
        strokeWidth={sw - 0.1}
        strokeLinecap="round"
        fill="none"
      />
      {/* 大叶片本体：饱满水滴，叶尖斜向右上、略微上翘 */}
      <path
        d="M15.6 6.2
           C 17.8 5, 20 5, 21 6.4
           C 21.8 7.6, 21.6 9.4, 20.4 11
           C 19 12.8, 16.6 13.8, 14.2 13.4
           C 12.8 13.2, 12.2 12.4, 12.6 11.2
           C 13 10, 14 8.4, 15.6 6.2 Z"
        fill={leaf}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* 大叶中脉：从叶柄一路穿到叶尖 */}
      <path
        d="M13.6 12
           C 15.4 10.6, 17.2 9.2, 19.4 7.8"
        stroke={leafShade}
        strokeWidth={sw - 0.3}
        strokeLinecap="round"
        fill="none"
      />
      {/* 大叶侧脉：两笔小分叉，增加卡通细节 */}
      <path
        d="M15.6 10.6 C 16 11.2, 16.6 11.5, 17.2 11.6"
        stroke={leafShade}
        strokeWidth={sw - 0.5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17 8.6 C 17.6 9, 18.4 9.2, 19.2 9.2"
        stroke={leafShade}
        strokeWidth={sw - 0.5}
        strokeLinecap="round"
        fill="none"
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
