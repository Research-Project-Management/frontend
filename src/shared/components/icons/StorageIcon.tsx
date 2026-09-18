'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface StorageIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * StorageIcon
 * Spatial Multi-Tier Hardware Storage Bays (Khay ổ đĩa lưu trữ đa tầng không gian).
 * Conforms 100% to the visual DNA of WorkItemsIcon & StickiesIcon:
 * - 16x16 canvas with crisp ~1.25px stroke geometry.
 * - Dual-tier horizontal storage drive bays with front slots and LED indicators.
 * - Distinct horizontal silhouette contrasting 100% with Library's vertical folios.
 */
export function StorageIcon({
  className,
  size = 16,
  ...props
}: StorageIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-3.5 shrink-0 text-current', className)}
      {...props}
    >
      {/* Top Bay Tier */}
      <path
        d="M2.0 3.0C2.0 2.2 2.7 1.5 3.5 1.5H12.5C13.3 1.5 14.0 2.2 14.0 3.0V5.8C14.0 6.6 13.3 7.3 12.5 7.3H3.5C2.7 7.3 2.0 6.6 2.0 5.8V3.0ZM3.3 3.1V5.7C3.3 5.9 3.5 6.1 3.7 6.1H12.3C12.5 6.1 12.7 5.9 12.7 5.7V3.1C12.7 2.9 12.5 2.7 12.3 2.7H3.7C3.5 2.7 3.3 2.9 3.3 3.1Z"
        fill="currentColor"
      />
      {/* Top Bay Slot and LED */}
      <path
        d="M4.6 3.8H9.2V5.0H4.6V3.8ZM11.4 3.8C11.75 3.8 12.0 4.05 12.0 4.4C12.0 4.75 11.75 5.0 11.4 5.0C11.05 5.0 10.8 4.75 10.8 4.4C10.8 4.05 11.05 3.8 11.4 3.8Z"
        fill="currentColor"
      />
      {/* Bottom Bay Tier */}
      <path
        d="M2.0 10.2C2.0 9.4 2.7 8.7 3.5 8.7H12.5C13.3 8.7 14.0 9.4 14.0 10.2V13.0C14.0 13.8 13.3 14.5 12.5 14.5H3.5C2.7 14.5 2.0 13.8 2.0 13.0V10.2ZM3.3 10.3V12.9C3.3 13.1 3.5 13.3 3.7 13.3H12.3C12.5 13.3 12.7 13.1 12.7 12.9V10.3C12.7 10.1 12.5 9.9 12.3 9.9H3.7C3.5 9.9 3.3 10.1 3.3 10.3Z"
        fill="currentColor"
      />
      {/* Bottom Bay Slot and LED */}
      <path
        d="M4.6 11.0H9.2V12.2H4.6V11.0ZM11.4 11.0C11.75 11.0 12.0 11.25 12.0 11.6C12.0 11.95 11.75 12.2 11.4 12.2C11.05 12.2 10.8 11.95 10.8 11.6C10.8 11.25 11.05 11.0 11.4 11.0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const CloudStorageIcon = StorageIcon;
export default StorageIcon;
