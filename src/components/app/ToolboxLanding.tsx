'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TOOLS, type ToolBadge } from '~/data/tools';

export function ToolboxLanding() {
  const router = useRouter();
  const [navError, setNavError] = useState(false);

  function handleNavigate(href: string) {
    try {
      router.push(href);
    } catch {
      setNavError(true);
    }
  }

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-16 md:px-10">
      <h1 className="font-serif text-[40px] font-normal leading-[1.6] text-ink">
        我能为你做什么?
      </h1>
      <p className="mt-3 max-w-[60ch] text-[15px] leading-[2] text-ink-soft">
        写报告 · 做教具 · 备教案 —— 交给懂康复的小禾。
      </p>

      {navError && (
        <div className="mt-6 rounded-card bg-clay-mist px-4 py-3 text-sm text-clay">
          没能跳转到这个工具，请再试一次。
          <button
            onClick={() => setNavError(false)}
            className="ml-2 text-clay underline"
          >
            知道了
          </button>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.key}
              href={tool.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavigate(tool.href);
              }}
              className="group relative min-w-[240px] rounded-card border border-line bg-card p-8 transition-colors duration-[450ms] ease-out hover:bg-paper-deep"
            >
              {tool.badge && <ToolBadgeMark type={tool.badge} />}
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-mist text-sage-deep">
                <Icon width={22} height={22} />
              </span>
              <h3 className="mt-5 text-[17px] font-medium text-ink">{tool.name}</h3>
              <p className="mt-1.5 text-sm leading-[1.9] text-ink-faint">
                {tool.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** 卡片右上角小徽章：AI = 深绿小胶囊；HOT = 火焰 SVG。 */
function ToolBadgeMark({ type }: { type: ToolBadge }) {
  if (type === 'AI') {
    return (
      <span
        className="pointer-events-none absolute right-4 top-4 rounded-full bg-clay-deep px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-paper"
        aria-hidden
      >
        AI
      </span>
    );
  }
  // HOT → 火焰 SVG（陶土橘填充 + 内部亮橘描一笔"心火"层次）
  return (
    <span
      className="pointer-events-none absolute right-4 top-4"
      aria-label="HOT"
    >
      <FlameIcon />
    </span>
  );
}

function FlameIcon() {
  // 18×18 火焰：外焰橙红渐变（自下暖到上亮），内焰亮黄高光，顶端小光点
  const uid = 'flame-hot';
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-outer`} x1="12" y1="22" x2="12" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E63A1E" />
          <stop offset="0.55" stopColor="#F27430" />
          <stop offset="1" stopColor="#FFB542" />
        </linearGradient>
        <linearGradient id={`${uid}-inner`} x1="12" y1="19" x2="12" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFB03A" />
          <stop offset="1" stopColor="#FFE38A" />
        </linearGradient>
      </defs>
      {/* 外焰：从底部宽稳到顶端一根小尖尖，腰身微收 */}
      <path
        d="M12 2.2
           C 13.4 4.6, 15.4 6.2, 16.6 8.4
           C 17.9 10.8, 18.6 13.4, 17.4 16
           C 16.1 18.9, 13.3 20.6, 10.5 20.6
           C 7 20.6, 4.4 18.1, 4.6 14.8
           C 4.7 12.5, 5.9 10.9, 7 10.2
           C 8 11.4, 9.6 11.5, 10.2 10.5
           C 10.9 9.3, 10.6 7.6, 10.6 6.1
           C 10.7 4.6, 11.3 3.2, 12 2.2 Z"
        fill={`url(#${uid}-outer)`}
      />
      {/* 内焰：更小的火苗，位置偏下 */}
      <path
        d="M12 10
           C 12.7 11.2, 13.7 12.2, 14 13.6
           C 14.4 15.5, 13 17.5, 11 17.5
           C 9 17.5, 7.8 16, 8.1 14.3
           C 8.3 13.2, 9 12.6, 9.6 12.5
           C 10 13.2, 10.7 13.1, 11 12.5
           C 11.3 11.8, 11.6 10.9, 12 10 Z"
        fill={`url(#${uid}-inner)`}
      />
      {/* 顶端小光点 —— 让火尖有"闪一下"的感觉 */}
      <circle cx="12" cy="4.6" r="0.85" fill="#FFF3B0" opacity="0.9" />
    </svg>
  );
}
