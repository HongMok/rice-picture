'use client';

/**
 * 熊猫吉祥物（参考熊猫登录页交互）。
 * - lookRatio: 0~1，睁眼时眼珠水平位置（跟随账号输入）
 * - covering: true 时熊猫抬起双臂捂住眼睛（聚焦密码框）
 * 熊猫探出卡片顶部，两只手臂搭在卡片上沿。纯 SVG + CSS transform。
 */
export function CartoonMascot({
  lookRatio = 0.5,
  covering = false,
}: {
  lookRatio?: number;
  covering?: boolean;
}) {
  const eyeX = (lookRatio - 0.5) * 6; // 眼珠水平偏移 -3~+3

  return (
    <svg viewBox="0 0 220 200" className="h-44 w-44 select-none" aria-hidden>
      {/* 耳朵 */}
      <circle cx="66" cy="52" r="26" fill="#2b2622" />
      <circle cx="154" cy="52" r="26" fill="#2b2622" />
      <circle cx="66" cy="52" r="13" fill="#1a1613" />
      <circle cx="154" cy="52" r="13" fill="#1a1613" />

      {/* 头 */}
      <circle cx="110" cy="92" r="62" fill="#ffffff" stroke="#2b2622" strokeWidth="3" />

      {/* 眼罩（熊猫标志性黑眼圈） */}
      {!covering && (
        <>
          <ellipse
            cx="86"
            cy="90"
            rx="20"
            ry="24"
            fill="#2b2622"
            transform="rotate(-12 86 90)"
          />
          <ellipse
            cx="134"
            cy="90"
            rx="20"
            ry="24"
            fill="#2b2622"
            transform="rotate(12 134 90)"
          />
          {/* 眼白 + 眼珠（跟随） */}
          <circle cx="88" cy="90" r="9" fill="#fff" />
          <circle cx="132" cy="90" r="9" fill="#fff" />
          <circle
            cx={88 + eyeX}
            cy="92"
            r="4.5"
            fill="#1a1613"
            style={{ transition: 'cx 0.15s ease-out' }}
          />
          <circle
            cx={132 + eyeX}
            cy="92"
            r="4.5"
            fill="#1a1613"
            style={{ transition: 'cx 0.15s ease-out' }}
          />
        </>
      )}

      {/* 腮红 */}
      <circle cx="72" cy="112" r="9" fill="#f3b0c3" opacity="0.75" />
      <circle cx="148" cy="112" r="9" fill="#f3b0c3" opacity="0.75" />

      {/* 鼻子 + 嘴 */}
      <ellipse cx="110" cy="108" rx="6" ry="4.5" fill="#2b2622" />
      <path
        d="M110 112 L110 120 M110 120 q-9 8 -18 2 M110 120 q9 8 18 2"
        fill="none"
        stroke="#2b2622"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 搭在卡片上沿的两只手臂（始终可见） */}
      {!covering && (
        <>
          <ellipse cx="52" cy="150" rx="15" ry="12" fill="#2b2622" />
          <ellipse cx="168" cy="150" rx="15" ry="12" fill="#2b2622" />
        </>
      )}

      {/* 捂眼：双臂从下往上抬起盖住眼睛 */}
      {covering && (
        <g style={{ transformOrigin: '110px 150px' }}>
          {/* 左臂 */}
          <path
            d="M40 158 Q58 96 96 86 Q104 100 92 112 Q70 120 58 160 Z"
            fill="#2b2622"
          />
          {/* 右臂 */}
          <path
            d="M180 158 Q162 96 124 86 Q116 100 128 112 Q150 120 162 160 Z"
            fill="#2b2622"
          />
          {/* 手掌肉垫点缀 */}
          <circle cx="96" cy="94" r="4" fill="#4a423c" />
          <circle cx="124" cy="94" r="4" fill="#4a423c" />
          {/* 偷看的一条缝（可爱） */}
          <path
            d="M100 100 q10 4 20 0"
            fill="none"
            stroke="#4a423c"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
