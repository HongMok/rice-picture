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
        备课、做教具、写报告 —— 挑一个开始，帮你把重复的事变快。
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
              className="group relative min-w-[240px] overflow-hidden rounded-card border border-line bg-card p-8 transition-colors duration-[450ms] ease-out hover:bg-paper-deep"
            >
              {tool.badge && <CornerRibbon type={tool.badge} />}
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

/** 卡片右上角 45° 对角丝带。父容器需要 relative + overflow-hidden。 */
function CornerRibbon({ type }: { type: ToolBadge }) {
  // AI = 青灰（water）；HOT = 陶土橘（ember）
  const bg = type === 'AI' ? 'bg-water' : 'bg-ember';
  return (
    <span
      className={
        'pointer-events-none absolute -right-9 top-3 w-32 rotate-45 py-1 text-center text-[10px] font-semibold tracking-[0.22em] text-paper shadow-sm ' +
        bg
      }
      aria-hidden
    >
      {type}
    </span>
  );
}
