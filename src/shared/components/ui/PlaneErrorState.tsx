'use client';

import React, { useState } from 'react';
import { cn } from '@/shared/lib/utils';

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
 * ErrorVerticalStackIllustration
 * 3D isometric multi-layered illustration adhering strictly to Plane.so / Flux standards.
 * Features 3 stacked isometric spatial base slabs, an upright 3D warning prism/monolith
 * with optical exclamation mark, and floating caution beacon badges.
 */
export function ErrorVerticalStackIllustration({ className }: TIllustrationAssetProps) {
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
      {/* FLOATING CAUTION / DISCONNECT ACCENTS                                */}
      {/* ==================================================================== */}
      {/* Floating Alert Beacon Badge (Top Right) */}
      <g>
        <path
          d="M141.5 35.2L118.5 21.8C117.2 21.0 115.8 21.0 114.8 21.6L116.8 20.3C117.8 19.7 119.2 19.7 120.5 20.5L143.5 33.9C146.8 35.8 149.2 40.5 149.2 44.5C149.2 46.8 148.4 48.4 147.1 49.0L145.1 50.3C146.4 49.7 147.2 48.1 147.2 45.8C147.2 41.8 144.8 37.1 141.5 35.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M141.5 35.2C144.8 37.1 147.2 41.8 147.2 45.8C147.2 48.1 146.4 49.7 145.1 50.3C143.8 51.0 142.4 51.0 141.1 50.2L118.1 36.8C114.8 34.9 112.4 30.2 112.4 26.2C112.4 23.9 113.2 22.3 114.5 21.7C115.8 21.0 117.2 21.0 118.5 21.8L141.5 35.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Subtle Alert Indicator in Badge */}
        <circle cx="129.8" cy="36.0" r="2.2" fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary} />
      </g>

      {/* Floating Sparkle / Cross Pulse (Top Left) */}
      <g opacity="0.6">
        <path
          d="M18.5 31.0L20.5 36.0L25.5 37.0L21.5 40.5L22.5 45.5L18.5 42.5L14.5 45.5L15.5 40.5L11.5 37.0L16.5 36.0L18.5 31.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>

      {/* ==================================================================== */}
      {/* 3D ISOMETRIC CAUTION PRISM / WARNING MONOLITH                        */}
      {/* ==================================================================== */}
      {/* 3D Shadow Cast on the Top Platform */}
      <ellipse
        cx="80.0"
        cy="106.0"
        rx="34.0"
        ry="13.0"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        opacity="0.35"
      />

      {/* 3D Prism Base Extrusion (Depth Layer) */}
      <g>
        {/* Left Side Extrusion */}
        <path
          d="M45.0 82.0L80.0 102.0V108.0L45.0 88.0V82.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Side Extrusion */}
        <path
          d="M80.0 102.0L115.0 82.0V88.0L80.0 108.0V102.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* 3D Prism Main Warning Facets */}
      <g>
        {/* Left Facet (Light Surface) */}
        <path
          d="M80.0 24.0L45.0 82.0L80.0 102.0V24.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Facet (Shaded Surface) */}
        <path
          d="M80.0 24.0L80.0 102.0L115.0 82.0L80.0 24.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Center Ridge Crease */}
        <path
          d="M80.0 24.0V102.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.6"
        />
      </g>

      {/* Subtle Inner Isometric Warning Accent Lines */}
      <g opacity="0.6">
        <path
          d="M55.0 77.0L75.0 89.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          d="M85.0 89.0L105.0 77.0"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Optical Caution Exclamation Mark (Engraved into the 3D Prism) */}
      <g>
        {/* Upper Exclamation Bar (Aligned with vertical ridge) */}
        <path
          d="M78.6 44.0C78.6 43.2 79.2 42.6 80.0 42.6C80.8 42.6 81.4 43.2 81.4 44.0L81.0 72.0C81.0 72.6 80.5 73.0 80.0 73.0C79.5 73.0 79.0 72.6 79.0 72.0L78.6 44.0Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
        />
        {/* Lower Exclamation Dot */}
        <circle
          cx="80.0"
          cy="83.0"
          r="2.2"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
        />
      </g>
    </svg>
  );
}

