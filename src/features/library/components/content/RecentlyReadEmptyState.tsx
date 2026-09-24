'use client';

import React from 'react';
import type { TIllustrationAssetProps } from './LibraryIllustrations';

const ILLUSTRATION_COLOR_TOKEN_MAP = {
  fill: {
    primary: 'var(--illustration-fill-primary, #FFFFFF)',
    secondary: 'var(--illustration-fill-secondary, #F4F5F5)',
    tertiary: 'var(--illustration-fill-tertiary, #EAEBEB)',
    quaternary: 'var(--illustration-fill-quaternary, #CFD2D3)',
  },
  stroke: {
    primary: 'var(--illustration-stroke-primary, #CFD2D3)',
    secondary: 'var(--illustration-stroke-secondary, #8A9093)',
    tertiary: 'var(--illustration-stroke-tertiary, #1D1F20)',
  },
};

/**
  * RecentlyReadVerticalStackIllustration
  * 3D isometric multi-layered illustration adhering strictly to the Plane.so / Flux Flat Precision standard.
  * Features 3 stacked isometric spatial base slabs, an upright open academic book/paper with reading pages,
  * silk ribbon bookmark, and a floating isometric clock-history badge.
  */
export function RecentlyReadVerticalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ==================================================================== */}
      {/* 3D ISOMETRIC STACKED BASE SLABS (3 LEVELS OF SPATIAL DEPTH)          */}
      {/* ==================================================================== */}
      {/* Base Slab 1 (Bottom) - opacity 0.2 */}
      <g opacity="0.2">
        <path
          d="M0.2 143.469C0.2 145.602 1.797 147.729 4.985 149.36L46.039 170.279C52.421 173.53 62.765 173.53 69.148 170.279L155.415 126.325C158.603 124.7 160.2 122.572 160.2 120.439V127.25C160.2 129.384 158.603 131.511 155.415 133.136L69.148 177.091C62.765 180.341 52.421 180.341 46.039 177.091L4.985 156.172C1.791 154.546 0.2 152.413 0.2 150.28V143.469Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.2 143.469C0.2 141.336 1.797 139.208 4.985 137.583L91.252 93.629C97.634 90.378 107.978 90.378 114.361 93.629L155.415 114.548C158.609 116.173 160.2 118.306 160.2 120.439C160.2 122.572 158.603 124.7 155.415 126.325L69.148 170.279C62.765 173.53 52.421 173.53 46.039 170.279L4.985 149.36C1.791 147.735 0.2 145.602 0.2 143.469Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Base Slab 2 (Middle) - opacity 0.6 */}
      <g opacity="0.6">
        <path
          d="M0.2 121.952C0.2 124.085 1.797 126.212 4.985 127.843L46.039 148.762C52.421 152.013 62.765 152.013 69.148 148.762L155.415 104.808C158.603 103.182 160.2 101.055 160.2 98.922V105.733C160.2 107.866 158.603 109.994 155.415 111.619L69.148 155.573C62.765 158.824 52.421 158.824 46.039 155.573L4.985 134.654C1.791 133.029 0.2 130.896 0.2 128.763V121.952Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.2 121.952C0.2 119.818 1.797 117.691 4.985 116.066L91.252 72.111C97.634 68.861 107.978 68.861 114.361 72.111L155.415 93.03C158.609 94.656 160.2 96.789 160.2 98.922C160.2 101.055 158.603 103.182 155.415 104.808L69.148 148.762C62.765 152.013 52.421 152.013 46.039 148.762L4.985 127.843C1.791 126.218 0.2 124.085 0.2 121.952Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Base Slab 3 (Top Platform) */}
      <path
        d="M0.2 100.429C0.2 102.562 1.797 104.689 4.985 106.32L46.039 127.239C52.421 130.49 62.765 130.49 69.148 127.239L155.415 83.285C158.603 81.66 160.2 79.532 160.2 77.399V84.21C160.2 86.343 158.603 88.471 155.415 90.096L69.148 134.05C62.765 137.301 52.421 137.301 46.039 134.05L4.985 113.131C1.791 111.506 0.2 109.373 0.2 107.24V100.429Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.2 100.429C0.2 98.295 1.797 96.168 4.985 94.543L91.252 50.588C97.634 47.338 107.978 47.338 114.361 50.588L155.415 71.508C158.609 73.133 160.2 75.266 160.2 77.399C160.2 79.532 158.603 81.66 155.415 83.285L69.148 127.239C62.765 130.49 52.421 130.49 46.039 127.239L4.985 106.32C1.791 104.695 0.2 102.562 0.2 100.429Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ==================================================================== */}
      {/* FLOATING ISOMETRIC ACCENTS (CLOCK / HISTORY & READING BADGES)         */}
      {/* ==================================================================== */}
      {/* Floating Isometric Clock / History Badge (Top Right) */}
      <g>
        {/* Badge 3D Thickness Side */}
        <path
          d="M141.5 35.2L118.5 21.8C117.2 21.0 115.8 21.0 114.8 21.6L116.8 20.3C117.8 19.7 119.2 19.7 120.5 20.5L143.5 33.9C146.8 35.8 149.2 40.5 149.2 44.5C149.2 46.8 148.4 48.4 147.1 49.0L145.1 50.3C146.4 49.7 147.2 48.1 147.2 45.8C147.2 41.8 144.8 37.1 141.5 35.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Badge Face */}
        <path
          d="M141.5 35.2C144.8 37.1 147.2 41.8 147.2 45.8C147.2 48.1 146.4 49.7 145.1 50.3C143.8 51.0 142.4 51.0 141.1 50.2L118.1 36.8C114.8 34.9 112.4 30.2 112.4 26.2C112.4 23.9 113.2 22.3 114.5 21.7C115.8 21.0 117.2 21.0 118.5 21.8L141.5 35.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Clock Center Dot & Hands (Recent / History Indicator) */}
        <circle cx="129.8" cy="36.0" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
        {/* Hour Hand */}
        <path
          d="M129.8 36.0L125.5 33.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        {/* Minute Hand */}
        <path
          d="M129.8 36.0L133.5 30.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>

      {/* Floating Sparkle / Star (Top Left) */}
      <g>
        <path
          d="M18.5 31.0L20.5 36.0L25.5 37.0L21.5 40.5L22.5 45.5L18.5 42.5L14.5 45.5L15.5 40.5L11.5 37.0L16.5 36.0L18.5 31.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          opacity="0.6"
        />
      </g>

      {/* ==================================================================== */}
      {/* 3D ISOMETRIC OPEN ACADEMIC BOOK / PAPERS (MAIN SUBJECT)              */}
      {/* ==================================================================== */}
      {/* Book Under-Cover / Spine Foundation */}
      <g>
        {/* Left Cover Underbelly */}
        <path
          d="M32.0 95.0L80.0 117.0L80.0 122.0L32.0 100.0V95.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Cover Underbelly */}
        <path
          d="M80.0 117.0L128.0 95.0V100.0L80.0 122.0V117.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Stacked Pages Thickness (Edge of multi-page paper) */}
      <g>
        {/* Left Side Pages Edge */}
        <path
          d="M33.0 93.0L80.0 115.0V118.0L33.0 96.0V93.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Side Pages Edge */}
        <path
          d="M80.0 115.0L127.0 93.0V96.0L80.0 118.0V115.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Main Open Pages Surface (White / Primary Surface) */}
      <g>
        {/* Left Page Spread */}
        <path
          d="M34.0 46.0L79.0 66.0V114.0L34.0 92.0V46.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Page Spread */}
        <path
          d="M81.0 66.0L126.0 46.0V92.0L81.0 114.0V66.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Book Spine Crease Depth */}
        <path
          d="M79.0 66.0L81.0 66.0V114.0L79.0 114.0V66.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>

      {/* Academic Paper Typography Lines & Visual Content */}
      <g opacity="0.85">
        {/* Left Page: Header Title Line */}
        <path
          d="M40.0 54.0L62.0 64.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Left Page: Text Column Lines */}
        <path
          d="M40.0 62.0L73.0 77.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M40.0 67.0L73.0 82.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M40.0 72.0L68.0 85.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M40.0 79.0L73.0 94.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M40.0 84.0L58.0 92.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />

        {/* Right Page: Diagram / Figure Box */}
        <path
          d="M87.0 68.0L115.0 56.0V72.0L87.0 84.0V68.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Page: Text Lines below diagram */}
        <path
          d="M87.0 90.0L120.0 75.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M87.0 95.0L112.0 84.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M87.0 100.0L118.0 86.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>

      {/* Silk Ribbon Bookmark (Trailing from book spine down to base) */}
      <g>
        <path
          d="M80.0 66.0L85.0 68.0L92.0 110.0L86.0 116.0L80.0 110.0L80.0 66.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ribbon Tail V-Cut */}
        <path
          d="M86.0 116.0L92.0 125.0L86.0 122.0L80.0 125.0L86.0 116.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

