'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TOOLS } from '~/data/tools';

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
        挑一个工具开始，或者从对话里慢慢说清楚你的需求。
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
              className="group min-w-[240px] rounded-card border border-line bg-card p-8 transition-colors duration-[450ms] ease-out hover:bg-paper-deep"
            >
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
