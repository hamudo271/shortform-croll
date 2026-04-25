/**
 * Curated icon set — single source for all UI icons.
 * Replaces emoji + ad-hoc inline SVGs across the app.
 *
 * 16x16 baseline, 1.5px strokes (matches Linear/Vercel feel).
 * Color: currentColor — controlled via Tailwind `text-*` classes.
 */

interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const baseSvg = (size: number, strokeWidth: number, className?: string) => ({
  className,
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function ArrowRight({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function ArrowUpRight({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

export function ChevronDown({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChevronRight({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function Check({ className, size = 16, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function X({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Sun({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function Moon({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export function Search({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function Filter({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function User({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function LogOut({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Shield({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function Eye({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Heart({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

export function TrendingUp({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export function Zap({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function Sparkles({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}

export function Layers({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function Clock({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function Mail({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}

export function Lock({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function Refresh({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

export function MessageSquare({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function Package({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function ShoppingBag({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 11-8 0" />
    </svg>
  );
}

export function Smartphone({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export function ExternalLink({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function Play({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  );
}

export function PlusCircle({ className, size = 16, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseSvg(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
