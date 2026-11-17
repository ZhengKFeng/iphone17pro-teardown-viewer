import type { ReactNode } from 'react';

const base = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const icon = (children: ReactNode, filled = false) =>
  function Icon({ size = 14 }: { size?: number }) {
    return (
      <svg {...base} width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} aria-hidden>
        {children}
      </svg>
    );
  };

export const PlayIcon = icon(<path d="M7 4.5v15l13-7.5z" />, true);
export const PauseIcon = icon(<path d="M6 4h4v16H6zM14 4h4v16h-4z" />, true);
export const ReverseIcon = icon(<path d="M17 4.5v15l-13-7.5z" />, true);
export const ResetIcon = icon(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </>,
);
export const EyeIcon = icon(
  <>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const EyeOffIcon = icon(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A16.600 16.600 0 0 0 2 12s3.600 7 10 7a9.700 9.700 0 0 0 4.200-.9" />
    <path d="M9.900 9.900a3 3 0 0 0 4.200 4.200" />
  </>,
);
export const ChevronIcon = icon(<path d="M9 6l6 6-6 6" />);
export const TargetIcon = icon(
  <>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </>,
);
export const IsolateIcon = icon(
  <>
    <rect x="8" y="8" width="8" height="8" rx="1" />
    <path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4" />
  </>,
);
export const DownloadIcon = icon(
  <>
    <path d="M12 3v12M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </>,
);
export const LayersIcon = icon(
  <>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </>,
);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.500v.500" />
  </>,
);
export const HomeIcon = icon(
  <>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
  </>,
);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
