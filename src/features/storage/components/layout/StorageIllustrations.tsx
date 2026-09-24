'use client';

import React from 'react';

export const storageIllustrationStyles = `
  :root, .plane-storage-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-storage-illustration,
  [data-theme='dark'] .plane-storage-illustration {
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
 * Shared Isometric 3-Tier Base Slab Foundation
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
 * StorageFilesStackIllustration
 * 3D isometric storage folder with documents & cloud upload beacon.
 * Standard for Home & My Files.
 */
export function StorageFilesStackIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Floating Upload / Cloud Badge (Top Right) */}
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M146.352 33.0833C147.903 32.2932 148.891 30.4254 148.891 27.7674C148.891 23.0103 145.72 17.5364 141.814 15.55L115.63 2.20966C113.904 1.32933 112.323 1.2729 111.093 1.89929L113.61 0.618291C114.84 -0.00809748 116.42 0.0483357 118.147 0.928666L144.331 14.2691C148.242 16.2611 151.408 21.7349 151.408 26.4864C151.408 29.1444 150.42 31.0122 148.868 31.8023L146.352 33.0833Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M146.352 33.0833C145.121 33.7097 143.541 33.6532 141.814 32.7729L115.63 19.4325C111.72 17.4405 108.554 11.9667 108.554 7.21513C108.554 4.55721 109.541 2.68933 111.093 1.89929C112.323 1.2729 113.904 1.32933 115.63 2.20966L141.814 15.55C145.725 17.5421 148.891 23.0159 148.891 27.7674C148.891 30.4254 147.903 32.2932 146.352 33.0833Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M129.5 14.5L124.5 17.5V19.5L128.5 17.0V22.5H130.5V17.0L134.5 19.5V17.5L129.5 14.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <path
          d="M123.5 22.5L129.5 25.5L135.5 22.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Floating Document Badge (Top Left) */}
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.97 29.049C11.108 29.997 9.601 32.604 9.601 34.867C9.601 37.13 11.108 38.202 12.97 37.248C14.833 36.294 16.339 33.693 16.339 31.43C16.339 29.167 14.833 28.095 12.97 29.049ZM8.851 35.25C8.851 32.48 10.696 29.297 12.97 28.14C15.245 26.983 17.09 28.287 17.09 31.052C17.09 33.817 15.245 37.005 12.97 38.162C10.696 39.319 8.851 38.015 8.851 35.25Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.97 30.871C11.938 31.396 11.097 32.846 11.097 34.105C11.097 35.363 11.938 35.956 12.97 35.431C14.003 34.906 14.844 33.456 14.844 32.197C14.844 30.939 14.003 30.346 12.97 30.871Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>

      {/* 3D Folder Body & Back Wall */}
      <g>
        <path
          d="M42.0 85.0L98.0 57.0V9.0L68.0 24.0L64.0 20.0L42.0 31.0V85.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.0 31.0L64.0 20.0L68.0 24.0L98.0 9.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      </g>

      {/* Document Sheet 1 */}
      <g opacity="0.65">
        <path
          d="M46.5 87.5L96.5 62.5V11.0L46.5 36.0V87.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.0 43.0L82.0 29.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M55.0 49.0L76.0 38.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M55.0 55.0L71.0 47.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Document Sheet 2 */}
      <g>
        <path
          d="M51.0 92.5L101.0 67.5V33.0L90.0 24.5L51.0 44.0V92.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M90.0 24.5V33.0H101.0L90.0 24.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
        <path
          d="M59.0 51.5L75.0 43.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M59.0 58.0L88.0 43.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M59.0 64.0L84.0 51.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* 3D Folder Front Pocket */}
      <g>
        <path
          d="M38.0 73.0L42.0 75.0V109.0L38.0 107.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38.0 73.0L96.0 44.0V78.0L38.0 107.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        />
        <path
          d="M38.0 73.0L96.0 44.0V47.0L38.0 76.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        <path
          d="M38.0 73.0L96.0 44.0V78.0L38.0 107.0V73.0Z"
          fill="none"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M60.0 85.0L80.0 75.0V77.5L60.0 87.5V85.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <circle
          cx="84.5"
          cy="74.5"
          r="1.2"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        />
      </g>
    </svg>
  );
}

/**
 * StorageSharedStackIllustration
 * 3D isometric illustration for Shared Storage (shared links, collaborative network).
 */
export function StorageSharedStackIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Floating Link/Share Beacon (Top Right) */}
      <g>
        <path
          d="M136.0 20.0L120.0 28.0L108.0 22.0L124.0 14.0L136.0 20.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        <circle cx="120.0" cy="21.0" r="2.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
      </g>

      {/* Upright Central Shared Document Monolith */}
      <g>
        {/* Left Side Extrusion */}
        <path
          d="M48.0 62.0L53.0 64.5V106.0L48.0 103.5V62.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        {/* Front Face */}
        <path
          d="M53.0 64.5L108.0 37.0V78.5L53.0 106.0V64.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
        />
        {/* Top Rim */}
        <path
          d="M48.0 62.0L103.0 34.5L108.0 37.0L53.0 64.5L48.0 62.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />

        {/* Isometric Shared Link Nodes inside Document */}
        {/* Node A (Upper Left) */}
        <ellipse cx="68.0" cy="67.0" rx="3.5" ry="2.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="0.8" />
        {/* Node B (Lower Right) */}
        <ellipse cx="92.0" cy="55.0" rx="3.5" ry="2.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="0.8" />
        {/* Connecting Cable */}
        <path
          d="M68.0 67.0L92.0 55.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
          strokeDasharray="2 1.5"
        />

        {/* Content detail lines */}
        <path d="M62.0 80.0L96.0 63.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M62.0 87.0L86.0 75.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>

      {/* Floating Sparkle / Orbit Beacon */}
      <circle cx="28.0" cy="48.0" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
    </svg>
  );
}

/**
 * StorageStarredStackIllustration
 * 3D isometric faceted star rising on stacked slabs for Starred Storage.
 */
export function StorageStarredStackIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Floating Sparkle 1 */}
      <path
        d="M26.0 42.0L27.5 45.5L31.0 47.0L27.5 48.5L26.0 52.0L24.5 48.5L21.0 47.0L24.5 45.5L26.0 42.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
      />

      {/* Floating Sparkle 2 */}
      <path
        d="M136.0 28.0L137.2 31.0L140.2 32.2L137.2 33.4L136.0 36.4L134.8 33.4L131.8 32.2L134.8 31.0L136.0 28.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
      />

      {/* 3D Star Platform Base Pedestal */}
      <g>
        <path
          d="M56.0 102.0L80.0 90.0L104.0 102.0L80.0 114.0L56.0 102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        <path
          d="M56.0 102.0V105.0L80.0 117.0V114.0L56.0 102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        <path
          d="M104.0 102.0V105.0L80.0 117.0V114.0L104.0 102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>

      {/* Upright 3D Faceted Star */}
      <g>
        {/* Star Upper Top Apex Face (Left) */}
        <path
          d="M80.0 26.0L69.0 58.0L80.0 68.0V26.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Star Upper Top Apex Face (Right) */}
        <path
          d="M80.0 26.0L91.0 58.0L80.0 68.0V26.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Star Left Horizontal Point (Top) */}
        <path
          d="M44.0 60.0L69.0 58.0L80.0 68.0L44.0 60.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Star Left Horizontal Point (Bottom) */}
        <path
          d="M44.0 60.0L63.0 80.0L80.0 68.0L44.0 60.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Star Right Horizontal Point (Top) */}
        <path
          d="M116.0 60.0L91.0 58.0L80.0 68.0L116.0 60.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Star Right Horizontal Point (Bottom) */}
        <path
          d="M116.0 60.0L97.0 80.0L80.0 68.0L116.0 60.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Star Bottom-Left Leg (Outer) */}
        <path
          d="M58.0 106.0L63.0 80.0L80.0 68.0L80.0 94.0L58.0 106.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Star Bottom-Right Leg (Outer) */}
        <path
          d="M102.0 106.0L97.0 80.0L80.0 68.0L80.0 94.0L102.0 106.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Central Ridge Highlight */}
        <path
          d="M80.0 26.0V94.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * StorageTrashStackIllustration
 * 3D isometric open waste prism for Trash Storage.
 */
export function StorageTrashStackIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Upright 3D Hexagonal Waste Receptacle / Bin */}
      <g>
        {/* Bin Back Rim & Interior */}
        <path
          d="M56.0 58.0L80.0 46.0L104.0 58.0L80.0 70.0L56.0 58.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Recycled paper scrap falling inside */}
        <path
          d="M72.0 54.0L86.0 47.0L90.0 53.0L76.0 60.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />

        {/* Bin Left Outer Wall */}
        <path
          d="M56.0 58.0L62.0 102.0L80.0 111.0V70.0L56.0 58.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Bin Right Outer Wall */}
        <path
          d="M104.0 58.0L98.0 102.0L80.0 111.0V70.0L104.0 58.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Bin Vertical Rib Fluting Lines */}
        <path d="M68.0 64.0L72.0 105.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.6" strokeLinecap="round" />
        <path d="M92.0 64.0L88.0 105.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.6" strokeLinecap="round" />
      </g>

      {/* Floating Tilted Bin Lid hovering above */}
      <g>
        <path
          d="M52.0 44.0L76.0 32.0L106.0 42.0L82.0 54.0L52.0 44.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* Lid Handle */}
        <path
          d="M74.0 36.0L84.0 41.0V38.0L74.0 33.0V36.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>
    </svg>
  );
}

/**
 * StorageSearchStackIllustration
 * 3D isometric magnifying glass & optical lens for Search Storage.
 */
export function StorageSearchStackIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Flat Document Grid Sheet Resting on Base Slab */}
      <g>
        <path
          d="M48.0 95.0L92.0 73.0L114.0 84.0L70.0 106.0L48.0 95.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        <path d="M58.0 93.0L88.0 78.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M64.0 98.0L94.0 83.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>

      {/* Upright Floating 3D Magnifying Glass */}
      <g>
        {/* Handle Extrusion */}
        <path
          d="M102.0 74.0L126.0 86.0L123.0 90.0L99.0 78.0L102.0 74.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Outer Lens Bezel Rim */}
        <ellipse
          cx="76.0"
          cy="52.0"
          rx="26.0"
          ry="19.0"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
        />

        {/* Inner Glass Prism Face with Optical Transparency */}
        <ellipse
          cx="76.0"
          cy="52.0"
          rx="21.0"
          ry="15.0"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />

        {/* Glass Glare / Reflection Arc */}
        <path
          d="M62.0 46.0C64.0 41.0 72.0 38.0 82.0 40.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
