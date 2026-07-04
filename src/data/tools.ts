import type { ComponentType, SVGProps } from 'react';
import {
  ImageIcon,
  BookIcon,
  GameIcon,
  VideoIcon,
  LessonPlanIcon,
} from '~/components/ui/icons';

export type ToolKey = 'image' | 'book' | 'game' | 'video' | 'lesson-plan';
export type RecentProjectType = ToolKey;

export type ToolBadge = 'AI' | 'HOT';

export interface ToolDef {
  key: ToolKey;
  name: string;
  description: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: ToolBadge;
}

// 顺序 = 工具箱首页展示顺序
export const TOOLS: ToolDef[] = [
  {
    key: 'video',
    name: '课堂分析',
    description: '上传课堂录像，帮我看孩子表现、写家长可读的观察报告',
    href: '/app?panel=video',
    icon: VideoIcon,
    badge: 'AI',
  },
  {
    key: 'image',
    name: '生成图卡',
    description: '按训练目标做图卡：情绪 / 物品 / 场景，随做随用',
    href: '/app?panel=image',
    icon: ImageIcon,
    badge: 'HOT',
  },
  {
    key: 'book',
    name: '生成绘本',
    description: '把干预主题变成一本小绘本，孩子跟着读、家长带回家',
    href: '/app?panel=book',
    icon: BookIcon,
    badge: 'HOT',
  },
  {
    key: 'game',
    name: '互动游戏',
    description: '根据个案能力自动出题，图卡直接复用到游戏里',
    href: '/app?panel=game',
    icon: GameIcon,
  },
  {
    key: 'lesson-plan',
    name: '生成教案',
    description: '按 ABA/DTT 结构直出 DTT 教案初稿，我在这基础上改',
    href: '/app/lesson-plan',
    icon: LessonPlanIcon,
  },
];

export function toolByKey(key: string): ToolDef | undefined {
  return TOOLS.find((t) => t.key === key);
}
