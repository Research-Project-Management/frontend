'use client';

import React from 'react';
import { Button } from '@/shared/components/ui';

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
 * StorageVerticalStackIllustration
 * 3D isometric multi-layered illustration designed for Flux Cloud Storage.
 * Features 3 stacked isometric spatial base slabs with an upright 3D storage folder,
 * layered document sheets sliding out, 3D front pocket, and floating cloud upload badge.
 */
export function StorageVerticalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M0.200012 143.469C0.200012 145.602 1.79701 147.729 4.98538 149.36L46.0392 170.279C52.4216 173.53 62.7655 173.53 69.1479 170.279L155.415 126.325C158.603 124.7 160.2 122.572 160.2 120.439V127.25C160.2 129.384 158.603 131.511 155.415 133.136L69.1479 177.091C62.7655 180.341 52.4216 180.341 46.0392 177.091L4.98538 156.172C1.79137 154.546 0.200012 152.413 0.200012 150.28V143.469Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.200012 143.469C0.200012 141.336 1.79701 139.208 4.98538 137.583L91.252 93.6286C97.6344 90.3781 107.978 90.3781 114.361 93.6286L155.415 114.548C158.609 116.173 160.2 118.306 160.2 120.439C160.2 122.572 158.603 124.7 155.415 126.325L69.1479 170.279C62.7655 173.53 52.4216 173.53 46.0392 170.279L4.98538 149.36C1.79137 147.735 0.200012 145.602 0.200012 143.469Z"
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
          d="M0.200012 121.952C0.200012 124.085 1.79701 126.212 4.98538 127.843L46.0392 148.762C52.4216 152.013 62.7655 152.013 69.1479 148.762L155.415 104.808C158.603 103.182 160.2 101.055 160.2 98.9219V105.733C160.2 107.866 158.603 109.994 155.415 111.619L69.1479 155.573C62.7655 158.824 52.4216 158.824 46.0392 155.573L4.98538 134.654C1.79137 133.029 0.200012 130.896 0.200012 128.763V121.952Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.200012 121.952C0.200012 119.818 1.79701 117.691 4.98538 116.066L91.252 72.1113C97.6344 68.8608 107.978 68.8608 114.361 72.1113L155.415 93.0304C158.609 94.6556 160.2 96.7887 160.2 98.9218C160.2 101.055 158.603 103.182 155.415 104.808L69.1479 148.762C62.7655 152.013 52.4216 152.013 46.0392 148.762L4.98538 127.843C1.79137 126.218 0.200012 124.085 0.200012 121.952Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Base Slab 3 (Top Platform) */}
      <path
        d="M0.200012 100.429C0.200012 102.562 1.79701 104.689 4.98538 106.32L46.0392 127.239C52.4216 130.49 62.7655 130.49 69.1479 127.239L155.415 83.2847C158.603 81.6595 160.2 79.532 160.2 77.3989V84.2102C160.2 86.3433 158.603 88.4707 155.415 90.096L69.1479 134.05C62.7655 137.301 52.4216 137.301 46.0392 134.05L4.98538 113.131C1.79137 111.506 0.200012 109.373 0.200012 107.24V100.429Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.200012 100.429C0.200012 98.2954 1.79701 96.168 4.98538 94.5428L91.252 50.5883C97.6344 47.3379 107.978 47.3379 114.361 50.5883L155.415 71.5075C158.609 73.1327 160.2 75.2658 160.2 77.3989C160.2 79.532 158.603 81.6595 155.415 83.2847L69.1479 127.239C62.7655 130.49 52.4216 130.49 46.0392 127.239L4.98538 106.32C1.79137 104.695 0.200012 102.562 0.200012 100.429Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ==================================================================== */}
      {/* FLOATING ISOMETRIC CLOUD & FILE BADGES                               */}
      {/* ==================================================================== */}
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
        {/* Upload Arrow inside the floating badge */}
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

      {/* Floating File / Document Badge (Top Left) */}
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.9704 29.0485C11.1082 29.9965 9.60146 32.6037 9.60146 34.8666C9.60146 37.1295 11.1082 38.2017 12.9704 37.248C14.8326 36.2943 16.3393 33.6928 16.3393 31.4299C16.3393 29.167 14.8326 28.0948 12.9704 29.0485ZM8.85101 35.2503C8.85101 32.4795 10.6962 29.2968 12.9704 28.1399C15.2446 26.9831 17.0899 28.2867 17.0899 31.0518C17.0899 33.8169 15.2446 37.0053 12.9704 38.1622C10.6962 39.319 8.85101 38.0154 8.85101 35.2503Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.9704 30.8712C11.9377 31.396 11.097 32.8463 11.097 34.1047C11.097 35.3632 11.9377 35.9557 12.9704 35.4309C14.0031 34.9061 14.8439 33.4558 14.8439 32.1974C14.8439 30.9389 14.0031 30.3464 12.9704 30.8712Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>

      {/* ==================================================================== */}
      {/* 3D ISOMETRIC STORAGE FOLDER & LAYERED FILES (SPATIAL DEPTH)          */}
      {/* ==================================================================== */}
      {/* 1. Folder Back Wall with Folder Tab */}
      <g>
        {/* Back Wall Body */}
        <path
          d="M42.0 85.0L98.0 57.0V9.0L68.0 24.0L64.0 20.0L42.0 31.0V85.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Tab Highlight & 3D Depth Rim */}
        <path
          d="M42.0 31.0L64.0 20.0L68.0 24.0L98.0 9.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      </g>

      {/* 2. Layered Documents Peeking Out of Folder */}
      {/* Document Sheet 1 (Back Layer - opacity 0.5) */}
      <g opacity="0.65">
        <path
          d="M46.5 87.5L96.5 62.5V11.0L46.5 36.0V87.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Content Data Lines */}
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

      {/* Document Sheet 2 (Front Layer - Main Active Document) */}
      <g>
        {/* Document Body */}
        <path
          d="M51.0 92.5L101.0 67.5V33.0L90.0 24.5L51.0 44.0V92.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Folded Dog-Ear Corner */}
        <path
          d="M90.0 24.5V33.0H101.0L90.0 24.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
        {/* Document Header Bar */}
        <path
          d="M59.0 51.5L75.0 43.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Document Row Lines */}
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
        <path
          d="M59.0 70.0L79.0 60.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* 3. 3D Isometric Folder Front Flap / Pocket */}
      <g>
        {/* Pocket Left Side Wall (3D Depth Extrusion) */}
        <path
          d="M38.0 73.0L42.0 75.0V109.0L38.0 107.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pocket Front Face (Angled Open Forward in 3D Perspective) */}
        <path
          d="M38.0 73.0L96.0 44.0V78.0L38.0 107.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        />

        {/* Pocket Beveled Top Rim Lip */}
        <path
          d="M38.0 73.0L96.0 44.0V47.0L38.0 76.0V73.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />

        {/* Pocket Outer Contour Outline */}
        <path
          d="M38.0 73.0L96.0 44.0V78.0L38.0 107.0V73.0Z"
          fill="none"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pocket Embossed File Storage Tag / Slot */}
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

