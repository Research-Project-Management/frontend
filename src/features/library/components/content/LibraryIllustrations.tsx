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

export const libraryIllustrationStyles = `
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

export interface TIllustrationAssetProps {
  className?: string;
}

/**
 * Shared 3D Isometric Base Slabs (3 Depth Levels)
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
 * 1. StarredStackIllustration
 * 3D isometric faceted Star on platform with floating star gems
 */
export function StarredStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Accent Gem (Top Right) */}
      <g>
        <path
          d="M136.0 28.0L145.0 33.0L136.0 38.0L127.0 33.0L136.0 28.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <circle cx="136.0" cy="33.0" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
      </g>
      {/* Sparkle (Top Left) */}
      <path
        d="M22.0 36.0L24.0 41.0L29.0 42.0L25.0 45.5L26.0 50.5L22.0 47.5L18.0 50.5L19.0 45.5L15.0 42.0L20.0 41.0L22.0 36.0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.6"
      />
      {/* 3D Star Shadow */}
      <ellipse cx="80.0" cy="106.0" rx="30.0" ry="11.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} opacity="0.3" />
      {/* 3D Isometric Star Body */}
      <g>
        {/* Star Upper Spike Left */}
        <path
          d="M80.0 22.0L68.0 58.0L80.0 68.0V22.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Upper Spike Right */}
        <path
          d="M80.0 22.0L80.0 68.0L92.0 58.0L80.0 22.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Right Spike */}
        <path
          d="M92.0 58.0L126.0 64.0L98.0 82.0L80.0 68.0L92.0 58.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Left Spike */}
        <path
          d="M68.0 58.0L80.0 68.0L62.0 82.0L34.0 64.0L68.0 58.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Bottom Right Spike */}
        <path
          d="M80.0 68.0L98.0 82.0L110.0 106.0L80.0 92.0V68.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Bottom Left Spike */}
        <path
          d="M80.0 68.0V92.0L50.0 106.0L62.0 82.0L80.0 68.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Star Extrusion Under-facet */}
        <path
          d="M50.0 106.0L80.0 92.0L110.0 106.0L80.0 112.0L50.0 106.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
      </g>
    </svg>
  );
}

/**
 * 2. TrashStackIllustration
 * 3D isometric Trash / Recycling bin on platform with subtle paper fragments
 */
export function TrashStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Deleted Paper Fragment (Top Right) */}
      <g opacity="0.6">
        <path
          d="M130.0 30.0L144.0 38.0L138.0 46.0L124.0 38.0L130.0 30.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path d="M128.0 36.0L138.0 42.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.6" strokeLinecap="round" />
      </g>
      {/* 3D Trash Bin Body */}
      <g>
        {/* Bin Body Outer Left Wall */}
        <path
          d="M56.0 52.0L80.0 64.0V104.0L56.0 92.0V52.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Bin Body Outer Right Wall */}
        <path
          d="M80.0 64.0L104.0 52.0V92.0L80.0 104.0V64.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Bin Fluted Vertical Ribs Left */}
        <path d="M64.0 57.0V95.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M72.0 61.0V99.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.7" strokeLinecap="round" />
        {/* Bin Fluted Vertical Ribs Right */}
        <path d="M88.0 61.0V99.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M96.0 57.0V95.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.7" strokeLinecap="round" />
        {/* Bin Rim Upper Lip */}
        <path
          d="M54.0 50.0L80.0 63.0L106.0 50.0L80.0 37.0L54.0 50.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
        />
        {/* Bin Inner Opening (Cavity Depth) */}
        <path
          d="M58.0 50.0L80.0 61.0L102.0 50.0L80.0 39.0L58.0 50.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
        />
        {/* Ajar Trash Lid Floating Angled Above */}
        <g>
          <path
            d="M50.0 36.0L80.0 50.0L110.0 35.0L80.0 21.0L50.0 36.0Z"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
            strokeWidth="0.5"
          />
          {/* Lid Handle */}
          <path
            d="M74.0 28.0L80.0 31.0L86.0 28.0"
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

/**
 * 3. RetractedStackIllustration
 * 3D isometric Safety Shield on platform verifying 0 retractions
 */
export function RetractedStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Clean Badge (Top Right) */}
      <g>
        <path
          d="M136.0 28.0L146.0 33.0L136.0 38.0L126.0 33.0L136.0 28.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
        />
        <path d="M133.0 33.0L135.0 35.0L139.0 31.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* 3D Shield Body */}
      <g>
        {/* Left Shield Facet */}
        <path
          d="M80.0 24.0L52.0 40.0V72.0C52.0 90.0 80.0 106.0 80.0 106.0V24.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Right Shield Facet */}
        <path
          d="M80.0 24.0V106.0C80.0 106.0 108.0 90.0 108.0 72.0V40.0L80.0 24.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Center Ridge */}
        <path d="M80.0 24.0V106.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.6" />
        {/* Crisp Verified Checkmark Engraved on Shield */}
        <path
          d="M66.0 60.0L76.0 70.0L94.0 52.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="2.0"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * 4. UnfiledStackIllustration
 * 3D isometric Document Tray / Inbox Zero on platform
 */
export function UnfiledStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Check Gem */}
      <g opacity="0.6">
        <path d="M132.0 28.0L142.0 33.0L132.0 38.0L122.0 33.0L132.0 28.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
      </g>
      {/* 3D Tray Foundation */}
      <g>
        {/* Back Wall */}
        <path d="M42.0 58.0L80.0 40.0L118.0 58.0V74.0L80.0 56.0L42.0 74.0V58.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        {/* Front Left Wall with Cutout Notch */}
        <path d="M42.0 74.0L80.0 94.0V102.0L42.0 82.0V74.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        {/* Front Right Wall */}
        <path d="M80.0 94.0L118.0 74.0V82.0L80.0 102.0V94.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        {/* Clean Paper Stack Inside Tray */}
        <path d="M48.0 70.0L80.0 54.0L112.0 70.0L80.0 86.0L48.0 70.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M58.0 71.0L80.0 60.0L102.0 71.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * 5. PublicationsStackIllustration
 * 3D isometric Academic Scroll / Thesis Diploma on platform
 */
export function PublicationsStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Author Seal Badge (Top Right) */}
      <g>
        <circle cx="134.0" cy="34.0" r="10.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <circle cx="134.0" cy="34.0" r="7.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.4" strokeDasharray="1 1" />
        <path d="M134.0 44.0L131.0 52.0L134.0 50.0L137.0 52.0L134.0 44.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} />
      </g>
      {/* 3D Published Manuscript Stack */}
      <g>
        {/* Paper Sheet 1 (Bottom) */}
        <path d="M38.0 82.0L80.0 60.0L122.0 82.0L80.0 104.0L38.0 82.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        {/* Paper Sheet 2 (Middle) */}
        <path d="M38.0 76.0L80.0 54.0L122.0 76.0L80.0 98.0L38.0 76.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        {/* Paper Sheet 3 (Top Master Manuscript) */}
        <path d="M38.0 70.0L80.0 48.0L122.0 70.0L80.0 92.0L38.0 70.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        {/* Title Line */}
        <path d="M50.0 66.0L78.0 52.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="1.4" strokeLinecap="round" />
        {/* Abstract Lines */}
        <path d="M50.0 72.0L102.0 61.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M50.0 77.0L96.0 66.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M50.0 82.0L86.0 73.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        {/* Gold Citation Ribbon */}
        <path d="M106.0 58.0L114.0 62.0L108.0 80.0L102.0 76.0L106.0 58.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.4" />
      </g>
    </svg>
  );
}

/**
 * 6. CollectionStackIllustration
 * 3D isometric Research Folder on platform
 */
export function CollectionStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Tag Badge */}
      <g>
        <path d="M136.0 28.0L148.0 34.0L138.0 40.0L126.0 34.0L136.0 28.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <circle cx="132.0" cy="33.0" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
      </g>
      {/* 3D Isometric Folder Body */}
      <g>
        {/* Back Flap with Tab */}
        <path d="M42.0 85.0L98.0 57.0V25.0L72.0 38.0L66.0 34.0L42.0 46.0V85.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" strokeLinejoin="round" />
        {/* Document Sheets Peeking Out */}
        <path d="M48.0 78.0L92.0 56.0V36.0L48.0 58.0V78.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M54.0 56.0L76.0 45.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M54.0 61.0L84.0 46.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        {/* Front Flap */}
        <path d="M42.0 85.0L80.0 104.0L120.0 84.0L82.0 65.0L42.0 85.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
      </g>
    </svg>
  );
}

/**
 * 7. AllReferencesStackIllustration
 * 3D isometric Library Bookshelf / Master Reference Stack
 */
export function AllReferencesStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Reference Badge */}
      <g>
        <path d="M136.0 28.0L148.0 34.0L138.0 40.0L126.0 34.0L136.0 28.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M132.0 34.0L140.0 34.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
      {/* 3D Stack of 3 Academic Books */}
      <g>
        {/* Book 1 (Bottom Large Tome) */}
        <path d="M38.0 88.0L80.0 108.0L124.0 88.0L82.0 68.0L38.0 88.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M38.0 88.0V94.0L80.0 114.0V108.0L38.0 88.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M80.0 108.0V114.0L124.0 94.0V88.0L80.0 108.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />

        {/* Book 2 (Middle Journal) */}
        <path d="M44.0 76.0L80.0 94.0L118.0 76.0L82.0 58.0L44.0 76.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M44.0 76.0V82.0L80.0 100.0V94.0L44.0 76.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <path d="M80.0 94.0V100.0L118.0 82.0V76.0L80.0 94.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />

        {/* Book 3 (Top Open Research Guide) */}
        <path d="M48.0 64.0L80.0 80.0L114.0 64.0L82.0 48.0L48.0 64.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        {/* Bookmark Ribbon */}
        <path d="M78.0 46.0L86.0 50.0L82.0 70.0L76.0 67.0L78.0 46.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="0.4" />
      </g>
    </svg>
  );
}

/**
 * 8. SearchStackIllustration
 * 3D isometric Magnifying Glass hovering over search data sheets
 */
export function SearchStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* 3D Search Document Surface */}
      <g>
        <path d="M42.0 80.0L80.0 60.0L118.0 80.0L80.0 100.0L42.0 80.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <path d="M52.0 76.0L74.0 65.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M52.0 81.0L92.0 61.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        <path d="M52.0 86.0L84.0 70.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
      </g>
      {/* 3D Isometric Magnifying Glass */}
      <g>
        {/* Glass Ring Outer */}
        <ellipse cx="80.0" cy="54.0" rx="22.0" ry="12.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="1.2" />
        {/* Glass Ring Inner Lens */}
        <ellipse cx="80.0" cy="54.0" rx="17.0" ry="9.0" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        {/* Handle */}
        <path d="M98.0 61.0L118.0 73.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * 9. DuplicatesStackIllustration
 * 3D isometric Twin Stack clean & deduplicated
 */
export function DuplicatesStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg width="162" height="180" viewBox="0 0 162 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <BaseSlabs />
      {/* Floating Sparkle Gem (Deduplicated clean badge) */}
      <g>
        <path d="M136.0 28.0L148.0 34.0L138.0 40.0L126.0 34.0L136.0 28.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.4" />
        <circle cx="136.0" cy="34.0" r="1.5" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} />
      </g>
      {/* 3D Unified Master Card */}
      <g>
        {/* Merged Card Left */}
        <path d="M46.0 76.0L80.0 58.0L114.0 76.0L80.0 94.0L46.0 76.0Z" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary} strokeWidth="0.5" />
        <path d="M58.0 72.0L80.0 61.0L102.0 72.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary} strokeWidth="1.0" strokeLinecap="round" />
        <path d="M58.0 77.0L92.0 66.0" stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary} strokeWidth="0.8" strokeLinecap="round" />
        {/* Sparkle Clean Indicator */}
        <path
          d="M80.0 36.0L82.0 42.0L88.0 44.0L82.0 46.0L80.0 52.0L78.0 46.0L72.0 44.0L78.0 42.0L80.0 36.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
          strokeWidth="0.5"
        />
      </g>
    </svg>
  );
}
