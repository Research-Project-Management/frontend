'use client';

import React, { useRef } from 'react';
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
 * LibraryVerticalStackIllustration
 * 3D isometric multi-layered illustration designed specifically for Flux Library (Academic Research).
 * Features 3 stacked isometric spatial base slabs with upright 3D research paper manuscripts,
 * layered citations, and floating isometric citation badges.
 */
export function LibraryVerticalStackIllustration({ className }: TIllustrationAssetProps) {
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
      {/* FLOATING ISOMETRIC CITATION BADGES & METADATA                         */}
      {/* ==================================================================== */}
      {/* Floating Citation Quotation Badge (Top Right) */}
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
        {/* Double Citation Quote Marks inside the floating badge */}
        <path
          d="M124.5 17.2C123.8 16.8 123.4 15.8 123.7 15.2C124.0 14.6 124.9 14.6 125.6 15.0C126.3 15.4 126.6 16.3 126.2 17.5L125.2 20.2H123.8L124.5 17.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <path
          d="M130.5 20.2C129.8 19.8 129.4 18.8 129.7 18.2C130.0 17.6 130.9 17.6 131.6 18.0C132.3 18.4 132.6 19.3 132.2 20.5L131.2 23.2H129.8L130.5 20.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>

      {/* Floating Metadata Indicator (Top Left) */}
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
      {/* 3D ISOMETRIC RESEARCH MANUSCRIPTS / CITATION STACK (3 LAYERS)        */}
      {/* ==================================================================== */}
      {/* Layer 3 (Back Reference Paper) */}
      <g opacity="0.45">
        <path
          d="M44.5 39.4L70.4 26.2C71.3 25.8 72.2 25.5 73.0 25.5H74.8L79.8 28.5C81.4 29.3 82.3 31.1 82.3 33.5V65.1C82.3 69.3 79.5 74.1 76.0 75.9L50.1 89.1C49.2 89.6 48.3 89.8 47.5 89.8H45.7L40.7 86.8C39.1 86.0 38.2 84.2 38.2 81.8V50.3C38.2 46.1 41.0 41.2 44.5 39.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M79.6 29.0C78.5 28.5 77.2 28.5 75.7 29.3L49.8 42.5C46.5 44.2 43.8 48.8 43.8 52.8V84.4C43.8 86.6 44.6 88.2 45.9 88.9L40.9 86.3C39.6 85.6 38.8 84.1 38.8 81.8V50.3C38.8 46.2 41.5 41.6 44.8 39.9L70.7 26.7C72.2 26.0 73.5 25.9 74.5 26.5L79.6 29.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>

      {/* Layer 2 (Middle Journal Manuscript) */}
      <g opacity="0.8">
        <path
          d="M62.7 48.8L88.7 35.5C89.5 35.1 90.4 34.9 91.2 34.9H93.0L98.0 37.9C99.6 38.6 100.5 40.5 100.5 42.8V74.4C100.5 78.6 97.7 83.5 94.2 85.2L68.3 98.5C67.4 98.9 66.5 99.1 65.7 99.1H63.9L58.9 96.2C57.3 95.4 56.4 93.5 56.4 91.2V59.6C56.4 55.4 59.2 50.5 62.7 48.8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M97.8 38.3C96.8 37.8 95.4 37.9 93.9 38.6L68.0 51.8C64.7 53.5 62.0 58.1 62.0 62.2V93.7C62.0 96.0 62.9 97.5 64.2 98.2L59.1 95.6C57.8 95.0 57.0 93.4 57.0 91.2V59.6C57.0 55.6 59.7 50.9 63.0 49.3L88.9 36.0C90.4 35.3 91.7 35.3 92.8 35.8L97.8 38.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>

      {/* Layer 1 (Front Primary Paper with Academic Layout & Citation Lines) */}
      <g>
        {/* Main 3D Isometric Folio Body */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M83.8766 108.464C83.2671 108.464 82.6915 108.34 82.1723 108.092L77.0483 105.49C75.4908 104.695 74.5936 102.878 74.5936 100.496V68.9286C74.5936 64.7244 77.4151 59.86 80.8857 58.0937L106.822 44.8775C107.702 44.4317 108.565 44.2003 109.389 44.2003H111.178L116.24 47.2025C117.775 48.0038 118.655 49.8152 118.655 52.1797V83.7474C118.655 87.9572 115.834 92.816 112.363 94.5823L86.4273 107.799C85.5526 108.244 84.6948 108.47 83.8766 108.47V108.464Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        />
        {/* 3D Extrusion Side Wall (Depth) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M116.008 47.6821C114.97 47.1516 113.627 47.1967 112.165 47.9416L86.2295 61.1579C82.9283 62.8395 80.2422 67.4726 80.2422 71.4905V103.058C80.2422 105.299 81.0773 106.884 82.3865 107.55L77.3585 104.988C76.0493 104.322 75.2141 102.737 75.2141 100.496V68.9285C75.2141 64.9106 77.8947 60.2776 81.2015 58.5959L107.137 45.3797C108.599 44.6348 109.942 44.5896 110.98 45.1201L116.008 47.6821Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Outer Perimeter Outline */}
        <path
          d="M109.389 44.7646C109.948 44.7646 110.461 44.8888 110.918 45.1201L115.946 47.6821C117.25 48.3424 118.091 49.9281 118.091 52.1741V83.7418C118.091 87.7597 115.416 92.3871 112.104 94.0744L86.1677 107.291C85.3551 107.703 84.5763 107.9 83.8709 107.9C83.2614 107.9 82.7028 107.753 82.2175 107.482L77.2966 104.988C75.9874 104.322 75.1523 102.737 75.1523 100.496V68.9286C75.1523 64.9106 77.8327 60.2776 81.1396 58.596L107.075 45.3797C107.894 44.9621 108.672 44.7646 109.384 44.7646Z"
          fill="none"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.6"
        />

        {/* Paper Title Bar (Isometric Header) */}
        <path
          d="M87.5 68.5L103.5 60.5V63.5L87.5 71.5V68.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        {/* Paper Abstract / Text Line 1 */}
        <path
          d="M87.5 74.5L107.5 64.5V66.5L87.5 76.5V74.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          opacity="0.8"
        />
        {/* Paper Text Line 2 */}
        <path
          d="M87.5 79.5L105.5 70.5V72.5L87.5 81.5V79.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          opacity="0.8"
        />
        {/* Paper Text Line 3 (Citation Reference entry) */}
        <path
          d="M87.5 84.5L100.5 78.0V80.0L87.5 86.5V84.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          opacity="0.6"
        />

        {/* Bookmark Ribbon at the Top Edge */}
        <path
          d="M96.0 51.5L101.5 48.7V58.0L98.7 56.5L96.0 58.0V51.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>
    </svg>
  );
}

