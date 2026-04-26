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

/* ──────────────────────────────────────────────────────────────────────────
 * Platform brand logos (filled, brand-recognizable shapes).
 * These bypass the stroke-based base style and use `fill="currentColor"`
 * so callers control color via Tailwind text-* classes.
 * ────────────────────────────────────────────────────────────────────────── */

export function YouTubeLogo({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418A2.506 2.506 0 0 0 2.418 6.186 26.05 26.05 0 0 0 2 12c0 1.99.14 3.93.418 5.814a2.506 2.506 0 0 0 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768A26.05 26.05 0 0 0 22 12c0-1.99-.14-3.93-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
    </svg>
  );
}

export function TikTokLogo({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.68l.01.03A6.33 6.33 0 0 0 16.46 12.4V7.72a8.31 8.31 0 0 0 5.25 2.15v-3.2a5.2 5.2 0 0 1-2.12-.02 4.93 4.93 0 0 1-2.02-.96z" />
    </svg>
  );
}

export function InstagramLogo({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}
