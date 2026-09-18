import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface LibraryIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * LibraryIcon
 * Spatial Multi-Layered Zotero Research Folios (Mô hình layer không gian).
 * Conforms 100% to the visual DNA of WorkItemsIcon & StickiesIcon:
 * - 16x16 canvas with crisp ~1.25px stroke geometry.
 * - 2 layered scholarly manuscripts/folios in space with occlusion gap.
 * - Academic citation bookmark ribbon and abstract lines.
 * - Distinct vertical silhouette contrasting 100% with Storage.
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
      {/* Back Folio Layer */}
      <path
        d="M5.4 1.5C5.4 0.95 5.85 0.5 6.4 0.5H12.6C13.15 0.5 13.6 0.95 13.6 1.5V10.2C13.6 10.75 13.15 11.2 12.6 11.2H11.5V9.9H12.35V1.75H6.65V3.0H5.4V1.5Z"
        fill="currentColor"
      />
      {/* Front Folio Layer */}
      <path
        d="M2.2 3.8C2.2 3.25 2.65 2.8 3.2 2.8H10.4C10.95 2.8 11.4 3.25 11.4 3.8V14.2C11.4 14.75 10.95 15.2 10.4 15.2H3.2C2.65 15.2 2.2 14.75 2.2 14.2V3.8ZM3.45 4.05V13.95H10.15V4.05H3.45Z"
        fill="currentColor"
      />
      {/* Academic Citation Bookmark Ribbon */}
      <path
        d="M7.0 2.8V7.2L8.3 6.2L9.6 7.2V2.8H7.0Z"
        fill="currentColor"
      />
      {/* Research Abstract Lines */}
      <path
        d="M4.4 8.6H6.2V9.8H4.4V8.6ZM4.4 11.0H9.2V12.2H4.4V11.0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const LibrarySpaceIcon = LibraryIcon;
export const CosmicLibraryIcon = LibraryIcon;
export default LibraryIcon;