const illustrationStyles = `
  :root, .plane-library-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-library-illustration,
  [data-theme='dark'] .plane-library-illustration {
    --illustration-fill-primary: #18181b;
    --illustration-fill-secondary: #27272a;
    --illustration-fill-tertiary: #3f3f46;
    --illustration-fill-quaternary: #52525b;
    --illustration-stroke-primary: #3f3f46;
    --illustration-stroke-secondary: #71717a;
    --illustration-stroke-tertiary: #e4e4e7;
  }
`;

export interface LibraryEmptyStateProps {
  search?: string;
  activeFilter?: string | null;
  onClearSearch?: () => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
  onAddCollection?: () => void;
  canEdit?: boolean;
}

/**
 * LibraryEmptyState
 * Empty state for the Library feature matching Plane.so / Flux isometric 3D spatial design standards.
 * Presents 3D stacked spatial slabs with research papers, citation badges, and action triggers.
 */
export function LibraryEmptyState({
  search = '',
  activeFilter = null,
  onClearSearch,
  onDirectFilesUpload,
  onAddLink,
  canEdit = true,
}: LibraryEmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onDirectFilesUpload) {
      onDirectFilesUpload(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const isSearchActive = Boolean(search.trim());

  const getTitle = () => {
    if (isSearchActive) return 'No references found.';
    if (activeFilter === 'my-publications' || activeFilter === 'publications') {
      return 'No publications listed.';
    }
    if (activeFilter === 'retracted') {
      return 'No retracted items.';
    }
    if (activeFilter === 'saved-search') {
      return 'No matching results.';
    }
    if (activeFilter === 'starred' || activeFilter === 'favorites') {
      return 'No starred references.';
    }
    return 'Start with your first reference.';
  };

  const getDescription = () => {
    if (isSearchActive) {
      return `No references match "${search}". Try checking for spelling errors or clearing your search filter.`;
    }
    if (activeFilter === 'my-publications' || activeFilter === 'publications') {
      return 'Flag references with your authorship to organize and highlight your published papers.';
    }
    if (activeFilter === 'retracted') {
      return 'No retracted items detected in your library. All citations in your research corpus appear clear.';
    }
    if (activeFilter === 'saved-search') {
      return 'No references currently match the conditions of this saved search filter.';
    }
    if (activeFilter === 'starred' || activeFilter === 'favorites') {
      return 'You haven’t starred any references yet. Star important papers to easily access your core literature.';
    }
    return 'Papers and citations are the building blocks of your research — import papers, manage citations, and organize references easily.';
  };

  return (
    <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200">
      <style dangerouslySetInnerHTML={{ __html: illustrationStyles }} />

      {/* Hidden File Input for PDF / BibTeX upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.bib,.ris,.json,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 3D Isometric Multi-Layer Illustration */}
      <div className="plane-library-illustration mb-6 flex items-center justify-center">
        <LibraryVerticalStackIllustration />
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
      ) : canEdit && !activeFilter ? (
        <div className="flex items-center gap-2.5">
          {onDirectFilesUpload && (
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              className="h-8 px-4 rounded-md font-medium text-13 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
            >
              Add your first reference
            </Button>
          )}

          {onAddLink && (
            <Button
              type="button"
              variant="outline"
              onClick={onAddLink}
              size="sm"
              className="h-8 px-4 rounded-md font-medium text-13 border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
            >
              Import via DOI
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default LibraryEmptyState;
