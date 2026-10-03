'use client';

import React from 'react';

export const yourWorkIllustrationStyles = `
  :root, .plane-your-work-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-your-work-illustration,
  [data-theme='dark'] .plane-your-work-illustration {
    --illustration-fill-primary: #18181b;
    --illustration-fill-secondary: #27272a;
    --illustration-fill-tertiary: #3f3f46;
    --illustration-fill-quaternary: #52525b;
    --illustration-stroke-primary: #3f3f46;
    --illustration-stroke-secondary: #71717a;
    --illustration-stroke-tertiary: #e4e4e7;
  }
`;

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

export interface TIllustrationAssetProps {
  className?: string;
}

/**
 * Shared Isometric 3-Tier Base Slab Foundation (Plane.so design system)
 */
function IsometricBaseSlabs() {
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
 * 1. YourWorkSummaryIllustration
 * Represents the overall workload overview / dashboard
 */
export function YourWorkSummaryIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Isometric Central Workload Hub Slabs */}
      <g>
        {/* Layer 1 */}
        <path
          d="M48 85 L81 68 L114 85 L81 102 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        {/* Layer 2 (Raised) */}
        <path
          d="M54 75 L81 61 L108 75 L81 89 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        {/* Top Floating Badge */}
        <path
          d="M62 64 L81 54 L100 64 L81 74 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* Minimalist Dashboard Bars on Top Slab */}
        <line
          x1="73"
          y1="64"
          x2="79"
          y2="61"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="81"
          y1="67"
          x2="89"
          y2="63"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * 2. YourWorkAssignedIllustration
 * Represents work items assigned to the current user
 */
export function YourWorkAssignedIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Floating Assigned Card Slabs */}
      <g>
        <path
          d="M48 82 L81 65 L114 82 L81 99 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        <path
          d="M52 74 L81 59 L110 74 L81 89 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* Isometric Checkmark badge */}
        <circle
          cx="81"
          cy="74"
          r="8"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        <path
          d="M78 74 L80.5 76.5 L84.5 72"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * 3. YourWorkCreatedIllustration
 * Represents work items created by the user
 */
export function YourWorkCreatedIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Floating Created Document / Draft Stack */}
      <g>
        <path
          d="M50 84 L81 68 L112 84 L81 100 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        <path
          d="M54 75 L81 61 L108 75 L81 89 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* New Item Beacon (Plus emblem) */}
        <circle
          cx="81"
          cy="75"
          r="8"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.8"
        />
        <line
          x1="81"
          y1="71"
          x2="81"
          y2="79"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="77"
          y1="75"
          x2="85"
          y2="75"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * 4. YourWorkSubscribedIllustration
 * Represents work items the user is subscribed to or collaborating on
 */
export function YourWorkSubscribedIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Floating Collaboration / Bell Badge */}
      <g>
        <path
          d="M52 82 L81 67 L110 82 L81 97 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        <path
          d="M56 74 L81 61 L106 74 L81 87 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* Bell / Star symbol */}
        <circle
          cx="81"
          cy="74"
          r="7.5"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.8"
        />
        <path
          d="M81 70 L82.5 73.5 L86 73.8 L83.5 76 L84.2 79.5 L81 77.8 L77.8 79.5 L78.5 76 L76 73.8 L79.5 73.5 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * 5. YourWorkActivityIllustration
 * Represents recent user / workspace activities
 */
export function YourWorkActivityIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Floating Timeline / Clock Hub */}
      <g>
        <path
          d="M50 82 L81 66 L112 82 L81 98 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        <path
          d="M55 74 L81 60 L107 74 L81 88 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* Clock dial emblem */}
        <circle
          cx="81"
          cy="74"
          r="8"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        <polyline
          points="81,70 81,74 84,76"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * 6. YourWorkSearchIllustration
 * Represents empty search filter results in your-work
 */
export function YourWorkSearchIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <IsometricBaseSlabs />

      {/* Floating Search Beacon */}
      <g>
        <path
          d="M52 82 L81 67 L110 82 L81 97 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.75"
        />
        <path
          d="M56 74 L81 61 L106 74 L81 87 Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />
        {/* Magnifying Glass */}
        <circle
          cx="79"
          cy="72"
          r="5.5"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1"
        />
        <line
          x1="83"
          y1="76"
          x2="87"
          y2="80"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
