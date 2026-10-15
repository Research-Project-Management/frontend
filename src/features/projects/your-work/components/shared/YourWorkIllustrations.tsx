'use client';

import React from 'react';
import {
  BaseSlabs as IsometricBaseSlabs,
  ILLUSTRATION_COLOR_TOKEN_MAP,
} from '@/shared/components/ui/PlaneEmptyState';

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

export interface TIllustrationAssetProps {
  className?: string;
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
