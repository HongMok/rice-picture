// 线性 SVG 图标集，24×24，stroke=currentColor。替换所有 emoji。
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      {...p}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 10.5 12 4l9 6.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9.5 20v-5h5v5" />
  </Base>
);

export const ImageIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M21 16l-5-4.5-9 8" />
  </Base>
);

export const BookIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 6.5C10.5 5 7.5 4.5 4 5v13c3.5-.5 6.5 0 8 1.5" />
    <path d="M12 6.5C13.5 5 16.5 4.5 20 5v13c-3.5-.5-6.5 0-8 1.5" />
    <path d="M12 6.5v13" />
  </Base>
);

export const WorksIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="7" height="7" rx="1.5" />
    <rect x="14" y="5" width="7" height="7" rx="1.5" />
    <rect x="3" y="15" width="7" height="4.5" rx="1.5" />
    <rect x="14" y="15" width="7" height="4.5" rx="1.5" />
  </Base>
);

export const StyleIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.6-.5-1 0-.9.7-1.6 1.6-1.6H16A5 5 0 0 0 21 10c0-4-4-7-9-7Z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const RatioIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M8 6v12M3 12h5" opacity="0.5" />
  </Base>
);

export const PagesIcon = (p: P) => (
  <Base {...p}>
    <rect x="5" y="3.5" width="12" height="16" rx="2" />
    <path d="M8 8h6M8 11.5h6M8 15h4" />
    <path d="M17 6.5h2v13a1.5 1.5 0 0 1-1.5 1.5H8" opacity="0.5" />
  </Base>
);

export const SparkleIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" />
    <path d="M18 14l.7 1.8 1.8.7-1.8.7L18 19l-.7-1.8L15.5 16.5l1.8-.7Z" />
  </Base>
);

export const MenuIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Base>
);

export const ChevronLeftIcon = (p: P) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const ChevronRightIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

/* 侧栏折叠开关：圆角面板 + 竖分割线 + 方向三角（left=向左收起 / right=向右展开）*/
export const SidebarToggleIcon = ({
  direction = 'left',
  ...p
}: P & { direction?: 'left' | 'right' }) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9 5v14" />
    {direction === 'left' ? (
      // ◀ 三角，位于面板右侧
      <path d="M16 9.5 13 12l3 2.5" fill="currentColor" />
    ) : (
      // ▶ 三角，位于面板右侧
      <path d="M13 9.5 16 12l-3 2.5" fill="currentColor" />
    )}
  </Base>
);

export const LogoutIcon = (p: P) => (
  <Base {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h11" />
  </Base>
);

export const DownloadIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 4v11M8 11l4 4 4-4" />
    <path d="M5 19h14" />
  </Base>
);

export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const CheckIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Base>
);

export const GameIcon = (p: P) => (
  <Base {...p}>
    <path d="M8.5 6.5h7A4.5 4.5 0 0 1 20 11v2a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 13v-2a4.5 4.5 0 0 1 4.5-4.5Z" />
    <path d="M8.5 11h2M9.5 10v2" />
    <circle cx="15" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="17" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
  </Base>
);

export const VideoIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="M16 10.5l5-3v9l-5-3Z" />
  </Base>
);

export const LessonPlanIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 4h9l4 4v12H6Z" />
    <path d="M15 4v4h4" />
    <path d="M9 12.5h7M9 15.5h7M9 9.5h4" />
  </Base>
);

export const ChatIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5h16v10H10l-4 3.5v-3.5H4Z" />
    <path d="M8.5 10h7" />
  </Base>
);

export const GraduationIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
    <path d="M7 11.5v4.2c0 .8 2.2 2.3 5 2.3s5-1.5 5-2.3v-4.2" />
    <path d="M20 10v5" />
  </Base>
);

export const ToolboxIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="9" width="17" height="10.5" rx="2" />
    <path d="M8.5 9V6.5A2 2 0 0 1 10.5 4.5h3A2 2 0 0 1 15.5 6.5V9" />
    <path d="M3.5 13.5h17" />
  </Base>
);

export const UsersIcon = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.5-3 3-5 6-5s5.5 2 6 5" />
    <circle cx="16.5" cy="7.5" r="2.4" />
    <path d="M14.5 12.4c1.6-.3 3 .1 4.1 1a4.6 4.6 0 0 1 1.9 3.6" />
  </Base>
);

export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7A1.5 1.5 0 0 0 17 19.5L18 7" />
    <path d="M10.5 11v6M13.5 11v6" opacity="0.55" />
  </Base>
);

export const ClockIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const WalletIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
    <path d="M3.5 10.5h17" />
    <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const GlobeIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.4 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.4-3.8-8.5S9.5 5.8 12 3.5Z" />
  </Base>
);

export const AttachIcon = (p: P) => (
  <Base {...p}>
    <path d="M17 8.5 9.5 16A3 3 0 0 1 5.3 11.8L13 4.1a2.2 2.2 0 0 1 3.1 3.1L9 14.3" />
  </Base>
);

export const SendIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 12 20 4l-6.5 16-2.5-7-7-1Z" />
  </Base>
);

export const PauseIcon = (p: P) => (
  <Base {...p}>
    <path d="M8 5.5v13M16 5.5v13" />
  </Base>
);

export const PlayIcon = (p: P) => (
  <Base {...p}>
    <path d="M6.5 5v14l12-7Z" />
  </Base>
);

export const SoundIcon = (p: P) => (
  <Base {...p}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Base>
);

export const SoundOffIcon = (p: P) => (
  <Base {...p}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
  </Base>
);

/* 通用设置图标：8 齿齿轮 + 中心圆孔（Feather 风格） */
export const SettingsIcon = (p: P) => (
  <Base {...p}>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const HelpIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.5a2.2 2.2 0 1 1 3.3 2.4c-.7.5-1.1 1-1.1 2" />
    <circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none" />
  </Base>
);

export const ButterflyIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 6.5c-1-2-4-3.5-6-2S3 8.5 5 10.5c1.5 1.5 4.5 1 7-1" />
    <path d="M12 6.5c1-2 4-3.5 6-2s3 4 1 6c-1.5 1.5-4.5 1-7-1" />
    <path d="M12 9.5c-1 2-4 3.5-6 2S3.5 7.5 5.5 5.5c1.5-1.5 4.5-1 6.5 4" />
    <path d="M12 9.5c1 2 4 3.5 6 2s2.5-4 .5-6c-1.5-1.5-4.5-1-6.5 4" />
    <path d="M12 6v10.5" />
  </Base>
);

export const MoleIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 20a6 6 0 0 1 12 0Z" opacity="0.5" />
    <path d="M7.5 14a4.5 4.5 0 0 1 9 0v2.5h-9Z" />
    <circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="14" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
    <path d="M11.3 16.2h1.4" />
  </Base>
);

/** 横向三点（Kebab / More）—— 悬浮菜单触发器 */
export const MoreHorizontalIcon = (p: P) => (
  <Base {...p}>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);

/** 编辑铅笔（重命名等） */
export const EditIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 20.5h4.5L18.4 10.6a2 2 0 0 0-2.8-2.8L5.5 17.6Z" />
    <path d="M13.5 6.5l4 4" />
  </Base>
);