const illustrationStyles = `
  :root, .plane-error-illustration, [data-theme='light'] {
    --illustration-fill-primary: #ffffff;
    --illustration-fill-secondary: #f4f5f5;
    --illustration-fill-tertiary: #eaebeb;
    --illustration-fill-quaternary: #cfd2d3;
    --illustration-stroke-primary: #cfd2d3;
    --illustration-stroke-secondary: #8a9093;
    --illustration-stroke-tertiary: #1d1f20;
  }
  .dark .plane-error-illustration,
  [data-theme='dark'] .plane-error-illustration {
    --illustration-fill-primary: #18181b;
    --illustration-fill-secondary: #27272a;
    --illustration-fill-tertiary: #3f3f46;
    --illustration-fill-quaternary: #52525b;
    --illustration-stroke-primary: #3f3f46;
    --illustration-stroke-secondary: #71717a;
    --illustration-stroke-tertiary: #e4e4e7;
  }
`;

export interface PlaneErrorStateProps {
  title?: string;
  description?: string;
  error?: Error & { digest?: string };
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
  isFullPage?: boolean;
}

/**
 * PlaneErrorState
 * Flat Precision SaaS Error Screen matching Plane.so architecture:
 * - 3D Isometric spatial illustration
 * - Clean seamless default canvas (zero harsh red alert boxes)
 * - Restrained typography and discrete collapsible error logs
 * - Strictly NO buttons (clean default canvas)
 * - Restrained typography and discrete collapsible error logs
 */
export function PlaneErrorState({
  title = 'An unexpected error occurred',
  description = 'This view encountered an issue while loading data. Navigation and other workspaces remain safe.',
  error,
  className,
  isFullPage = false,
}: PlaneErrorStateProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background',
        isFullPage && 'min-h-screen',
        className
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: illustrationStyles }} />

      {/* 3D Isometric Multi-Layer Error Illustration */}
      <div className="plane-error-illustration mb-6 flex items-center justify-center">
        <ErrorVerticalStackIllustration />
      </div>

      {/* Title */}
      <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed mb-4 font-normal">
        {description}
      </p>

      {/* Optional Technical Error Diagnostics (Polished Interactive Disclosure) */}
      {error?.message && (
        <div className="flex flex-col items-center max-w-lg w-full mt-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsDetailsOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsDetailsOpen((prev) => !prev);
              }
            }}
            className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full border border-border/70 bg-muted/40 hover:bg-muted/80 hover:border-border text-11 text-muted-foreground hover:text-foreground font-mono transition-all duration-150 cursor-pointer select-none focus:outline-hidden focus:ring-1 focus:ring-primary/40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'size-3 shrink-0 text-muted-foreground transition-transform duration-200',
                isDetailsOpen && 'rotate-180'
              )}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            <span>Error details</span>
            {error.digest && (
              <span className="text-10 px-1.5 py-0.5 rounded bg-muted font-mono border border-border/70 text-muted-foreground">
                #{error.digest.slice(0, 8)}
              </span>
            )}
          </div>

          {isDetailsOpen && (
            <div className="mt-3 w-full overflow-hidden rounded-lg border border-border/80 bg-muted/40 backdrop-blur-xs text-left shadow-2xs animate-in fade-in-50 zoom-in-98 duration-150">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-muted/60 text-10 font-mono text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-destructive/80" />
                  <span>Runtime Exception</span>
                </div>
                {error.digest && <span className="opacity-75">ID: {error.digest}</span>}
              </div>
              <div className="p-3 text-11 font-mono text-muted-foreground overflow-x-auto max-h-36 leading-relaxed select-text font-normal whitespace-pre-wrap break-all">
                {error.message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlaneErrorState;
