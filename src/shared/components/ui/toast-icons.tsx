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

interface ToastBadgeProps extends ToastIconProps {
  bgClass: string;
  children: React.ReactNode;
}

function ToastBadge({ bgClass, className, size = 16, children, ...props }: ToastBadgeProps) {
  return (
    <div
      className={`size-4 rounded-full ${bgClass} flex items-center justify-center shrink-0 select-none ${className || ''}`}
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
        {children}
      </svg>
    </div>
  );
}

/**
 * Plane.so Success Icon (Circular green badge with crisp white checkmark)
 */
export function ToastSuccessIcon(props: ToastIconProps) {
  return (
    <ToastBadge bgClass="bg-success" {...props}>
      <path d="M2.5 6.2L4.8 8.5L9.5 3.5" strokeLinejoin="round" />
    </ToastBadge>
  );
}

/**
 * Plane.so Error / Danger Icon (Circular red badge with crisp white cross)
 */
export function ToastErrorIcon(props: ToastIconProps) {
  return (
    <ToastBadge bgClass="bg-destructive" {...props}>
      <path d="M3 3L9 9M9 3L3 9" strokeLinejoin="round" />
    </ToastBadge>
  );
}

/**
 * Plane.so Warning Icon (Circular amber badge with crisp white exclamation)
 */
export function ToastWarningIcon(props: ToastIconProps) {
  return (
    <ToastBadge bgClass="bg-warning" {...props}>
      <path d="M6 2.8V6.8" />
      <circle cx="6" cy="9.2" r="0.8" fill="currentColor" stroke="none" />
    </ToastBadge>
  );
}

/**
 * Plane.so Info Icon (Circular blue badge with crisp white info glyph)
 */
export function ToastInfoIcon(props: ToastIconProps) {
  return (
    <ToastBadge bgClass="bg-primary" {...props}>
      <circle cx="6" cy="2.8" r="0.8" fill="currentColor" stroke="none" />
      <path d="M6 5.2V9.2" />
    </ToastBadge>
  );
}

/**
 * Plane.so Circular Loading Spinner (Neutral circular bar spinner)
 */
export function ToastLoadingIcon({ className, size = 16, ...props }: ToastSvgProps) {
  return (
    <svg
      className={`size-4 animate-spin text-muted-foreground shrink-0 ${className || ''}`}
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
      className={`size-3.5 stroke-[1.8] text-muted-foreground shrink-0 ${className || ''}`}
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
