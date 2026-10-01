'use client';
import React from 'react';

/**
 * Official Overleaf Review Icon
 * Replicating the speech bubble with angled pen and baseline marker.
 */
export function OverleafReviewIcon({
  className = 'size-4',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 6 3.5 H 18 A 2.5 2.5 0 0 1 20.5 6 V 14.5 A 2.5 2.5 0 0 1 18 17 H 8.5 L 4.5 20.5 A 0.5 0.5 0 0 1 3.5 20 V 6 A 2.5 2.5 0 0 1 6 3.5 Z M 7.8 13.2 L 7.6 11.8 L 13.6 5.8 A 1 1 0 0 1 15 5.8 L 15.2 6 A 1 1 0 0 1 15.2 7.4 L 9.2 13.4 Z M 11.5 12.6 H 15.5 A 0.6 0.6 0 0 1 15.5 13.8 H 11.5 A 0.6 0.6 0 0 1 11.5 12.6 Z"
      />
    </svg>
  );
}

/**
 * Solid Cutout Variant for Empty State and Active Badge
 * The pen and line are transparent cutouts through the filled bubble.
 */
export function OverleafReviewSolidIcon({
  className = 'size-9',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 6 3.5 H 18 A 2.5 2.5 0 0 1 20.5 6 V 14.5 A 2.5 2.5 0 0 1 18 17 H 8.5 L 4.5 20.5 A 0.5 0.5 0 0 1 3.5 20 V 6 A 2.5 2.5 0 0 1 6 3.5 Z M 7.8 13.2 L 7.6 11.8 L 13.6 5.8 A 1 1 0 0 1 15 5.8 L 15.2 6 A 1 1 0 0 1 15.2 7.4 L 9.2 13.4 Z M 11.5 12.6 H 15.5 A 0.6 0.6 0 0 1 15.5 13.8 H 11.5 A 0.6 0.6 0 0 1 11.5 12.6 Z"
      />
    </svg>
  );
}

export default OverleafReviewIcon;