const illustrationStyles = `
  :root, .plane-recent-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-recent-illustration,
  [data-theme='dark'] .plane-recent-illustration {
    --illustration-fill-primary: #18181b;
    --illustration-fill-secondary: #27272a;
    --illustration-fill-tertiary: #3f3f46;
    --illustration-fill-quaternary: #52525b;
    --illustration-stroke-primary: #3f3f46;
    --illustration-stroke-secondary: #71717a;
    --illustration-stroke-tertiary: #e4e4e7;
  }
`;

/**
  * RecentlyReadEmptyState
  * Pure Flat Precision / Plane.so style empty state for Recently Read.
  * Strictly contains NO action buttons, seamless default background, and
  * authentic 3D isometric illustration.
  */
export function RecentlyReadEmptyState() {
  return (
    <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200">
      <style dangerouslySetInnerHTML={{ __html: illustrationStyles }} />

      {/* 3D Isometric Multi-Layer Recently Read Illustration */}
      <div className="plane-recent-illustration mb-6 flex items-center justify-center">
        <RecentlyReadVerticalStackIllustration />
      </div>

      {/* Title */}
      <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        No recently read references
      </h3>

      {/* Description */}
      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
        Papers and literature you open or read will appear here for quick access.
      </p>
    </div>
  );
}

export default RecentlyReadEmptyState;
