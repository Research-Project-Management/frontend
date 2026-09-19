import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface LibraryIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * LibraryIcon
 * Spatial Multi-Volume Research Library (Hàng sách nghiên cứu không gian Zotero).
 * Conforms 100% to the visual DNA of WorkItemsIcon & StickiesIcon:
 * - 16x16 canvas with crisp ~1.25px stroke geometry.
 * - 2 layered scholarly monographs in space: 1 standing upright + 1 leaning in 3D perspective.
 * - Distinct vertical silhouette contrasting 100% with Storage.
 * - Zero pareidolia (no face/worm illusion).
 */
export function LibraryIcon({
  className,
  size = 16,
  ...props
}: LibraryIconProps) {
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
      {/* Book 1 (Left Standing Monograph Volume) */}
      <path
        d="M2.0 3.0C2.0 2.3 2.5 1.8 3.2 1.8H5.2C5.9 1.8 6.4 2.3 6.4 3.0V13.8C6.4 14.1 6.2 14.4 5.9 14.4H2.5C2.2 14.4 2.0 14.1 2.0 13.8V3.0ZM3.2 3.0V13.2H5.2V3.0H3.2Z"
        fill="currentColor"
      />
      {/* Book 2 (Right Leaning Monograph Volume in 3D Perspective) */}
      <path
        d="M7.4 3.5C7.2 2.8 7.6 2.1 8.3 1.9L10.2 1.3C10.9 1.1 11.6 1.5 11.8 2.2L14.2 13.0C14.3 13.3 14.1 13.6 13.8 13.7L10.5 14.5C10.2 14.6 9.9 14.4 9.8 14.1L7.4 3.5ZM9.3 2.6L7.7 13.2L10.2 12.6L11.8 2.0L9.3 2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const LibrarySpaceIcon = LibraryIcon;
export const CosmicLibraryIcon = LibraryIcon;
export default LibraryIcon;
