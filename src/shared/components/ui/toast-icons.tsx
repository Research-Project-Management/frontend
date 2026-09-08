'use client';

/**
 * Toast Icon System - Synchronized with Plane.so (@plane/propel) Design System
 * Features:
 * - Uniform 16x16px (size-4) circular badges with high-contrast white vector glyphs
 * - Mathematically centered SVG coordinate system (12x12 grid)
 * - SaaS semantic colors: emerald-600 (success), red-600 (error), amber-500 (warning), blue-600 (info)
 * - Reusable across all toast types, alerts, modals, and status badges
 */

import * as React from 'react';

export interface ToastIconProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  size?: number;
}

export interface ToastSvgProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

/**
 * Plane.so Success Icon (Circular green badge with crisp white checkmark)
 */
export function ToastSuccessIcon({ className, size = 16, ...props }: ToastIconProps) {
  return (
    <div
      className={`size-4 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shrink-0 select-none ${className || ''}`}
      style={size !== 16 ? { width: size, height: size } : undefined}
      aria-hidden="true"
      {...props}
    >
      <svg
        className="size-2.5 text-white"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 6.2L4.8 8.5L9.5 3.5" />
      </svg>
    </div>
  );
}

/**
 * Plane.so Error / Danger Icon (Circular red badge with crisp white cross)
 */
export function ToastErrorIcon({ className, size = 16, ...props }: ToastIconProps) {
  return (
    <div
      className={`size-4 rounded-full bg-red-600 dark:bg-red-500 flex items-center justify-center shrink-0 select-none ${className || ''}`}
      style={size !== 16 ? { width: size, height: size } : undefined}
      aria-hidden="true"
      {...props}
    >
      <svg
        className="size-2.5 text-white"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3L9 9M9 3L3 9" />
      </svg>
    </div>
  );
}

/**
 * Plane.so Warning Icon (Circular amber badge with crisp white exclamation)
 */
export function ToastWarningIcon({ className, size = 16, ...props }: ToastIconProps) {
  return (
    <div
      className={`size-4 rounded-full bg-amber-500 dark:bg-amber-400 flex items-center justify-center shrink-0 select-none ${className || ''}`}
      style={size !== 16 ? { width: size, height: size } : undefined}
      aria-hidden="true"
      {...props}
    >
      <svg
        className="size-2.5 text-white"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M6 2.8V6.8" />
        <circle cx="6" cy="9.2" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

/**
 * Plane.so Info Icon (Circular blue badge with crisp white info glyph)
 */
export function ToastInfoIcon({ className, size = 16, ...props }: ToastIconProps) {
  return (
    <div
      className={`size-4 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center shrink-0 select-none ${className || ''}`}
      style={size !== 16 ? { width: size, height: size } : undefined}
      aria-hidden="true"
      {...props}
    >
      <svg
        className="size-2.5 text-white"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="6" cy="2.8" r="0.8" fill="currentColor" stroke="none" />
        <path d="M6 5.2V9.2" />
      </svg>
    </div>
  );
}

/**
 * Plane.so Circular Loading Spinner (Neutral zinc circular bar spinner)
 */
export function ToastLoadingIcon({ className, size = 16, ...props }: ToastSvgProps) {
  return (
    <svg
      className={`size-4 animate-spin text-zinc-500 dark:text-zinc-400 shrink-0 ${className || ''}`}
      style={size !== 16 ? { width: size, height: size } : undefined}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Plane.so Close Icon (Subtle neutral X icon with precise hover transition)
 */
export function ToastCloseIcon({ className, size = 14, ...props }: ToastSvgProps) {
  return (
    <svg
      className={`size-3.5 stroke-[1.8] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ${className || ''}`}
      style={size !== 14 ? { width: size, height: size } : undefined}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" />
    </svg>
  );
}

/**
 * Reusable Registry of Toast Icons matching Plane.so specs
 */
export const TOAST_ICONS = {
  success: <ToastSuccessIcon />,
  error: <ToastErrorIcon />,
  warning: <ToastWarningIcon />,
  info: <ToastInfoIcon />,
  loading: <ToastLoadingIcon />,
  close: <ToastCloseIcon />,
} as const;
