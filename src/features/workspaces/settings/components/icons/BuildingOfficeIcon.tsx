import React from 'react';
import type { LucideProps } from 'lucide-react';

export const BuildingOfficeIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ className = '', size = 16, strokeWidth = 1.75, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {/* Outer building structure */}
        <rect x="4" y="2" width="16" height="20" rx="3.5" />

        {/* 3x3 Grid of Window Dots */}
        <circle cx="8" cy="6.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="6.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="6.5" r="1" fill="currentColor" stroke="none" />

        <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" />

        <circle cx="8" cy="14.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="14.5" r="1" fill="currentColor" stroke="none" />

        {/* Entrance Door */}
        <path d="M9 22v-3.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V22" />
        <line x1="11" y1="19.5" x2="13" y2="19.5" />
      </svg>
    );
  },
);

BuildingOfficeIcon.displayName = 'BuildingOfficeIcon';
export default BuildingOfficeIcon;
