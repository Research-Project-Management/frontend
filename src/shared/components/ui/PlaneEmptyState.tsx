'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  EMPTY_STATE_REGISTRY,
  ILLUSTRATION_TOKENS,
  type EmptyStateVariant,
  type IllustrationProps,
} from '@/shared/components/illustrations';

export const ILLUSTRATION_COLOR_TOKEN_MAP = ILLUSTRATION_TOKENS;

export type TIllustrationAssetProps = IllustrationProps;

/**
 * Shared 3D Isometric Base Slabs (3 Depth Levels)
 * Used by feature-specific 3D isometric illustrations (Your Work, Work Items).
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

export type PlaneEmptyVariant = EmptyStateVariant | 'default';

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

/**
 * PlaneEmptyState
 * Canonical Flat Precision empty state primitive powered by the global
 * multi-style illustration registry (`@/shared/components/illustrations`).
 * Colors inherit `--illustration-*` tokens from `globals.css`.
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
  const resolvedVariant: EmptyStateVariant =
    variant === 'default' || !(variant in EMPTY_STATE_REGISTRY) ? 'document' : variant;
  const preset = EMPTY_STATE_REGISTRY[resolvedVariant];

  const title = customTitle ?? preset.title;
  const description =
    customDescription ??
    (resolvedVariant === 'preview' ? (
      <span>
        Click <strong className="font-semibold text-foreground">Recompile</strong> on the toolbar or press{' '}
        <kbd className="px-1.5 py-0.5 text-11 font-mono font-medium rounded-md border bg-muted border-border text-foreground">
          Ctrl+Enter
        </kbd>{' '}
        to build your document.
      </span>
    ) : (
      preset.description
    ));

  const renderIllustration = () => {
    if (customIllustration) {
      if (React.isValidElement(customIllustration)) {
        return customIllustration;
      }
      const CustomComp = customIllustration as React.ComponentType<{ className?: string }>;
      return <CustomComp className={cn('w-36 h-36 mx-auto', isCompact && 'w-24 h-24')} />;
    }
    const IllustrationComp = preset.illustration;
    return <IllustrationComp className={cn('w-36 h-36 mx-auto', isCompact && 'w-24 h-24')} />;
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
          {IconComp &&
            (React.isValidElement(IconComp)
              ? IconComp
              : React.createElement(IconComp as React.ComponentType<{ className?: string }>, {
                  className: 'size-3.5 shrink-0',
                }))}
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
      <div className="flex items-center justify-center shrink-0">
        {renderIllustration()}
      </div>

      <div className={cn('max-w-xs space-y-1', isCompact ? 'px-2' : 'px-4')}>
        <h3 className="text-[0.9375rem] font-semibold text-foreground tracking-tight leading-snug">
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
