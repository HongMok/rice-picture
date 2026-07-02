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
