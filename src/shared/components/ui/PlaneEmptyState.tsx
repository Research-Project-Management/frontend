'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';

export const ILLUSTRATION_COLOR_TOKEN_MAP = {
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

export const planeIllustrationStyles = `
  :root, .plane-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-illustration,
  [data-theme='dark'] .plane-illustration {
    --illustration-fill-primary: #18181b;
    --illustration-fill-secondary: #27272a;
    --illustration-fill-tertiary: #3f3f46;
    --illustration-fill-quaternary: #52525b;
    --illustration-stroke-primary: #3f3f46;
    --illustration-stroke-secondary: #71717a;
    --illustration-stroke-tertiary: #e4e4e7;
  }
`;

export interface TIllustrationAssetProps {
  className?: string;
}

/**
 * Shared 3D Isometric Base Slabs (3 Depth Levels) - Identical to Library, Storage & Editor
 */
export function BaseSlabs() {
  return (
    <>
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
    </>
  );
}

/**
 * PlaneEmptyDocumentIllustration
 * 3D isometric open manuscript document sheet on top of spatial slabs.
 */
export function PlaneEmptyDocumentIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="104.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      <g opacity="0.5">
        <path
          d="M52.0 42.0L112.0 20.0L128.0 74.0L68.0 96.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </g>
      <g>
        <path
          d="M44.0 48.0L104.0 26.0L104.0 28.5L44.0 50.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path
          d="M44.0 50.5L104.0 28.5L120.0 82.5L60.0 104.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path
          d="M44.0 48.0L104.0 26.0L120.0 80.0L60.0 102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <path
          d="M96.0 29.0L104.0 26.0L100.0 38.0L96.0 29.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path d="M54.0 52.0L78.0 43.5" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M54.0 59.0L102.0 41.5" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 65.0L96.0 49.5" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 71.0L90.0 58.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 77.0L106.0 58.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 83.0L82.0 73.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g>
        <rect
          x="22"
          y="32"
          width="24"
          height="16"
          rx="3"
          transform="rotate(-15 22 32)"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
        <path d="M26.0 38.0L29.0 35.0L26.0 32.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33.0 39.0L39.0 37.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <circle cx="138" cy="42" r="2.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
      <circle cx="146" cy="36" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
    </svg>
  );
}

/**
 * PlaneEmptyPdfIllustration
 * 3D isometric compiled PDF preview canvas.
 */
export function PlaneEmptyPdfIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="105.0"
        rx="38.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      <g>
        <path
          d="M40.0 46.0L80.0 66.0L80.0 98.0L40.0 78.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        <path
          d="M80.0 66.0L120.0 46.0L120.0 78.0L80.0 98.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        <path d="M80.0 66.0V98.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.8" />
        <path d="M46.0 54.0L74.0 68.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M46.0 59.0L74.0 73.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M46.0 64.0L66.0 74.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M86.0 68.0L114.0 54.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M86.0 73.0L114.0 59.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M86.0 78.0L106.0 68.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g>
        <path
          d="M80.0 18.0L98.0 28.0L80.0 38.0L62.0 28.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <path
          d="M62.0 28.0L80.0 38.0V43.0L62.0 33.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path
          d="M80.0 38.0L98.0 28.0V33.0L80.0 43.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path d="M77.5 25.0L84.0 28.0L77.5 31.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
      </g>
    </svg>
  );
}

/**
 * PlaneDetachedIllustration
 * 3D isometric popout window hovering over base platform.
 */
export function PlaneDetachedIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      <g>
        <path
          d="M42.0 34.0L118.0 34.0L122.0 40.0L46.0 40.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path
          d="M118.0 34.0L122.0 40.0L122.0 94.0L118.0 88.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <rect
          x="42"
          y="38"
          width="76"
          height="52"
          rx="4"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
        <path
          d="M42 42C42 39.7909 43.7909 38 46 38H114C116.209 38 118 39.7909 118 42V48H42V42Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <circle cx="48" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="53" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="58" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <path
          d="M74.0 66.0L86.0 54.0M86.0 54.0H78.0M86.0 54.0V62.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M70.0 58.0H66.0C64.8954 58.0 64.0 58.8954 64.0 60.0V74.0C64.0 75.1046 64.8954 76.0 66.0 76.0H80.0C81.1046 76.0 82.0 75.1046 82.0 74.0V70.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * PlaneReviewIllustration
 * 3D isometric comment & review conversation stack.
 */
