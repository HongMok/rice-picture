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

export interface ToolDef {
  key: ToolKey;
  name: string;
  description: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const TOOLS: ToolDef[] = [
  {
    key: 'image',
    name: '图卡',
    description: '一句描述，生成清晰温和的教学图卡',
    href: '/app?panel=image',
    icon: ImageIcon,
  },
  {
    key: 'book',
    name: '绘本',
    description: '扩写成故事，逐页配图，生成可翻页绘本',
    href: '/app?panel=book',
    icon: BookIcon,
  },
  {
    key: 'game',
    name: '互动游戏',
    description: '按个案定制出题，图库复用，边玩边练',
    href: '/app?panel=game',
    icon: GameIcon,
  },
  {
    key: 'video',
    name: '视频分析',
    description: '看一段课堂视频，生成结构化家长报告',
    href: '/app?panel=video',
    icon: VideoIcon,
  },
  {
    key: 'lesson-plan',
    name: '教案生成',
    description: '对话或点选参数，生成 DTT 教案初稿',
    href: '/app/lesson-plan',
    icon: LessonPlanIcon,
  },
];

export function toolByKey(key: string): ToolDef | undefined {
  return TOOLS.find((t) => t.key === key);
}
