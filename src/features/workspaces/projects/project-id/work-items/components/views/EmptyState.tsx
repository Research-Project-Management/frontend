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

export function WorkItemVerticalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
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
      <g opacity="0.4">
        <path
          d="M0.200012 78.9056C0.200012 81.0387 1.79701 83.1661 4.98538 84.7914L46.0392 105.711C52.4216 108.961 62.7655 108.961 69.1479 105.711L155.415 61.7562C158.603 60.1309 160.2 58.0035 160.2 55.8704V62.6817C160.2 64.8148 158.603 66.9422 155.415 68.5675L69.1479 112.522C62.7655 115.772 52.4216 115.772 46.0392 112.522L4.98538 91.6027C1.79137 89.9774 0.200012 87.8444 0.200012 85.7113V78.9056Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.200012 78.9056C0.200012 76.7725 1.79701 74.6451 4.98538 73.0198L91.252 29.0653C97.6344 25.8149 107.978 25.8149 114.361 29.0653L155.415 49.9845C158.609 51.6098 160.2 53.7428 160.2 55.8759C160.2 58.009 158.603 60.1365 155.415 61.7617L69.1479 105.716C62.7655 108.967 52.4216 108.967 46.0392 105.716L4.98538 84.7969C1.79137 83.1716 0.200012 81.0387 0.200012 78.9056Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.8">
        <path
          d="M0.200012 57.3827C0.200012 59.5158 1.79701 61.6432 4.98538 63.2685L46.0392 84.1877C52.4216 87.4381 62.7655 87.4381 69.1479 84.1877L155.415 40.2332C158.603 38.608 160.2 36.4805 160.2 34.3475V41.1587C160.2 43.2918 158.603 45.4193 155.415 47.0445L69.1479 90.999C62.7655 94.2495 52.4216 94.2495 46.0392 90.999L4.98538 70.0798C1.79137 68.4545 0.200012 66.3215 0.200012 64.1884V57.3827Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.200012 57.3827C0.200012 55.2496 1.79701 53.1221 4.98538 51.4969L91.252 7.54238C97.6344 4.29194 107.978 4.29194 114.361 7.54238L155.415 28.4615C158.609 30.0868 160.2 32.2198 160.2 34.353C160.2 36.4861 158.603 38.6135 155.415 40.2388L69.1479 84.1933C62.7655 87.4437 52.4216 87.4437 46.0392 84.1933L4.98538 63.274C1.79137 61.6487 0.200012 59.5158 0.200012 57.3827Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M0.200012 35.8598C0.200012 37.9929 1.79701 40.1203 4.98538 41.7456L46.0392 62.6647C52.4216 65.9152 62.7655 65.9152 69.1479 62.6647L155.415 18.7103C158.603 17.085 160.2 14.9576 160.2 12.8245V19.6358C160.2 21.7689 158.603 23.8963 155.415 25.5216L69.1479 69.4761C62.7655 72.7265 52.4216 72.7265 46.0392 69.4761L4.98538 48.5569C1.79137 46.9316 0.200012 44.7986 0.200012 42.6655V35.8598Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.200012 35.8598C0.200012 33.7267 1.79701 31.5992 4.98538 29.974L91.252 -13.9805C97.6344 -17.231 107.978 -17.231 114.361 -13.9805L155.415 6.93863C158.609 8.56388 160.2 10.6969 160.2 12.83C160.2 14.9631 158.603 17.0906 155.415 18.7158L69.1479 62.6704C62.7655 65.9208 52.4216 65.9208 46.0392 62.6704L4.98538 41.7511C1.79137 40.1258 0.200012 37.9929 0.200012 35.8598Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface EmptyStateProps {
  onCreateItem?: () => void;
  isReadOnly?: boolean;
}
export type WorkItemsEmptyStateProps = EmptyStateProps;

export function EmptyState({
  onCreateItem,
  isReadOnly = false,
}: EmptyStateProps) {
  const handleCreate = onCreateItem;
  return (
    <div className="flex-1 w-full h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in zoom-in-95 duration-200">
      <div
        className="mb-6 flex items-center justify-center text-foreground"
        style={
          {
            '--illustration-fill-primary': 'hsl(var(--card))',
            '--illustration-fill-secondary': 'hsl(var(--muted))',
            '--illustration-fill-tertiary': 'hsl(var(--secondary))',
            '--illustration-fill-quaternary': 'hsl(var(--border))',
            '--illustration-stroke-primary': 'hsl(var(--border))',
            '--illustration-stroke-secondary': 'hsl(var(--muted-foreground))',
            '--illustration-stroke-tertiary': 'hsl(var(--foreground))',
          } as React.CSSProperties
        }
      >
        <WorkItemVerticalStackIllustration />
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 tracking-tight">
        Start with your first work item.
      </h3>

      <p className="text-sm text-muted-foreground max-w-[420px] leading-relaxed mb-6 font-normal">
        Work items are the building blocks of your project — assign owners, set priorities, and track progress easily.
      </p>

      {!isReadOnly && handleCreate && (
        <Button
          onClick={handleCreate}
          size="sm"
          className="h-8 px-4 rounded-md font-medium text-13 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none"
        >
          Create your first work item
        </Button>
      )}
    </div>
  );
}

export const WorkItemsEmptyState = EmptyState;
export default EmptyState;