export function PlaneReviewIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Back speech bubble */}
      <g opacity="0.6">
        <path
          d="M52.0 40.0C52.0 35.5817 55.5817 32.0 60.0 32.0H108.0C112.418 32.0 116.0 35.5817 116.0 40.0V64.0C116.0 68.4183 112.418 72.0 108.0 72.0H88.0L78.0 82.0V72.0H60.0C55.5817 72.0 52.0 68.4183 52.0 64.0V40.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
      </g>
      {/* Front conversation card */}
      <g>
        <path
          d="M38.0 52.0C38.0 47.5817 41.5817 44.0 46.0 44.0H96.0C100.418 44.0 104.0 47.5817 104.0 52.0V78.0C104.0 82.4183 100.418 86.0 96.0 86.0H72.0L60.0 96.0V86.0H46.0C41.5817 86.0 38.0 82.4183 38.0 78.0V52.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
        <circle cx="48.0" cy="56.0" r="3.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <path d="M56.0 56.0H88.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M48.0 64.0H94.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M48.0 70.0H80.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M48.0 76.0H70.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * PlaneHistoryIllustration
 * 3D isometric timeline & snapshot history stack.
 */
export function PlaneHistoryIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* 3 Stacked Snapshot Discs */}
      <g>
        <ellipse cx="80" cy="74" rx="34" ry="14" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <ellipse cx="80" cy="62" rx="34" ry="14" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <ellipse cx="80" cy="50" rx="34" ry="14" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.6" />
        {/* Clock Hands / Branch Node */}
        <circle cx="80" cy="50" r="3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
        <path d="M80 50L92 46" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M80 50L80 40" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * PlaneSearchIllustration
 * 3D isometric magnifying lens scanning document.
 */
export function PlaneSearchIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Document Sheet */}
      <path
        d="M48.0 52.0L108.0 32.0L118.0 76.0L58.0 96.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
      />
      <path d="M56.0 58.0L98.0 44.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M56.0 66.0L92.0 54.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M56.0 74.0L86.0 64.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      {/* Magnifier Glass */}
      <g>
        <circle
          cx="76.0"
          cy="48.0"
          r="18.0"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
        />
        <circle
          cx="76.0"
          cy="48.0"
          r="13.0"
          fill="none"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.6"
        />
        {/* Handle */}
        <path
          d="M89.0 61.0L106.0 78.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="3.0"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * PlaneFilesStackIllustration
 * 3D isometric file folders and tree nodes stack.
 */
export function PlaneFilesStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Folder Back */}
      <path
        d="M38.0 52.0L66.0 42.0L78.0 48.0L122.0 34.0L126.0 74.0L42.0 92.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
      />
      {/* File Paper Slipping In */}
      <path
        d="M52.0 38.0L98.0 24.0L108.0 66.0L62.0 80.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
      />
      {/* Folder Front */}
      <path
        d="M36.0 62.0L118.0 38.0L124.0 80.0L42.0 102.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.6"
      />
    </svg>
  );
}

/**
 * PlaneCitationIllustration
 * 3D isometric academic books & reference binder stack.
 */
export function PlaneCitationIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Bottom Book */}
      <path
        d="M44.0 68.0L116.0 46.0L122.0 58.0L50.0 80.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
      />
      {/* Top Book */}
      <path
        d="M40.0 52.0L112.0 30.0L118.0 42.0L46.0 64.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.6"
      />
      {/* Bookmark Ribbon */}
      <path
        d="M68.0 36.0L76.0 33.0L78.0 56.0L72.0 52.0L66.0 56.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
        strokeWidth="0.4"
      />
    </svg>
  );
}

/**
 * PlaneChatIllustration
 * 3D isometric AI sparkle & conversation beacon.
 */
export function PlaneChatIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Chat Monolith */}
      <g>
        <path
          d="M44.0 42.0C44.0 37.5817 47.5817 34.0 52.0 34.0H108.0C112.418 34.0 116.0 37.5817 116.0 42.0V72.0C116.0 76.4183 112.418 80.0 108.0 80.0H84.0L70.0 92.0V80.0H52.0C47.5817 80.0 44.0 76.4183 44.0 72.0V42.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
        {/* Central AI Sparkle / Star in Bubble */}
        <path
          d="M80.0 44.0L82.5 52.5L91.0 55.0L82.5 57.5L80.0 66.0L77.5 57.5L69.0 55.0L77.5 52.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}

/**
 * PlaneLogsIllustration
 * 3D isometric terminal / compiler console screen.
 */
export function PlaneLogsIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BaseSlabs />
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />
      {/* Console Terminal Screen */}
      <g>
        <rect
          x="40"
          y="36"
          width="80"
          height="54"
          rx="4"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
        <path d="M40 44H120" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <circle cx="46" cy="40" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="50" cy="40" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="54" cy="40" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        {/* Terminal Prompt >_ */}
        <path d="M48 54L54 59L48 64" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M58 64H72" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M48 72H96" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export type PlaneEmptyVariant =
  | 'document'
  | 'preview'
  | 'detached'
  | 'review'
  | 'history'
  | 'search'
  | 'files'
  | 'citations'
  | 'chat'
  | 'logs'
  | 'default';

