'use client';

import clsx from 'clsx';
import { ImageIcon, BookIcon, GameIcon, VideoIcon } from '~/components/ui/icons';

export type ModuleKey = 'image' | 'book' | 'game' | 'video';

const MODULES: { key: ModuleKey; label: string; icon: (p: any) => JSX.Element }[] = [
  { key: 'image', label: '图卡', icon: ImageIcon },
  { key: 'book', label: '绘本', icon: BookIcon },
  { key: 'game', label: '互动游戏', icon: GameIcon },
  { key: 'video', label: '视频分析', icon: VideoIcon },
];

/** 左侧最外层的模块导航条（选功能），与 Sidebar（某功能内的作品库）是不同层级 */
export function ModuleNav({
  active,
  onSelect,
}: {
  active: ModuleKey;
  onSelect: (m: ModuleKey) => void;
}) {
  return (
    <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-paper/60 py-3 md:flex">
      {MODULES.map((m) => {
        const isActive = active === m.key;
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            title={m.label}
            className={clsx(
              'flex w-14 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-medium transition-colors',
              isActive ? 'bg-clay-mist text-clay' : 'text-ink-faint hover:bg-white hover:text-ink'
            )}
          >
            <Icon width={20} height={20} />
            <span className="leading-none">{m.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** 移动端：压缩成顶部一行图标 tab，替代原来的汉堡菜单入口位置 */
export function ModuleNavMobile({
  active,
  onSelect,
}: {
  active: ModuleKey;
  onSelect: (m: ModuleKey) => void;
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto md:hidden">
      {MODULES.map((m) => {
        const isActive = active === m.key;
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive ? 'bg-clay text-white' : 'text-ink-soft hover:bg-paper'
            )}
          >
            <Icon width={16} height={16} />
            {m.label}
          </button>
        );
      })}
    </nav>
  );
}