const illustrationStyles = `
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

export interface StorageEmptyStateProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  isReadOnly?: boolean;
  isTrash?: boolean;
}

/**
 * StorageEmptyState
 * Empty state for the Storage module conforming to the Plane.so / Flux 3D isometric multi-layer design standard.
 */
export function StorageEmptyState({
  searchQuery = '',
  onClearSearch,
  isReadOnly = false,
  isTrash = false,
}: StorageEmptyStateProps) {
  const isSearchActive = Boolean(searchQuery.trim());

  const handleTriggerUpload = () => {
    window.dispatchEvent(new CustomEvent('trigger-upload-file'));
  };

  const handleTriggerCreateFolder = () => {
    window.dispatchEvent(new CustomEvent('open-create-folder'));
  };

  const getTitle = () => {
    if (isSearchActive) return 'No files or folders found.';
    if (isTrash) return 'Trash is empty.';
    return 'Start with your first file.';
  };

  const getDescription = () => {
    if (isSearchActive) {
      return `No files match "${searchQuery}". Try checking for spelling errors or clearing your search query.`;
    }
    if (isTrash) {
      return 'Deleted files and folders will appear here until permanently cleared.';
    }
    return 'Storage keeps all your research datasets, assets, and files secure — upload files, create folders, and organize assets easily.';
  };

  return (
    <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200">
      <style dangerouslySetInnerHTML={{ __html: illustrationStyles }} />

      {/* 3D Isometric Multi-Layer Storage Illustration */}
      <div className="plane-storage-illustration mb-6 flex items-center justify-center">
        <StorageVerticalStackIllustration />
      </div>

      {/* Title */}
      <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {getTitle()}
      </h3>

      {/* Description */}
      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed mb-6 font-normal">
        {getDescription()}
      </p>

      {/* Action Buttons */}
      {isSearchActive ? (
        <Button
          type="button"
          onClick={onClearSearch}
          size="sm"
          className="h-8 px-4 rounded-md font-medium text-13 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
        >
          Clear search
        </Button>
      ) : !isReadOnly && !isTrash ? (
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={handleTriggerUpload}
            size="sm"
            className="h-8 px-4 rounded-md font-medium text-13 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
          >
            Upload your first file
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleTriggerCreateFolder}
            size="sm"
            className="h-8 px-4 rounded-md font-medium text-13 border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
          >
            New folder
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default StorageEmptyState;