export interface PlaneEmptyAction {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export interface PlaneEmptyStateProps {
  variant?: PlaneEmptyVariant;
  title?: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode | PlaneEmptyAction;
  illustration?: React.ReactNode | React.ComponentType<{ className?: string }>;
  className?: string;
  isCompact?: boolean;
}

interface EmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string | React.ReactNode;
}

/**
 * PlaneEmptyState
 * Canonical Flat Precision / Plane.so & Flux empty state primitive.
 * Multi-layer spatial illustrations, clean semantic typography tokens, zero nested dashed boxes.
 */
export function PlaneEmptyState({
  variant = 'document',
  title: customTitle,
  description: customDescription,
  action,
  illustration: customIllustration,
  className,
  isCompact = false,
}: PlaneEmptyStateProps) {
  const getDefaultConfig = (): EmptyConfig => {
    switch (variant) {
      case 'preview':
        return {
          illustration: PlaneEmptyPdfIllustration,
          title: 'No PDF preview',
          description: (
            <span>
              Click <strong className="font-semibold text-foreground">Recompile</strong> on the toolbar or press{' '}
              <kbd className="px-1.5 py-0.5 text-11 font-mono font-medium rounded-md border bg-muted border-border text-foreground">
                Ctrl+Enter
              </kbd>{' '}
              to build your document.
            </span>
          ),
        };
      case 'detached':
        return {
          illustration: PlaneDetachedIllustration,
          title: 'PDF viewer detached',
          description: 'Document preview is currently running in a separate window.',
        };
      case 'review':
        return {
          illustration: PlaneReviewIllustration,
          title: 'No comments or suggestions',
          description: 'Comments, inline discussion threads, and suggested edits will appear here.',
        };
      case 'history':
        return {
          illustration: PlaneHistoryIllustration,
          title: 'No revisions found',
          description: 'Milestones and compilation snapshots will automatically be checkpointed as you edit.',
        };
      case 'search':
        return {
          illustration: PlaneSearchIllustration,
          title: 'No matching results',
          description: 'No text or symbols matching your search query were found across project files.',
        };
      case 'files':
        return {
          illustration: PlaneFilesStackIllustration,
          title: 'No files in project',
          description: 'Create a new file or upload project sources to begin editing.',
        };
      case 'citations':
        return {
          illustration: PlaneCitationIllustration,
          title: 'No citations found',
          description: 'Bibliography entries from your .bib files or library references will appear here.',
        };
      case 'chat':
        return {
          illustration: PlaneChatIllustration,
          title: 'No messages yet',
          description: 'Start a conversation with the AI academic research assistant.',
        };
      case 'logs':
        return {
          illustration: PlaneLogsIllustration,
          title: 'Compilation clean',
          description: 'No errors, warnings, or raw engine log lines to display.',
        };
      case 'document':
      default:
        return {
          illustration: PlaneEmptyDocumentIllustration,
          title: 'No file selected',
          description: 'Select a document from the file tree or create a new file to start writing.',
        };
    }
  };

  const config = getDefaultConfig();
  const title = customTitle ?? config.title;
  const description = customDescription ?? config.description;

  const renderIllustration = () => {
    if (customIllustration) {
      if (React.isValidElement(customIllustration)) {
        return customIllustration;
      }
      const CustomComp = customIllustration as React.ComponentType<{ className?: string }>;
      return <CustomComp className={cn('w-32 h-36 mx-auto', isCompact && 'w-24 h-28')} />;
    }
    const IllustrationComp = config.illustration;
    return <IllustrationComp className={cn('w-32 h-36 mx-auto', isCompact && 'w-24 h-28')} />;
  };

  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) {
      return <div className="mt-4 flex items-center justify-center">{action}</div>;
    }
    const actionObj = action as PlaneEmptyAction;
    const IconComp = actionObj.icon;
    return (
      <div className="mt-4 flex items-center justify-center">
        <Button
          size="sm"
          variant="outline"
          onClick={actionObj.onClick}
          className="h-8 px-3.5 text-xs font-medium rounded-md gap-1.5 cursor-pointer shadow-xs border-border hover:bg-muted text-foreground"
        >
          {IconComp && (
            React.isValidElement(IconComp) ? (
              IconComp
            ) : (
              React.createElement(IconComp as React.ComponentType<{ className?: string }>, {
                className: 'size-3.5 shrink-0',
              })
            )
          )}
          <span>{actionObj.label}</span>
        </Button>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col items-center justify-center text-center select-none bg-transparent text-foreground',
        isCompact ? 'min-h-[160px] p-4 gap-2' : 'min-h-[220px] p-8 gap-3',
        className,
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: planeIllustrationStyles }} />

      <div className="flex items-center justify-center shrink-0">
        {renderIllustration()}
      </div>

      <div className={cn('max-w-xs space-y-1', isCompact ? 'px-2' : 'px-4')}>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight leading-snug">
          {title}
        </h3>
        {description && (
          <p className="text-12 text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {renderAction()}
    </div>
  );
}
