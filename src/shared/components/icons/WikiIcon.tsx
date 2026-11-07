import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface WikiIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * WikiIcon (Bespoke LaTeX IDE & Scholarly Authoring Studio Icon)
 * Custom-crafted 24x24 vector representing a scientific manuscript & LaTeX
 * authoring studio: a clean canvas featuring a scholarly Sigma/TeX glyph
 * paired with structured typesetting lines and a live authoring Nib/Cursor.
 */
export function WikiIcon({
  className,
  size = 24,
  strokeWidth = 2,
  ...props
}: WikiIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    >
      {/* Manuscript / IDE canvas frame (open bottom-right for authoring pen) */}
      <path d="M13 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5" />
      {/* LaTeX / Mathematical Sigma (Σ) / Code command glyph */}
      <path d="M10.5 7.5H7l2.5 3L7 13.5h3.5" />
      {/* Typesetting / compiled document lines */}
      <path d="M14 8.5h3" />
      <path d="M14 12.5h2" />
      {/* Precision authoring pen / live editor nib at bottom-right */}
      <path d="M18.4 15.6a1.5 1.5 0 0 1 2.1 2.1L16.5 21.7l-3 .8.8-3 4.1-3.9Z" />
    </svg>
  );
}

export const PagesIcon = WikiIcon;
export default WikiIcon;
