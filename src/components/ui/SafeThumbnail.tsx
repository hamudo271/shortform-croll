'use client';

import { useState } from 'react';
import type { Platform } from '@prisma/client';
import { YouTubeLogo, TikTokLogo, InstagramLogo } from '@/components/ui/Icon';

const PLATFORM_LOGO: Record<Platform, typeof YouTubeLogo> = {
  YOUTUBE: YouTubeLogo,
  TIKTOK: TikTokLogo,
  INSTAGRAM: InstagramLogo,
};

const PLATFORM_LABEL: Record<Platform, string> = {
  YOUTUBE: 'YouTube Shorts',
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram Reels',
};

/**
 * Multi-stop gradient + radial accent per platform — feels like a designed
 * placeholder card, not a broken image.
 */
const PLATFORM_BG: Record<Platform, string> = {
  YOUTUBE: 'bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.45),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.35),transparent_60%),linear-gradient(135deg,#1f0a0a_0%,#0a0a0a_100%)]',
  TIKTOK: 'bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.45),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.35),transparent_60%),linear-gradient(135deg,#062028_0%,#0a0a0a_100%)]',
  INSTAGRAM: 'bg-[radial-gradient(circle_at_25%_25%,rgba(217,70,239,0.45),transparent_60%),radial-gradient(circle_at_75%_75%,rgba(249,115,22,0.4),transparent_60%),linear-gradient(135deg,#1a0a1f_0%,#0a0a0a_100%)]',
};

interface Props {
  src: string;
  alt: string;
  platform: Platform;
  /** Logo size when the image fails. Auto-tunes per use-case. */
  fallbackIconSize?: number;
  /** Disable shimmer (useful for tiny thumbnails). */
  noShimmer?: boolean;
  /** Eager loading (only for above-the-fold cards). */
  eager?: boolean;
  /** Show platform label text in fallback. Hide on tiny thumbnails. */
  showLabel?: boolean;
}

/**
 * Image with rich graceful fallback. If the external thumbnail URL fails
 * (typical for TikTok/Instagram signed CDN URLs that expire), shows a
 * platform-styled placeholder card with multi-stop gradient + watermark logo
 * + small platform label. Always-visible gradient layer + image overlay →
 * never an empty box, never the broken-image icon.
 */
export default function SafeThumbnail({
  src,
  alt,
  platform,
  fallbackIconSize = 56,
  noShimmer = false,
  eager = false,
  showLabel = true,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);

  const Logo = PLATFORM_LOGO[platform];
  const bg = PLATFORM_BG[platform];
  const label = PLATFORM_LABEL[platform];
  const showLabelEffective = showLabel && fallbackIconSize >= 40;

  return (
    <>
      {/* Always-visible fallback layer (multi-stop radial + linear gradient) */}
      <div className={`absolute inset-0 ${bg}`}>
        {failed && (
          <>
            {/* Subtle dot grid texture */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at center, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            />
            {/* Watermark logo (huge, blurred-ish, 5% opacity) */}
            <div className="absolute -bottom-6 -right-6 text-white/[0.06]">
              <Logo size={Math.max(140, fallbackIconSize * 2.4)} />
            </div>
            {/* Centered logo + label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Logo size={fallbackIconSize} className="text-white/85" />
              {showLabelEffective && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                  {label}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Skeleton shimmer while loading */}
      {!loaded && !failed && !noShimmer && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>
      )}

      {/* Image overlay — opacity 0 until loaded so it fades in */}
      {!failed && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}
