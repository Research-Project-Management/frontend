'use client';

import React from 'react';

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

export const editorIllustrationStyles = `
  :root, .plane-editor-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-editor-illustration,
  [data-theme='dark'] .plane-editor-illustration {
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
 * Shared 3D Isometric Base Slabs (3 Depth Levels) - Identical to Library & Storage
 */
function BaseSlabs() {
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
 * EditorEmptyDocumentIllustration
 * 3D isometric open manuscript document sheet on top of spatial slabs.
 * Used for "No file open" in Editor workspace.
 */
export function EditorEmptyDocumentIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="104.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* Floating 3D Manuscript Document Sheets */}
      {/* Lower Back Sheet */}
      <g opacity="0.5">
        <path
          d="M52.0 42.0L112.0 20.0L128.0 74.0L68.0 96.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </g>

      {/* Main Front Document Sheet */}
      <g>
        {/* Sheet Thickness Edge */}
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
        {/* Paper Surface */}
        <path
          d="M44.0 48.0L104.0 26.0L120.0 80.0L60.0 102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />

        {/* Folded Top-Right Corner */}
        <path
          d="M96.0 29.0L104.0 26.0L100.0 38.0L96.0 29.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />

        {/* Code / Text Lines on Manuscript */}
        {/* Title Heading Line */}
        <path
          d="M54.0 52.0L78.0 43.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Content Lines */}
        <path
          d="M54.0 59.0L102.0 41.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M54.0 65.0L96.0 49.5"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M54.0 71.0L90.0 58.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M54.0 77.0L106.0 58.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M54.0 83.0L82.0 73.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Floating Isometric Code Badge / Curly Braces Pill (Top Left) */}
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
        <path
          d="M26.0 38.0L29.0 35.0L26.0 32.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M33.0 39.0L39.0 37.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Floating Sparkle Pulse (Top Right) */}
      <circle cx="138" cy="42" r="2.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
      <circle cx="146" cy="36" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
    </svg>
  );
}

/**
 * ViewerEmptyPdfIllustration
 * 3D isometric compiled PDF document preview canvas with optical page grid.
 * Used for "No PDF preview" in PDF Viewer.
 */
export function ViewerEmptyPdfIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="105.0"
        rx="38.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* 3D Isometric Dual-Column Preview Sheets */}
      <g>
        {/* Left Page Surface */}
        <path
          d="M40.0 46.0L80.0 66.0L80.0 98.0L40.0 78.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Right Page Surface */}
        <path
          d="M80.0 66.0L120.0 46.0L120.0 78.0L80.0 98.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Center Book Spine Crease */}
        <path
          d="M80.0 66.0V98.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.8"
        />

        {/* Content Layout Skeleton on Left Page */}
        <path d="M46.0 54.0L74.0 68.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M46.0 59.0L74.0 73.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M46.0 64.0L66.0 74.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />

        {/* Content Layout Skeleton on Right Page */}
        <path d="M86.0 68.0L114.0 54.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M86.0 73.0L114.0 59.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M86.0 78.0L106.0 68.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>

      {/* Floating Compile Beacon Badge (Upper Center) */}
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
        {/* Play/Compile Triangle Symbol in Badge */}
        <path
          d="M77.5 25.0L84.0 28.0L77.5 31.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
        />
      </g>
    </svg>
  );
}

/**
 * ViewerDetachedIllustration
 * 3D isometric popout window hovering over base platform.
 * Used for "PDF viewer detached" placeholder.
 */
export function ViewerDetachedIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* 3D Floating Window Monolith */}
      <g>
        {/* Window Thickness Back/Side */}
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

        {/* Window Canvas Surface */}
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

        {/* Window Top Titlebar */}
        <path
          d="M42 42C42 39.7909 43.7909 38 46 38H114C116.209 38 118 39.7909 118 42V48H42V42Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        {/* Window Window Controls (3 dots) */}
        <circle cx="48" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="53" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />
        <circle cx="58" cy="43" r="1.3" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} />

        {/* Window External Popout Arrow Icon */}
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
 * EditorReviewIllustration
 * 3D isometric comment & review conversation stack.
 * Used for "No comments or suggestions" in ReviewTab.
 */
export function EditorReviewIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="105.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* Floating 3D Isometric Speech Bubbles */}
      {/* Back Speech Bubble */}
      <g opacity="0.6">
        <path
          d="M84.0 38.0L120.0 20.0L134.0 46.0L106.0 60.0L98.0 68.0L100.0 58.0L90.0 56.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </g>

      {/* Front Speech Bubble */}
      <g>
        <path
          d="M40.0 48.0L90.0 24.0L112.0 58.0L86.0 72.0L78.0 84.0L80.0 70.0L50.0 68.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* Comment Text Lines */}
        <path
          d="M52.0 48.0L86.0 32.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M54.0 54.0L88.0 38.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M56.0 60.0L78.0 50.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Floating Checkmark / Approval Bubble (Top Right) */}
      <g>
        <circle cx="124" cy="38" r="8" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <path
          d="M121 38L123 40L127 36"
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
 * EditorHistoryIllustration
 * 3D isometric timeline clock and revision checkpoints.
 * Used for "No revisions found" / "No labeled versions" in HistoryView.
 */
export function EditorHistoryIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="105.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* 3D Isometric Version Checkpoint Stack */}
      <g>
        {/* Disc 1 (Bottom Version) */}
        <ellipse cx="80" cy="80" rx="30" ry="12" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        {/* Disc 2 (Middle Version) */}
        <ellipse cx="80" cy="66" rx="26" ry="10" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        {/* Disc 3 (Top Clock / Snapshot) */}
        <ellipse cx="80" cy="52" rx="22" ry="9" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.6" />

        {/* Clock Hands on Top Disc */}
        <path
          d="M80 52L80 47"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M80 52L88 54"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="1.0"
          strokeLinecap="round"
        />
        <circle cx="80" cy="52" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
      </g>

      {/* Floating Tag Beacon (Top Right) */}
      <g>
        <path
          d="M120 28L130 38L122 46L112 36Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        <circle cx="118" cy="34" r="1.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
      </g>
    </svg>
  );
}

/**
 * EditorSearchIllustration
 * 3D isometric magnifying glass over code document sheet.
 * Used for "No search results" in SearchTab.
 */
export function EditorSearchIllustration({ className }: TIllustrationAssetProps) {
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

      {/* Shadow cast on top platform */}
      <ellipse
        cx="80.0"
        cy="105.0"
        rx="36.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* Document Sheet */}
      <g>
        <path
          d="M46.0 46.0L96.0 24.0L112.0 76.0L62.0 98.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        <path d="M54.0 52.0L86.0 38.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 58.0L94.0 41.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 64.0L80.0 53.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.8" strokeLinecap="round" />
      </g>

      {/* 3D Isometric Magnifying Lens */}
      <g>
        {/* Lens Rim */}
        <circle
          cx="82"
          cy="58"
          r="16"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.2"
        />
        {/* Glass reflection */}
        <path
          d="M74 52C76 48 84 46 88 48"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        {/* Handle */}
        <path
          d="M94 70L110 86"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
